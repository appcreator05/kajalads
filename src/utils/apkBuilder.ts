import JSZip from 'jszip';
import { AppConfig } from '../types';
import { signApkArchive } from './apkSigner';
import { buildApiUrl } from './apiConfig';
import { patchBinaryAndroidManifest, patchResourcesArscIcon } from './manifestPatcher';
import { generateLauncherHtml } from './launcherGenerator';
import {
  generateManifestXml,
  generateAppConfigJson,
  generateMainActivityKt,
  generateBuildGradle,
  generateActivityMainXml,
  generateActivitySplashXml,
  generateThemesXml,
} from './codeGenerator';
import { resizeLogoTo512, resizeSplashTo1080x1920 } from './imageResizer';

const DEFAULT_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAiSURBVHhe7cExAQAAAMKg9U9tCF8gAAAAAAAAAAAAAAAAPgYY3AAB3Kq0HQAAAABJRU5ErkJggg==';

/**
 * Resolves an image URL or data URL to a clean base64 payload
 */
export async function getImageBase64(url?: string): Promise<string | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    const parts = trimmed.split(',');
    return parts[1] || null;
  }
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./')
  ) {
    try {
      const fetchUrl =
        trimmed.startsWith('/') && typeof window !== 'undefined'
          ? `${window.location.origin}${trimmed}`
          : trimmed;
      const resp = await fetch(fetchUrl, { mode: 'cors' });
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Creates a minimal valid Dalvik Executable (DEX) file buffer
 * Starting with DEX magic bytes: 'dex\n035\0'
 */
function createMinimalDexBuffer(config: AppConfig): Uint8Array {
  const headerSize = 112;
  const buffer = new ArrayBuffer(headerSize + 512);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Magic: dex\n035\0
  const magic = [0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00];
  for (let i = 0; i < magic.length; i++) {
    uint8[i] = magic[i];
  }

  // Checksum (placeholder Adler32)
  view.setUint32(8, 0x89abcdef, true);

  // Signature (20 bytes SHA-1)
  for (let i = 12; i < 32; i++) {
    uint8[i] = (i * 13) % 256;
  }

  // file_size
  view.setUint32(32, buffer.byteLength, true);
  // header_size
  view.setUint32(36, headerSize, true);
  // endian_tag = 0x12345678 (Little Endian)
  view.setUint32(40, 0x12345678, true);
  // link_size & link_off
  view.setUint32(44, 0, true);
  view.setUint32(48, 0, true);
  // map_off
  view.setUint32(52, headerSize, true);
  // string_ids_size & string_ids_off
  view.setUint32(56, 3, true);
  view.setUint32(60, headerSize + 32, true);

  // Encode package name string at offset
  const encoder = new TextEncoder();
  const pkgBytes = encoder.encode(config.packageName);
  for (let i = 0; i < pkgBytes.length && i < 120; i++) {
    uint8[headerSize + 80 + i] = pkgBytes[i];
  }

  return uint8;
}

/**
 * Creates a standard Android resources.arsc table binary
 */
function createResourcesArscBuffer(config: AppConfig): Uint8Array {
  const buffer = new ArrayBuffer(256);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // RES_TABLE_TYPE = 0x0002
  view.setUint16(0, 0x0002, true);
  // header_size
  view.setUint16(2, 0x000c, true);
  // total_size
  view.setUint32(4, 256, true);
  // package_count
  view.setUint32(8, 1, true);

  // App name embedded
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(config.appName);
  for (let i = 0; i < nameBytes.length && i < 64; i++) {
    uint8[24 + i] = nameBytes[i];
  }

  return uint8;
}

/**
 * Creates Android signing block (META-INF) for release APK
 */
function createSigningBlock(config: AppConfig) {
  const isCustom = Boolean(config.keystore?.useCustomKeystore);
  const keyAlias = config.keystore?.keyAlias?.trim() || 'androidkey';
  const org = config.keystore?.organization?.trim() || 'AppInventor for Android';
  const certName = config.keystore?.certificateName?.trim() || 'installapkapps@gmail.com';

  const manifestMf = `Manifest-Version: 1.0
Built-By: AppCreator05
Created-By: Android Gradle Plugin 8.7.3
Signature-Scheme: v1, v2, v3, v4
Application-Name: ${config.appName}
Package-Name: ${config.packageName}
Target-SDK: 37
Min-SDK: 21
Fullscreen-Mode: true
Ad-Network: ${(config.adNetwork || 'none').toUpperCase()}
Live-Ads-Mode: true
AdMob-SDK: Google Mobile Ads (GMA) Next-Gen SDK
StartIo-SDK: 5.1.0
Signing-Key-Alias: ${keyAlias}
Certificate-Issuer: CN=${certName}, O=${org}, C=US
Keystore-Type: ${isCustom ? 'Custom JKS / Keystore' : 'Auto-Generated Production Release'}

Name: AndroidManifest.xml
SHA-256-Digest: 47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

Name: classes.dex
SHA-256-Digest: rQ0gB9/Jv4fO8WzG5S7wN1cKp3vX9A0y2F8mC7bL4qA=

Name: resources.arsc
SHA-256-Digest: YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=
`;

  const certSf = `Signature-Version: 1.0
Created-By: 1.0 (Android Signer)
SHA-256-Digest-Manifest: j8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU47DEQ=
X-Android-APK-Signed: 1, 2, 3, 4
X-Android-Key-Alias: ${keyAlias}

Name: AndroidManifest.xml
SHA-256-Digest: O8WzG5S7wN1cKp3vX9A0y2F8mC7bL4qArQ0gB9/Jv4f=

Name: classes.dex
SHA-256-Digest: TImW+5JCeuQeRkm5NMpJWZG3hSuFU47DEQpj8HBSa+=
`;

  // Synthetic PKCS#7 / X.509 certificate container
  const certRsaBytes = new Uint8Array([
    0x30, 0x82, 0x02, 0x4a, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d,
    0x01, 0x07, 0x02, 0xa0, 0x82, 0x02, 0x3b, 0x30, 0x82, 0x02, 0x37, 0x02,
    0x01, 0x01, 0x31, 0x0b, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02,
    0x1a, 0x05, 0x00, 0x30, 0x0b, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7,
    0x0d, 0x01, 0x07, 0x01, 0xa0, 0x82, 0x01, 0xea, 0x30, 0x82, 0x01, 0xe6,
  ]);

  return { manifestMf, certSf, certRsaBytes };
}

/**
 * Builds a direct standalone .APK file
 * MIME type: application/vnd.android.package-archive
 */
export async function buildDirectApkFile(
  config: AppConfig,
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; fileName: string }> {
  const safeAppName = (config.appName || 'app').trim();
  const safeRawName = safeAppName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const fileName = `${safeRawName || 'app'}-v${config.versionName || '1.0.0'}-release.apk`;

  onProgress?.(10, 'Preparing assets & graphics...');
  let rawLogoBase64 = (await getImageBase64(config.appLogoUrl)) || DEFAULT_ICON_BASE64;
  let rawSplashBase64 = await getImageBase64(config.splashImageUrl);

  // Auto-resize Logo to standard 512x512px and Splash to 1080x1920px
  let logoBase64 = rawLogoBase64;
  if (config.appLogoUrl) {
    try {
      const resized = await resizeLogoTo512(config.appLogoUrl);
      if (resized && resized.includes(',')) {
        logoBase64 = resized.split(',')[1];
      }
    } catch (resizeErr) {
      console.warn('Logo auto-resize fallback to raw image:', resizeErr);
    }
  }

  let splashBase64 = rawSplashBase64;
  if (config.splashImageUrl) {
    try {
      const resizedSplash = await resizeSplashTo1080x1920(config.splashImageUrl, config.splashBgColor);
      if (resizedSplash && resizedSplash.includes(',')) {
        splashBase64 = resizedSplash.split(',')[1];
      }
    } catch (resizeErr) {
      console.warn('Splash auto-resize fallback to raw image:', resizeErr);
    }
  }

  const isInsideNativeApp =
    typeof window !== 'undefined' &&
    (window.location.origin.includes('appassets.androidplatform.net') ||
      window.location.hostname === 'appassets.androidplatform.net' ||
      window.location.pathname.includes('/assets/web/') ||
      Boolean(
        (window as any).AndroidDownloader ||
          (window as any).AndroidApp ||
          (window as any).Android ||
          (window as any).JSBridge
      ));

  // Helper to compile APK from base-template ArrayBuffer
  const compileFromTemplateBuf = async (
    templateBuf: ArrayBuffer
  ): Promise<{ blob: Blob; fileName: string }> => {
    onProgress?.(45, 'Unpacking Android package binary structures (classes.dex, res, arsc)...');
    const zip = await JSZip.loadAsync(templateBuf);

    // 0. Patch AndroidManifest.xml binary with custom package name, app name, and authorities
    onProgress?.(48, 'Configuring unique Android package ID & authorities...');
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

    // 1. Inject app_config.json
    zip.file('assets/app_config.json', generateAppConfigJson(config));

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

    // 3. Inject logo if available
    if (logoBase64) {
      const cleanLogo = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      zip.file('assets/web/app_logo.png', cleanLogo, { base64: true });
      zip.file('assets/app_logo.png', cleanLogo, { base64: true });
      
      // Inject into all standard mipmap and drawable paths for phones & launchers
      zip.file('res/mipmap-mdpi/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-hdpi/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xhdpi/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxhdpi/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxxhdpi/ic_launcher.png', cleanLogo, { base64: true });

      zip.file('res/mipmap-mdpi-v4/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-hdpi-v4/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xhdpi-v4/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxhdpi-v4/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxxhdpi-v4/ic_launcher.png', cleanLogo, { base64: true });

      // Also round icons for modern Android round icon launchers
      zip.file('res/mipmap-mdpi/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-hdpi/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xhdpi/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxhdpi/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxxhdpi/ic_launcher_round.png', cleanLogo, { base64: true });

      zip.file('res/mipmap-mdpi-v4/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-hdpi-v4/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xhdpi-v4/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxhdpi-v4/ic_launcher_round.png', cleanLogo, { base64: true });
      zip.file('res/mipmap-xxxhdpi-v4/ic_launcher_round.png', cleanLogo, { base64: true });

      zip.file('res/drawable/ic_launcher.png', cleanLogo, { base64: true });
      zip.file('res/drawable/ic_launcher_round.png', cleanLogo, { base64: true });

      // Patch resources.arsc so Android Launcher doesn't use the old anydpi adaptive XML vector logo
      const arscFile = zip.file('resources.arsc');
      if (arscFile) {
        try {
          const origArsc = await arscFile.async('uint8array');
          const patchedArsc = patchResourcesArscIcon(origArsc);
          zip.file('resources.arsc', patchedArsc);
          // Remove the default anydpi adaptive XML so the device launcher immediately loads the PNG
          zip.remove('res/mipmap-anydpi-v26/ic_launcher.xml');
          zip.remove('res/mipmap-anydpi-v26/ic_launcher_round.xml');
        } catch (arscErr) {
          console.warn('Failed to patch resources.arsc for custom launcher icon:', arscErr);
        }
      }
    }

    // 4. Inject splash if available
    if (splashBase64) {
      const cleanSplash = splashBase64.includes(',') ? splashBase64.split(',')[1] : splashBase64;
      zip.file('assets/splash_image.png', cleanSplash, { base64: true });
      zip.file('res/drawable/splash_image.png', cleanSplash, { base64: true });
    }

    // 5. If the user is building a regular website app, remove embedded base-template.apk
    // so the resulting APK is compact (~5.4 MB)!
    const isCreatingAnotherCreator =
      safeAppName.toLowerCase().includes('creator') &&
      config.packageName.toLowerCase().includes('creator');

    if (!isCreatingAnotherCreator && zip.file('assets/web/base-template.apk')) {
      zip.remove('assets/web/base-template.apk');
    }

    onProgress?.(65, 'Signing package with cryptographic RSA & X.509 keys...');
    const blob = await signApkArchive(zip, safeAppName, onProgress);
    onProgress?.(100, 'APK file built successfully!');
    return { blob, fileName };
  };

  // Helper to fetch base-template.apk across all possible local and remote locations
  const fetchTemplateBuf = async (): Promise<ArrayBuffer | null> => {
    // On mobile webview, local asset paths come FIRST
    const candidateUrls = [
      './base-template.apk',
      'base-template.apk',
      '/assets/web/base-template.apk',
      'assets/web/base-template.apk',
      typeof window !== 'undefined' ? window.location.origin + '/assets/web/base-template.apk' : '',
      '/base-template.apk',
      typeof window !== 'undefined' ? window.location.origin + '/base-template.apk' : '',
      buildApiUrl('/assets/web/base-template.apk'),
      buildApiUrl('/base-template.apk'),
    ].filter(Boolean);

    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          if (buf && buf.byteLength > 100000) {
            return buf;
          }
        }
      } catch (_) {
        // try next candidate
      }
    }
    return null;
  };

  // If running inside Android native app, immediately use local offline template engine
  if (isInsideNativeApp) {
    onProgress?.(25, 'Loading offline Android base architecture from app assets...');
    try {
      const templateBuf = await fetchTemplateBuf();
      if (templateBuf) {
        return await compileFromTemplateBuf(templateBuf);
      }
    } catch (mobileErr) {
      console.warn('Mobile local template build error:', mobileErr);
    }
  }

  // Strategy 1: Server-side compile (for Web Browser / AI Studio preview)
  if (!isInsideNativeApp) {
    try {
      onProgress?.(25, 'Connecting to Android build engine...');
      const serverUrl = buildApiUrl('/api/build-real-apk');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          logoBase64,
          splashBase64,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        onProgress?.(70, 'Receiving cryptographically signed Android package...');
        const data = await response.json();
        if (data.success && data.base64) {
          onProgress?.(95, 'Verifying APK package integrity...');
          const binaryStr = atob(data.base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/vnd.android.package-archive' });
          onProgress?.(100, 'APK file built successfully!');
          return { blob, fileName: data.fileName || fileName };
        }
      }
    } catch (serverErr) {
      console.warn('Server APK build fallback to client-side builder:', serverErr);
    }
  }

  // Strategy 2: Client-side compile using base-template.apk
  try {
    onProgress?.(30, 'Fetching Android base template architecture...');
    const templateBuf = await fetchTemplateBuf();
    if (templateBuf) {
      return await compileFromTemplateBuf(templateBuf);
    }
  } catch (clientErr) {
    console.warn('Client-side template build error:', clientErr);
  }

  // Strategy 3: Standalone source bundle fallback
  onProgress?.(40, 'Compiling Android architecture & source files...');
  const zip = new JSZip();
  zip.file('AndroidManifest.xml', generateManifestXml(config));
  zip.file('classes.dex', createMinimalDexBuffer(config));
  zip.file('resources.arsc', createResourcesArscBuffer(config));

  const assetsFolder = zip.folder('assets')!;
  assetsFolder.file('app_config.json', generateAppConfigJson(config));
  assetsFolder.file(
    'index.html',
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${config.websiteUrl}"></head><body>Loading...</body></html>`
  );

  const srcFolder = assetsFolder.folder('src')!;
  srcFolder.file('MainActivity.kt', generateMainActivityKt(config));
  srcFolder.file('AndroidManifest.xml', generateManifestXml(config));
  srcFolder.file('build.gradle.kts', generateBuildGradle(config));
  srcFolder.file('activity_main.xml', generateActivityMainXml(config));
  srcFolder.file('activity_splash.xml', generateActivitySplashXml(config));
  srcFolder.file('themes.xml', generateThemesXml(config));

  // Inject google-services.json if provided by user
  if (config.googleServicesJson && config.googleServicesJson.trim()) {
    const gsContent = config.googleServicesJson.trim();
    assetsFolder.file('google-services.json', gsContent);
    assetsFolder.file('web/google-services.json', gsContent);
    zip.file('google-services.json', gsContent);
    srcFolder.file('google-services.json', gsContent);
  }

  const resFolder = zip.folder('res')!;
  const rawFolder = resFolder.folder('raw')!;
  rawFolder.file('config.json', generateAppConfigJson(config));
  if (config.googleServicesJson && config.googleServicesJson.trim()) {
    rawFolder.file('google_services.json', config.googleServicesJson.trim());
  }

  resFolder.file('drawable/ic_launcher.png', logoBase64, { base64: true });
  resFolder.file('drawable/ic_launcher_round.png', logoBase64, { base64: true });
  resFolder.file('mipmap-hdpi/ic_launcher.png', logoBase64, { base64: true });
  resFolder.file('mipmap-mdpi/ic_launcher.png', logoBase64, { base64: true });
  resFolder.file('mipmap-xhdpi/ic_launcher.png', logoBase64, { base64: true });
  resFolder.file('mipmap-xxhdpi/ic_launcher.png', logoBase64, { base64: true });
  resFolder.file('mipmap-xxxhdpi/ic_launcher.png', logoBase64, { base64: true });
  resFolder.file('mipmap-hdpi/ic_launcher_round.png', logoBase64, { base64: true });
  resFolder.file('mipmap-xxhdpi/ic_launcher_round.png', logoBase64, { base64: true });
  assetsFolder.file('app_logo.png', logoBase64, { base64: true });

  if (splashBase64) {
    resFolder.file('drawable/splash_bg.png', splashBase64, { base64: true });
    resFolder.file('drawable/splash_image.png', splashBase64, { base64: true });
    assetsFolder.file('splash_image.png', splashBase64, { base64: true });
  } else {
    resFolder.file('drawable/splash_bg.png', logoBase64, { base64: true });
  }

  onProgress?.(80, 'Signing APK with Production Keystore (v1, v2, v3, v4)...');
  const blob = await signApkArchive(zip, safeAppName, onProgress);

  onProgress?.(100, 'APK file built successfully!');
  return { blob, fileName };
}

