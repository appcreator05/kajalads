import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import JSZip from 'jszip';
import forge from 'node-forge';
import { createServer as createViteServer } from 'vite';
import { patchBinaryAndroidManifest, patchResourcesArscIcon } from './src/utils/manifestPatcher';
import { generateLauncherHtml } from './src/utils/launcherGenerator';

function injectApkV2Block(zipBuf: Buffer, cert: forge.pki.Certificate, privateKey: forge.pki.rsa.PrivateKey): Buffer {
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65557); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    return zipBuf;
  }

  const cdSize = zipBuf.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);

  const sec1 = zipBuf.subarray(0, cdOffset);
  const sec2 = zipBuf.subarray(cdOffset, cdOffset + cdSize);
  const sec3 = Buffer.from(zipBuf.subarray(eocdOffset));

  const CHUNK_SIZE = 1048576;
  const chunkDigests: Buffer[] = [];
  for (const sec of [sec1, sec2, sec3]) {
    let offset = 0;
    while (offset < sec.length) {
      const len = Math.min(CHUNK_SIZE, sec.length - offset);
      const chunk = sec.subarray(offset, offset + len);
      const prefix = Buffer.alloc(5);
      prefix.writeUInt8(0xa5, 0);
      prefix.writeUInt32LE(len, 1);
      const hash = crypto.createHash('sha256').update(prefix).update(chunk).digest();
      chunkDigests.push(hash);
      offset += len;
    }
  }
  const allDigests = Buffer.concat(chunkDigests);
  const topPrefix = Buffer.alloc(5);
  topPrefix.writeUInt8(0x5a, 0);
  topPrefix.writeUInt32LE(chunkDigests.length, 1);
  const apkDigest = crypto.createHash('sha256').update(topPrefix).update(allDigests).digest();

  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
  const pubKeyDer = Buffer.from(forge.asn1.toDer(forge.pki.publicKeyToAsn1(cert.publicKey as any)).getBytes(), 'binary');

  const digestEntry = Buffer.alloc(4 + 4 + 32);
  digestEntry.writeUInt32LE(0x0103, 0);
  digestEntry.writeUInt32LE(32, 4);
  apkDigest.copy(digestEntry, 8);

  const digestsList = Buffer.concat([Buffer.alloc(4), Buffer.alloc(4), digestEntry]);
  digestsList.writeUInt32LE(digestEntry.length + 4, 0);
  digestsList.writeUInt32LE(digestEntry.length, 4);

  const certList = Buffer.concat([Buffer.alloc(4), Buffer.alloc(4), certDer]);
  certList.writeUInt32LE(certDer.length + 4, 0);
  certList.writeUInt32LE(certDer.length, 4);

  const emptyAttrs = Buffer.alloc(4);
  const signedData = Buffer.concat([digestsList, certList, emptyAttrs]);
  const signedDataPrefixed = Buffer.concat([Buffer.alloc(4), signedData]);
  signedDataPrefixed.writeUInt32LE(signedData.length, 0);

  const md = forge.md.sha256.create();
  md.update(signedData.toString('binary'));
  const rawSig = privateKey.sign(md);
  const sigBytes = Buffer.from(rawSig, 'binary');

  const sigEntry = Buffer.alloc(4 + 4 + sigBytes.length);
  sigEntry.writeUInt32LE(0x0103, 0);
  sigEntry.writeUInt32LE(sigBytes.length, 4);
  sigBytes.copy(sigEntry, 8);

  const signaturesList = Buffer.concat([Buffer.alloc(4), Buffer.alloc(4), sigEntry]);
  signaturesList.writeUInt32LE(sigEntry.length + 4, 0);
  signaturesList.writeUInt32LE(sigEntry.length, 4);

  const pubKeyPrefixed = Buffer.concat([Buffer.alloc(4), pubKeyDer]);
  pubKeyPrefixed.writeUInt32LE(pubKeyDer.length, 0);

  const signerContent = Buffer.concat([signedDataPrefixed, signaturesList, pubKeyPrefixed]);
  const signerPrefixed = Buffer.concat([Buffer.alloc(4), signerContent]);
  signerPrefixed.writeUInt32LE(signerContent.length, 0);

  const signersSeq = Buffer.concat([Buffer.alloc(4), signerPrefixed]);
  signersSeq.writeUInt32LE(signerPrefixed.length, 0);

  const pairHeader = Buffer.alloc(12);
  pairHeader.writeUInt32LE(4 + signersSeq.length, 0);
  pairHeader.writeUInt32LE(0, 4);
  pairHeader.writeUInt32LE(0x7109871a, 8);
  const pair = Buffer.concat([pairHeader, signersSeq]);

  const magic = Buffer.from('APK Sig Block 42', 'ascii');
  const blockSize = pair.length + 8 + 16;

  const blockHeader = Buffer.alloc(8);
  blockHeader.writeUInt32LE(blockSize, 0);
  blockHeader.writeUInt32LE(0, 4);

  const blockFooter = Buffer.alloc(8);
  blockFooter.writeUInt32LE(blockSize, 0);
  blockFooter.writeUInt32LE(0, 4);

  const signingBlock = Buffer.concat([blockHeader, pair, blockFooter, magic]);
  const newCdOffset = cdOffset + signingBlock.length;
  sec3.writeUInt32LE(newCdOffset, 16);

  return Buffer.concat([sec1, signingBlock, sec2, sec3]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for all API requests (supports WebView and mobile cross-origin access)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Allow large payloads up to 100MB for APK/AAB/ZIP binaries
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Persistent disk storage directory for APK downloads (survives process restarts)
  const DISK_CACHE_DIR = path.join(os.tmpdir(), 'apk_download_storage');
  try {
    if (!fs.existsSync(DISK_CACHE_DIR)) {
      fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Failed to ensure DISK_CACHE_DIR:', err);
  }

  // In-memory download storage with 48-hour TTL
  interface StoredDownload {
    buffer?: Buffer;
    filePath?: string;
    fileName: string;
    mimeType: string;
    createdAt: number;
  }
  const downloadCache = new Map<string, StoredDownload>();

  // Cleanup expired downloads every 30 minutes (48 hours retention)
  const MAX_DOWNLOAD_AGE_MS = 48 * 3600 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const [id, item] of downloadCache.entries()) {
      if (now - item.createdAt > MAX_DOWNLOAD_AGE_MS) {
        downloadCache.delete(id);
        if (item.filePath && fs.existsSync(item.filePath)) {
          try {
            fs.unlinkSync(item.filePath);
            const metaPath = item.filePath.replace(/\.bin$/, '.json');
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
          } catch {}
        }
      }
    }
  }, 30 * 60 * 1000);

  // API to prepare a direct URL download
  app.post('/api/prepare-download', (req, res) => {
    try {
      const { fileName, base64, mimeType } = req.body;
      if (!fileName || !base64) {
        return res.status(400).json({ error: 'Missing fileName or base64 data' });
      }

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const id = Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);

      const targetFileName = fileName.trim() || 'app.apk';
      const targetMimeType = mimeType || 'application/vnd.android.package-archive';

      // Save to disk for durability across container restarts
      const diskFilePath = path.join(DISK_CACHE_DIR, `${id}.bin`);
      const diskMetaPath = path.join(DISK_CACHE_DIR, `${id}.json`);
      try {
        fs.writeFileSync(diskFilePath, buffer);
        fs.writeFileSync(
          diskMetaPath,
          JSON.stringify({
            fileName: targetFileName,
            mimeType: targetMimeType,
            createdAt: Date.now(),
          })
        );
      } catch (diskErr) {
        console.warn('Could not write download to disk cache:', diskErr);
      }

      downloadCache.set(id, {
        buffer,
        filePath: diskFilePath,
        fileName: targetFileName,
        mimeType: targetMimeType,
        createdAt: Date.now(),
      });

      const downloadPath = `/api/download/${id}/${encodeURIComponent(targetFileName)}`;
      const forwardedHost = req.get('x-forwarded-host');
      const host = forwardedHost ? forwardedHost.split(',')[0].trim() : (req.get('host') || 'localhost:3000');
      const forwardedProto = req.get('x-forwarded-proto');
      const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || 'https');
      const fullUrl = `${proto}://${host}${downloadPath}`;

      return res.json({
        success: true,
        id,
        downloadUrl: fullUrl,
        downloadPath,
        fileName: targetFileName,
        size: buffer.length,
      });
    } catch (e: any) {
      console.error('prepare-download error:', e);
      return res.status(500).json({ error: e.message || 'Failed to prepare download' });
    }
  });

  // Serve the base template directly for both web and webview asset loading paths
  app.get(['/assets/web/base-template.apk', '/base-template.apk'], (req, res) => {
    const templatePath = fs.existsSync(path.join(process.cwd(), 'public', 'base-template.apk'))
      ? path.join(process.cwd(), 'public', 'base-template.apk')
      : path.join(process.cwd(), 'dist', 'base-template.apk');

    if (fs.existsSync(templatePath)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="base-template.apk"');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(templatePath);
    }
    res.status(404).send('Base APK template not found');
  });

  // API to compile a 100% installable Android APK signed with valid v1 cryptographic signature
  app.post('/api/build-real-apk', async (req, res) => {
    try {
      const { config, logoBase64, splashBase64 } = req.body;
      if (!config) {
        return res.status(400).json({ error: 'Missing app configuration' });
      }

      const templatePath = fs.existsSync(path.join(process.cwd(), 'public', 'base-template.apk'))
        ? path.join(process.cwd(), 'public', 'base-template.apk')
        : path.join(process.cwd(), 'dist', 'base-template.apk');

      if (!fs.existsSync(templatePath)) {
        return res.status(500).json({ error: 'Base APK template not found on server' });
      }

      const templateBuf = fs.readFileSync(templatePath);
      const zip = await JSZip.loadAsync(templateBuf);

      const appName = (config.appName || 'My App').trim();
      const websiteUrl = (config.websiteUrl || 'https://google.com').trim();

      // If this build is for a regular website app, remove embedded base-template to keep APK light (~5.4 MB)
      // If it is the APK Creator itself, retain it so the mobile app has full offline building capability!
      const isCreatorApp =
        appName.toLowerCase().includes('creator') ||
        appName.toLowerCase().includes('builder') ||
        (config.packageName || '').toLowerCase().includes('creator') ||
        (config.packageName || '').toLowerCase().includes('builder') ||
        config.includeOfflineEngine === true;

      if (!isCreatorApp && zip.file('assets/web/base-template.apk')) {
        zip.remove('assets/web/base-template.apk');
      }

      // 0. Patch binary AndroidManifest.xml with unique package name, app label & authorities
      const manifestFile = zip.file('AndroidManifest.xml');
      if (manifestFile) {
        try {
          const origManifestBytes = await manifestFile.async('uint8array');
          const patchedManifest = patchBinaryAndroidManifest(origManifestBytes, config);
          zip.file('AndroidManifest.xml', patchedManifest);
        } catch (manifestErr) {
          console.warn('Failed to patch AndroidManifest.xml:', manifestErr);
        }
      }

      // 1. Inject complete app_config.json containing all features, permissions, and settings
      zip.file('assets/app_config.json', JSON.stringify(config, null, 2));

      // 1.1 Inject google-services.json if provided by user
      if (config.googleServicesJson && config.googleServicesJson.trim()) {
        const gsContent = config.googleServicesJson.trim();
        zip.file('assets/google-services.json', gsContent);
        zip.file('assets/web/google-services.json', gsContent);
        zip.file('google-services.json', gsContent);
        zip.file('res/raw/google_services.json', gsContent);
      }

      // 2. Inject launcher index.html with live ads and orientation engine
      const launcherHtml = generateLauncherHtml(config, logoBase64 || undefined);
      zip.file('assets/web/index.html', launcherHtml);

      // 3. Inject logo if available (fallback to public/logo.png)
      let activeLogoBuf: Buffer | null = null;
      if (logoBase64 && logoBase64.trim()) {
        const cleanLogo = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
        try {
          activeLogoBuf = Buffer.from(cleanLogo, 'base64');
        } catch (_) {}
      }
      if (!activeLogoBuf) {
        const defaultLogoPath = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(defaultLogoPath)) {
          activeLogoBuf = fs.readFileSync(defaultLogoPath);
        }
      }

      if (activeLogoBuf) {
        zip.file('assets/web/app_logo.png', activeLogoBuf);
        zip.file('assets/app_logo.png', activeLogoBuf);

        // Standard and high-res mipmaps for all phone displays
        zip.file('res/mipmap-mdpi/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-hdpi/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-xhdpi/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-xxhdpi/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-xxxhdpi/ic_launcher.png', activeLogoBuf);

        zip.file('res/mipmap-mdpi-v4/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-hdpi-v4/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-xhdpi-v4/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-xxhdpi-v4/ic_launcher.png', activeLogoBuf);
        zip.file('res/mipmap-xxxhdpi-v4/ic_launcher.png', activeLogoBuf);

        // Modern round icon launchers
        zip.file('res/mipmap-mdpi/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-hdpi/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-xhdpi/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-xxhdpi/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-xxxhdpi/ic_launcher_round.png', activeLogoBuf);

        zip.file('res/mipmap-mdpi-v4/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-hdpi-v4/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-xhdpi-v4/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-xxhdpi-v4/ic_launcher_round.png', activeLogoBuf);
        zip.file('res/mipmap-xxxhdpi-v4/ic_launcher_round.png', activeLogoBuf);

        zip.file('res/drawable/ic_launcher.png', activeLogoBuf);
        zip.file('res/drawable/ic_launcher_round.png', activeLogoBuf);

        // Patch resources.arsc so Android Launcher doesn't use the old anydpi adaptive XML vector logo
        const arscFile = zip.file('resources.arsc');
        if (arscFile) {
          try {
            const origArsc = await arscFile.async('uint8array');
            const patchedArsc = patchResourcesArscIcon(origArsc);
            zip.file('resources.arsc', Buffer.from(patchedArsc), { compression: 'STORE' });
            // Remove the default anydpi adaptive XML so the device launcher immediately loads the PNG
            zip.remove('res/mipmap-anydpi-v26/ic_launcher.xml');
            zip.remove('res/mipmap-anydpi-v26/ic_launcher_round.xml');
          } catch (arscErr) {
            console.warn('Failed to patch resources.arsc for custom launcher icon:', arscErr);
          }
        }
      }

      // 4. Inject splash (fallback to public/splash.png)
      let activeSplashBuf: Buffer | null = null;
      if (splashBase64 && splashBase64.trim()) {
        const cleanSplash = splashBase64.includes(',') ? splashBase64.split(',')[1] : splashBase64;
        try {
          activeSplashBuf = Buffer.from(cleanSplash, 'base64');
        } catch (_) {}
      }
      if (!activeSplashBuf) {
        const defaultSplashPath = path.join(process.cwd(), 'public', 'splash.png');
        if (fs.existsSync(defaultSplashPath)) {
          activeSplashBuf = fs.readFileSync(defaultSplashPath);
        }
      }

      if (activeSplashBuf) {
        zip.file('assets/splash_image.png', activeSplashBuf);
        zip.file('res/drawable/splash_image.png', activeSplashBuf);
        zip.file('res/drawable/splash_bg.png', activeSplashBuf);
      }

      // 5. Remove old signatures
      const toDelete: string[] = [];
      zip.forEach((pathName) => {
        if (
          pathName.startsWith('META-INF/') &&
          (pathName.endsWith('.SF') ||
            pathName.endsWith('.RSA') ||
            pathName.endsWith('.DSA') ||
            pathName.endsWith('.EC') ||
            pathName.endsWith('MANIFEST.MF'))
        ) {
          toDelete.push(pathName);
        }
      });
      toDelete.forEach((p) => zip.remove(p));

      // 6. Generate SHA-256 digests for all files
      let manifest = 'Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android Signer)\r\n\r\n';
      const fileDigests: Array<{ name: string; hash: string; entryHeader: string }> = [];
      const files = Object.keys(zip.files).sort();

      for (const name of files) {
        const entry = zip.files[name];
        if (entry.dir || name.startsWith('META-INF/')) continue;
        const content = await entry.async('nodebuffer');
        const hash = crypto.createHash('sha256').update(content).digest('base64');
        const entryHeader = `Name: ${name}\r\nSHA-256-Digest: ${hash}\r\n\r\n`;
        manifest += entryHeader;
        fileDigests.push({ name, hash, entryHeader });
      }

      const manifestBuf = Buffer.from(manifest, 'utf-8');
      const manifestHash = crypto.createHash('sha256').update(manifestBuf).digest('base64');

      let certSf = `Signature-Version: 1.0\r\nCreated-By: 1.0 (Android Signer)\r\nSHA-256-Digest-Manifest: ${manifestHash}\r\n\r\n`;
      for (const item of fileDigests) {
        const entryHash = crypto.createHash('sha256').update(Buffer.from(item.entryHeader, 'utf-8')).digest('base64');
        certSf += `Name: ${item.name}\r\nSHA-256-Digest: ${entryHash}\r\n\r\n`;
      }

      // 7. Generate RSA 2048 keypair and sign CERT.SF
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01' + Date.now().toString(16);
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30);
      const safeCommonName = appName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Android Release';
      const attrs = [
        { name: 'commonName', value: safeCommonName },
        { name: 'organizationName', value: 'Production Studio' },
        { name: 'countryName', value: 'US' },
      ];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey, forge.md.sha256.create());

      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(certSf);
      p7.addCertificate(cert);
      p7.addSigner({
        key: keys.privateKey,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
          { type: forge.pki.oids.messageDigest },
          { type: forge.pki.oids.signingTime, value: new Date() as any },
        ] as any,
      });
      p7.sign({ detached: true });

      const rsaDer = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');

      zip.file('META-INF/MANIFEST.MF', manifestBuf);
      zip.file('META-INF/CERT.SF', Buffer.from(certSf, 'utf-8'));
      zip.file('META-INF/CERT.RSA', rsaDer);

      // Ensure resources.arsc is STORE (uncompressed) as mandated by Android AssetManager
      const finalArsc = zip.file('resources.arsc');
      if (finalArsc) {
        const arscData = await finalArsc.async('nodebuffer');
        zip.file('resources.arsc', arscData, { compression: 'STORE' });
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Inject APK Signature Scheme v2 block (mandatory for Android 11+ and targetSdk 37)
      const signedApkBuffer = injectApkV2Block(zipBuffer, cert, keys.privateKey);

      // 8. Cache APK for instant download
      const safeFileName = `${appName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'app'}-v${config.appVersion || '1.0.0'}-release.apk`;
      const id = Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      const diskFilePath = path.join(DISK_CACHE_DIR, `${id}.bin`);
      const diskMetaPath = path.join(DISK_CACHE_DIR, `${id}.json`);

      try {
        fs.writeFileSync(diskFilePath, signedApkBuffer);
        fs.writeFileSync(
          diskMetaPath,
          JSON.stringify({
            fileName: safeFileName,
            mimeType: 'application/vnd.android.package-archive',
            createdAt: Date.now(),
          })
        );
      } catch (err) {
        console.warn('Could not cache signed APK to disk:', err);
      }

      downloadCache.set(id, {
        buffer: signedApkBuffer,
        filePath: diskFilePath,
        fileName: safeFileName,
        mimeType: 'application/vnd.android.package-archive',
        createdAt: Date.now(),
      });

      const downloadPath = `/api/download/${id}/${encodeURIComponent(safeFileName)}`;
      const forwardedHost = req.get('x-forwarded-host');
      const host = forwardedHost ? forwardedHost.split(',')[0].trim() : (req.get('host') || 'localhost:3000');
      const forwardedProto = req.get('x-forwarded-proto');
      const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || 'https');
      const fullUrl = `${proto}://${host}${downloadPath}`;

      return res.json({
        success: true,
        fileName: safeFileName,
        downloadUrl: fullUrl,
        downloadPath,
        size: signedApkBuffer.length,
        base64: signedApkBuffer.toString('base64'),
      });
    } catch (err: any) {
      console.error('build-real-apk error:', err);
      return res.status(500).json({ error: err.message || 'APK build failed' });
    }
  });

  // API to stream the file as a native attachment download for Chrome / Custom Tabs
  app.get('/api/download/:id/:fileName', (req, res) => {
    const { id } = req.params;
    let file = downloadCache.get(id);

    // If not found in memory, check disk cache
    if (!file) {
      const diskFilePath = path.join(DISK_CACHE_DIR, `${id}.bin`);
      const diskMetaPath = path.join(DISK_CACHE_DIR, `${id}.json`);
      if (fs.existsSync(diskFilePath) && fs.existsSync(diskMetaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(diskMetaPath, 'utf8'));
          const buffer = fs.readFileSync(diskFilePath);
          file = {
            buffer,
            filePath: diskFilePath,
            fileName: meta.fileName,
            mimeType: meta.mimeType,
            createdAt: meta.createdAt || Date.now(),
          };
          downloadCache.set(id, file);
        } catch (e) {
          console.warn('Failed to recover file from disk cache:', e);
        }
      }
    }

    if (!file || (!file.buffer && (!file.filePath || !fs.existsSync(file.filePath)))) {
      return res
        .status(404)
        .send(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Download Expired</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0f172a;color:#e2e8f0;"><h2>Download link was not found or has expired</h2><p>Please return to the app and click the "Download" button again.</p></body></html>'
        );
    }

    const fileBuffer = file.buffer || fs.readFileSync(file.filePath!);

    // Set standard binary attachment headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.send(fileBuffer);
  });

  // Short direct download link for SMS/WhatsApp/Custom Tabs
  app.get('/dl/:id', (req, res) => {
    const { id } = req.params;
    const file = downloadCache.get(id);
    if (file) {
      return res.redirect(`/api/download/${id}/${encodeURIComponent(file.fileName)}`);
    }
    const diskMetaPath = path.join(DISK_CACHE_DIR, `${id}.json`);
    if (fs.existsSync(diskMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(diskMetaPath, 'utf8'));
        return res.redirect(`/api/download/${id}/${encodeURIComponent(meta.fileName)}`);
      } catch (_) {}
    }
    return res.status(404).send('Download file not found or expired.');
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeDownloads: downloadCache.size,
      timestamp: new Date().toISOString(),
    });
  });

  const DEFAULT_GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  const DEFAULT_GITHUB_REPO = process.env.GITHUB_REPO || 'shortsproeran-creator/mt';

  function parseGitHubOwnerAndRepo(rawOwner?: string, rawRepo?: string): { owner: string; repo: string } {
    let candidate = (rawRepo || '').trim();
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      candidate = candidate.replace(/^https?:\/\/github\.com\//i, '');
    }
    candidate = candidate.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');

    if (candidate.includes('/')) {
      const parts = candidate.split('/');
      const o = parts[0].trim();
      const r = parts[1].trim();
      if (!o.includes('tra105') && !r.includes('tra105') && o && r) {
        return { owner: o, repo: r };
      }
    }

    let owner = (rawOwner || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
    if (owner.includes('/')) {
      const parts = owner.split('/');
      const o = parts[0].trim();
      const r = parts[1].trim();
      if (!o.includes('tra105') && !r.includes('tra105') && o && r) {
        return { owner: o, repo: r };
      }
    }

    if (owner.includes('tra105') || candidate.includes('tra105')) {
      return { owner: 'appcreator05', repo: '25' };
    }

    return { owner: owner || 'appcreator05', repo: candidate || '25' };
  }

  // Check GitHub config status
  app.get('/api/github/config-status', (_req, res) => {
    const activeToken = (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) || DEFAULT_GITHUB_TOKEN;
    const activeRepo = (process.env.GITHUB_REPO && process.env.GITHUB_REPO.trim()) || DEFAULT_GITHUB_REPO;
    return res.json({
      configuredOnServer: Boolean(activeToken && activeRepo),
      serverRepo: activeRepo,
    });
  });

  // API to upload an APK/AAB to GitHub Releases
  app.post('/api/github/upload-release', async (req, res) => {
    try {
      const { token, owner, repo, fileName, base64, mimeType, releaseTag, releaseName } = req.body;

      const cleanToken =
        (token && token.trim()) ||
        (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) ||
        DEFAULT_GITHUB_TOKEN;
      
      const fallbackRepo = (process.env.GITHUB_REPO && process.env.GITHUB_REPO.trim()) || DEFAULT_GITHUB_REPO;
      const { owner: cleanOwner, repo: cleanRepo } = parseGitHubOwnerAndRepo(owner, repo || fallbackRepo);

      if (!cleanToken) {
        return res.status(400).json({ error: 'GitHub Personal Access Token is required' });
      }
      if (!cleanOwner || !cleanRepo) {
        return res.status(400).json({ error: 'GitHub owner and repository name are required' });
      }
      if (!fileName || !base64) {
        return res.status(400).json({ error: 'File name and base64 content are required' });
      }

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      const fileBuffer = Buffer.from(cleanBase64, 'base64');
      const targetMime = mimeType || 'application/vnd.android.package-archive';
      const cleanFileName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');

      const tag = releaseTag || `v1.0.${Date.now()}`;
      const name = releaseName || `Release ${cleanFileName} (${new Date().toLocaleDateString()})`;

      // 1. Create a GitHub Release
      const releaseRes = await fetch(`https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'WebToApkCreator-Agent',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tag_name: tag,
          name: name,
          body: `🚀 Automated build asset created by Web to APK Creator on ${new Date().toUTCString()}.\n\n- **File Name:** \`${cleanFileName}\`\n- **Size:** ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB\n- **Direct Download:** Official GitHub Release Asset`,
          draft: false,
          prerelease: false,
        }),
      });

      if (!releaseRes.ok) {
        const errText = await releaseRes.text();
        let parsedMessage = errText;
        try {
          const parsed = JSON.parse(errText);
          parsedMessage = parsed.message || errText;
        } catch (_) {}
        return res.status(releaseRes.status).json({
          error: `GitHub Release creation failed: ${parsedMessage}`,
          details: errText,
        });
      }

      const releaseData = await releaseRes.json();
      const releaseId = releaseData.id;

      // 2. Upload asset binary to the created release
      const uploadUrl = `https://uploads.github.com/repos/${cleanOwner}/${cleanRepo}/releases/${releaseId}/assets?name=${encodeURIComponent(cleanFileName)}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'WebToApkCreator-Agent',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': targetMime,
          'Content-Length': fileBuffer.length.toString(),
        },
        body: fileBuffer,
      });

      if (!uploadRes.ok) {
        const uploadErrText = await uploadRes.text();
        return res.status(uploadRes.status).json({
          error: `Asset upload to GitHub failed: ${uploadErrText}`,
          releaseUrl: releaseData.html_url,
        });
      }

      const assetData = await uploadRes.json();

      return res.json({
        success: true,
        downloadUrl: assetData.browser_download_url,
        releaseUrl: releaseData.html_url,
        tagName: releaseData.tag_name,
        fileName: cleanFileName,
        size: assetData.size,
      });
    } catch (err: any) {
      console.error('github/upload-release error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error during GitHub upload' });
    }
  });

  // API to upload BOTH APK and AAB to a single GitHub Release
  app.post('/api/github/upload-both-release', async (req, res) => {
    try {
      const { token, owner, repo, releaseTag, releaseName, apk, aab } = req.body;

      const cleanToken =
        (token && token.trim()) ||
        (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) ||
        DEFAULT_GITHUB_TOKEN;
      
      const fallbackRepo = (process.env.GITHUB_REPO && process.env.GITHUB_REPO.trim()) || DEFAULT_GITHUB_REPO;
      const { owner: cleanOwner, repo: cleanRepo } = parseGitHubOwnerAndRepo(owner, repo || fallbackRepo);

      if (!cleanToken) {
        return res.status(400).json({ error: 'GitHub Personal Access Token is required' });
      }
      if (!cleanOwner || !cleanRepo) {
        return res.status(400).json({ error: 'GitHub owner and repository name are required' });
      }
      if (!apk || !apk.base64) {
        return res.status(400).json({ error: 'APK binary data is required' });
      }

      const tag = releaseTag || `v1.0.${Date.now()}`;
      const name = releaseName || `Release ${tag} (${new Date().toLocaleDateString()})`;

      // 1. Create Release
      const releaseRes = await fetch(`https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'WebToApkCreator-Agent',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tag_name: tag,
          name: name,
          body: `🚀 Automated build release containing APK and AAB packages.\n\nGenerated on ${new Date().toUTCString()} by Web to APK Creator.`,
          draft: false,
          prerelease: false,
        }),
      });

      if (!releaseRes.ok) {
        const errText = await releaseRes.text();
        let parsedMessage = errText;
        try {
          const parsed = JSON.parse(errText);
          parsedMessage = parsed.message || errText;
        } catch (_) {}
        return res.status(releaseRes.status).json({
          error: `GitHub Release creation failed: ${parsedMessage}`,
          details: errText,
        });
      }

      const releaseData = await releaseRes.json();
      const releaseId = releaseData.id;

      // Helper function to upload an asset
      const uploadSingleAsset = async (fileName: string, base64Data: string, mime: string) => {
        const cleanB64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const buffer = Buffer.from(cleanB64, 'base64');
        const cleanName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadUrl = `https://uploads.github.com/repos/${cleanOwner}/${cleanRepo}/releases/${releaseId}/assets?name=${encodeURIComponent(cleanName)}`;

        const upRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'WebToApkCreator-Agent',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': mime,
            'Content-Length': buffer.length.toString(),
          },
          body: buffer,
        });

        if (!upRes.ok) {
          const err = await upRes.text();
          throw new Error(`Failed to upload ${cleanName}: ${err}`);
        }
        return await upRes.json();
      };

      // 2. Upload APK
      const apkFileName = apk.fileName || 'app-release.apk';
      const apkAsset = await uploadSingleAsset(
        apkFileName,
        apk.base64,
        'application/vnd.android.package-archive'
      );

      // 3. Upload AAB if provided
      let aabAsset = null;
      if (aab && aab.base64) {
        const aabFileName = aab.fileName || 'app-release.aab';
        aabAsset = await uploadSingleAsset(
          aabFileName,
          aab.base64,
          'application/octet-stream'
        );
      }

      return res.json({
        success: true,
        releaseUrl: releaseData.html_url,
        tagName: releaseData.tag_name,
        apk: {
          fileName: apkFileName,
          downloadUrl: apkAsset.browser_download_url,
          size: apkAsset.size,
        },
        aab: aabAsset
          ? {
              fileName: aab.fileName || 'app-release.aab',
              downloadUrl: aabAsset.browser_download_url,
              size: aabAsset.size,
            }
          : null,
      });
    } catch (err: any) {
      console.error('github/upload-both-release error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error during GitHub upload' });
    }
  });

  // API to upload file to free public cloud storage (tmpfiles.org) as instant 1-click fallback
  app.post('/api/cloud-upload', async (req, res) => {
    try {
      const { fileName, base64 } = req.body;
      if (!fileName || !base64) {
        return res.status(400).json({ error: 'Missing fileName or base64' });
      }

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      const fileBuffer = Buffer.from(cleanBase64, 'base64');
      const cleanFileName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'app.apk';

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/vnd.android.package-archive' });
      formData.append('file', blob, cleanFileName);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Cloud host returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && data.data && data.data.url) {
        // tmpfiles.org URLs have the format https://tmpfiles.org/12345/filename.apk
        // Direct download URL requires changing https://tmpfiles.org/ to https://tmpfiles.org/dl/
        const rawUrl = data.data.url as string;
        const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        return res.json({
          success: true,
          downloadUrl: directUrl,
          rawUrl,
          fileName: cleanFileName,
        });
      }

      return res.status(500).json({ error: 'Failed to obtain direct URL from cloud storage' });
    } catch (err: any) {
      console.error('cloud-upload error:', err);
      return res.status(500).json({ error: err.message || 'Cloud upload failed' });
    }
  });

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