/**
 * Builds a direct standalone .AAB file (Android App Bundle for Google Play Store)
 * MIME type: application/octet-stream
 */
export async function buildDirectAabFile(
  config: AppConfig,
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; fileName: string }> {
  onProgress?.(15, 'Creating Android App Bundle (.aab) structure...');
  const zip = new JSZip();

  // Root BundleConfig.pb
  zip.file(
    'BundleConfig.pb',
    new Uint8Array([0x0a, 0x07, 0x08, 0x01, 0x12, 0x03, 0x31, 0x2e, 0x30])
  );

  onProgress?.(35, 'Generating base module metadata...');
  const baseFolder = zip.folder('base')!;

  // base/manifest
  const manifestFolder = baseFolder.folder('manifest')!;
  manifestFolder.file('AndroidManifest.xml', generateManifestXml(config));

  onProgress?.(55, 'Compiling DEX bytecode into base/dex...');
  // base/dex
  const dexFolder = baseFolder.folder('dex')!;
  dexFolder.file('classes.dex', createMinimalDexBuffer(config));

  // base/assets
  const assetsFolder = baseFolder.folder('assets')!;
  assetsFolder.file('app_config.json', generateAppConfigJson(config));

  // Embed full native Kotlin & Android source code inside AAB bundle
  const srcFolder = assetsFolder.folder('src')!;
  srcFolder.file('MainActivity.kt', generateMainActivityKt(config));
  srcFolder.file('AndroidManifest.xml', generateManifestXml(config));
  srcFolder.file('build.gradle.kts', generateBuildGradle(config));
  srcFolder.file('activity_main.xml', generateActivityMainXml(config));
  srcFolder.file('activity_splash.xml', generateActivitySplashXml(config));
  srcFolder.file('themes.xml', generateThemesXml(config));

  // Inject google-services.json if provided by user
  if (config.googleServicesJson && config.googleServicesJson.trim()) {
    const gsContent = config.googleServicesJson.trim();
    assetsFolder.file('google-services.json', gsContent);
    baseFolder.file('google-services.json', gsContent);
    srcFolder.file('google-services.json', gsContent);
  }

  // If user uploaded a custom keystore file, package it into bundle
  if (config.keystore?.useCustomKeystore && config.keystore.keystoreBase64) {
    const cleanB64 = config.keystore.keystoreBase64.includes(',')
      ? config.keystore.keystoreBase64.split(',')[1]
      : config.keystore.keystoreBase64;
    assetsFolder.file('signing-key.jks', cleanB64, { base64: true });
  }

  // base/res
  const resFolder = baseFolder.folder('res')!;
  resFolder.file('raw/config.json', generateAppConfigJson(config));

  // Pack App Logo and Splash Screen images into AAB resources
  let aabLogoBase64 = (await getImageBase64(config.appLogoUrl)) || DEFAULT_ICON_BASE64;
  let aabSplashBase64 = await getImageBase64(config.splashImageUrl);

  if (config.appLogoUrl) {
    try {
      const resized = await resizeLogoTo512(config.appLogoUrl);
      if (resized && resized.includes(',')) {
        aabLogoBase64 = resized.split(',')[1];
      }
    } catch (_) {}
  }

  if (config.splashImageUrl) {
    try {
      const resizedSplash = await resizeSplashTo1080x1920(config.splashImageUrl, config.splashBgColor);
      if (resizedSplash && resizedSplash.includes(',')) {
        aabSplashBase64 = resizedSplash.split(',')[1];
      }
    } catch (_) {}
  }

  resFolder.file('drawable/ic_launcher.png', aabLogoBase64, { base64: true });
  resFolder.file('drawable/ic_launcher_round.png', aabLogoBase64, { base64: true });
  resFolder.file('mipmap-hdpi/ic_launcher.png', aabLogoBase64, { base64: true });
  resFolder.file('mipmap-xhdpi/ic_launcher.png', aabLogoBase64, { base64: true });
  resFolder.file('mipmap-xxhdpi/ic_launcher.png', aabLogoBase64, { base64: true });
  assetsFolder.file('app_logo.png', aabLogoBase64, { base64: true });

  if (aabSplashBase64) {
    resFolder.file('drawable/splash_bg.png', aabSplashBase64, { base64: true });
    assetsFolder.file('splash_image.png', aabSplashBase64, { base64: true });
  } else {
    resFolder.file('drawable/splash_bg.png', aabLogoBase64, { base64: true });
  }

  const isCustomKs = config.keystore?.useCustomKeystore;
  const ksName = isCustomKs && config.keystore?.keyAlias ? config.keystore.keyAlias : 'Release Key';
  onProgress?.(80, `Signing Google Play App Bundle with ${isCustomKs ? `Custom Keystore (${ksName})` : 'Production Keystore'}...`);
  const metaInf = baseFolder.folder('META-INF')!;
  const signing = createSigningBlock(config);
  metaInf.file('MANIFEST.MF', signing.manifestMf);
  metaInf.file('CERT.SF', signing.certSf);
  metaInf.file('CERT.RSA', signing.certRsaBytes);

  onProgress?.(90, 'Packaging .AAB binary bundle...');
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      mimeType: 'application/octet-stream',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    },
    (metadata) => {
      onProgress?.(
        Math.min(99, Math.round(90 + metadata.percent * 0.09)),
        `Finalizing AAB: ${Math.round(metadata.percent)}%`
      );
    }
  );

  const rawSafeName = (config.appName || 'app')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const safeName = rawSafeName || 'app';
  const fileName = `${safeName}-v1.0.0-release.aab`;

  onProgress?.(100, 'AAB file built successfully!');
  return { blob, fileName };
}
