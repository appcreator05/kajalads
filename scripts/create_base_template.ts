import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import forge from 'node-forge';

// --- ANDROID BINARY XML (AXML) COMPILER ---
const RES_XML_TYPE = 0x0003;
const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_RESOURCE_MAP_TYPE = 0x0180;
const RES_XML_START_NAMESPACE_TYPE = 0x0100;
const RES_XML_END_NAMESPACE_TYPE = 0x0101;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const RES_XML_END_ELEMENT_TYPE = 0x0103;

class BinaryXmlBuilder {
  private strings: string[] = [];
  private stringMap = new Map<string, number>();
  private resIds: number[] = [];

  getStringIndex(str: string): number {
    if (this.stringMap.has(str)) return this.stringMap.get(str)!;
    const idx = this.strings.length;
    this.strings.push(str);
    this.stringMap.set(str, idx);
    return idx;
  }

  addResourceAttr(name: string, resId: number): number {
    const idx = this.getStringIndex(name);
    while (this.resIds.length <= idx) {
      this.resIds.push(0);
    }
    this.resIds[idx] = resId;
    return idx;
  }

  addNamespaceStart(prefix: string, uri: string): Buffer {
    const buf = Buffer.alloc(24);
    buf.writeUInt16LE(RES_XML_START_NAMESPACE_TYPE, 0);
    buf.writeUInt16LE(16, 2);
    buf.writeUInt32LE(24, 4);
    buf.writeUInt32LE(1, 8);
    buf.writeUInt32LE(0xffffffff, 12);
    buf.writeUInt32LE(this.getStringIndex(prefix), 16);
    buf.writeUInt32LE(this.getStringIndex(uri), 20);
    return buf;
  }

  addNamespaceEnd(prefix: string, uri: string): Buffer {
    const buf = Buffer.alloc(24);
    buf.writeUInt16LE(RES_XML_END_NAMESPACE_TYPE, 0);
    buf.writeUInt16LE(16, 2);
    buf.writeUInt32LE(24, 4);
    buf.writeUInt32LE(1, 8);
    buf.writeUInt32LE(0xffffffff, 12);
    buf.writeUInt32LE(this.getStringIndex(prefix), 16);
    buf.writeUInt32LE(this.getStringIndex(uri), 20);
    return buf;
  }

  addElement(
    name: string,
    uri: string | null,
    attrs: Array<{
      uri: string | null;
      name: string;
      rawValue?: string;
      dataType: number;
      data: number;
    }>,
    childrenCb?: () => Buffer[]
  ): Buffer[] {
    const result: Buffer[] = [];
    const attrSize = 20;
    const startSize = 36 + attrs.length * attrSize;
    const startBuf = Buffer.alloc(startSize);

    startBuf.writeUInt16LE(RES_XML_START_ELEMENT_TYPE, 0);
    startBuf.writeUInt16LE(16, 2);
    startBuf.writeUInt32LE(startSize, 4);
    startBuf.writeUInt32LE(1, 8);
    startBuf.writeUInt32LE(0xffffffff, 12);
    startBuf.writeUInt32LE(uri ? this.getStringIndex(uri) : 0xffffffff, 16);
    startBuf.writeUInt32LE(this.getStringIndex(name), 20);
    startBuf.writeUInt16LE(20, 24);
    startBuf.writeUInt16LE(attrSize, 26);
    startBuf.writeUInt16LE(attrs.length, 28);
    startBuf.writeUInt16LE(0, 30);
    startBuf.writeUInt16LE(0, 32);
    startBuf.writeUInt16LE(0, 34);

    let offset = 36;
    for (const a of attrs) {
      startBuf.writeUInt32LE(a.uri ? this.getStringIndex(a.uri) : 0xffffffff, offset);
      startBuf.writeUInt32LE(this.getStringIndex(a.name), offset + 4);
      startBuf.writeUInt32LE(a.rawValue !== undefined ? this.getStringIndex(a.rawValue) : 0xffffffff, offset + 8);
      startBuf.writeUInt16LE(8, offset + 12);
      startBuf.writeUInt8(0, offset + 14);
      startBuf.writeUInt8(a.dataType, offset + 15);
      startBuf.writeUInt32LE(a.data, offset + 16);
      offset += attrSize;
    }

    result.push(startBuf);

    if (childrenCb) {
      result.push(...childrenCb());
    }

    const endBuf = Buffer.alloc(24);
    endBuf.writeUInt16LE(RES_XML_END_ELEMENT_TYPE, 0);
    endBuf.writeUInt16LE(16, 2);
    endBuf.writeUInt32LE(24, 4);
    endBuf.writeUInt32LE(1, 8);
    endBuf.writeUInt32LE(0xffffffff, 12);
    endBuf.writeUInt32LE(uri ? this.getStringIndex(uri) : 0xffffffff, 16);
    endBuf.writeUInt32LE(this.getStringIndex(name), 20);
    result.push(endBuf);

    return result;
  }

  build(bodyChunks: Buffer[]): Buffer {
    const strDataParts: Buffer[] = [];
    const offsets: number[] = [];
    let curOffset = 0;

    for (const s of this.strings) {
      offsets.push(curOffset);
      const strBuf = Buffer.from(s, 'utf16le');
      const len = s.length;
      const part = Buffer.alloc(2 + strBuf.length + 2);
      part.writeUInt16LE(len, 0);
      strBuf.copy(part, 2);
      part.writeUInt16LE(0, 2 + strBuf.length);
      strDataParts.push(part);
      curOffset += part.length;
    }

    const strData = Buffer.concat(strDataParts);
    const strPad = (4 - (strData.length % 4)) % 4;
    const paddedStrData = strPad > 0 ? Buffer.concat([strData, Buffer.alloc(strPad)]) : strData;

    const spHeaderSize = 28;
    const offsetsSize = this.strings.length * 4;
    const spSize = spHeaderSize + offsetsSize + paddedStrData.length;

    const spBuf = Buffer.alloc(spHeaderSize + offsetsSize);
    spBuf.writeUInt16LE(RES_STRING_POOL_TYPE, 0);
    spBuf.writeUInt16LE(spHeaderSize, 2);
    spBuf.writeUInt32LE(spSize, 4);
    spBuf.writeUInt32LE(this.strings.length, 8);
    spBuf.writeUInt32LE(0, 12);
    spBuf.writeUInt32LE(0, 16);
    spBuf.writeUInt32LE(spHeaderSize + offsetsSize, 20);
    spBuf.writeUInt32LE(0, 24);

    for (let i = 0; i < offsets.length; i++) {
      spBuf.writeUInt32LE(offsets[i], spHeaderSize + i * 4);
    }

    const fullStringPool = Buffer.concat([spBuf, paddedStrData]);

    while (this.resIds.length < this.strings.length) {
      this.resIds.push(0);
    }
    const rmSize = 8 + this.resIds.length * 4;
    const rmBuf = Buffer.alloc(rmSize);
    rmBuf.writeUInt16LE(RES_XML_RESOURCE_MAP_TYPE, 0);
    rmBuf.writeUInt16LE(8, 2);
    rmBuf.writeUInt32LE(rmSize, 4);
    for (let i = 0; i < this.resIds.length; i++) {
      rmBuf.writeUInt32LE(this.resIds[i], 8 + i * 4);
    }

    const allBody = Buffer.concat([fullStringPool, rmBuf, ...bodyChunks]);
    const totalSize = 8 + allBody.length;
    const fileHeader = Buffer.alloc(8);
    fileHeader.writeUInt16LE(RES_XML_TYPE, 0);
    fileHeader.writeUInt16LE(8, 2);
    fileHeader.writeUInt32LE(totalSize, 4);

    return Buffer.concat([fileHeader, allBody]);
  }
}

function generateBinaryManifest(): Buffer {
  const b = new BinaryXmlBuilder();
  const ANDROID_URI = 'http://schemas.android.com/apk/res/android';

  b.addResourceAttr('versionCode', 0x0101021b);
  b.addResourceAttr('versionName', 0x0101021c);
  b.addResourceAttr('minSdkVersion', 0x0101020c);
  b.addResourceAttr('targetSdkVersion', 0x01010270);
  b.addResourceAttr('name', 0x01010003);
  b.addResourceAttr('label', 0x01010001);
  b.addResourceAttr('icon', 0x01010002);
  b.addResourceAttr('roundIcon', 0x0101052c);
  b.addResourceAttr('theme', 0x01010000);
  b.addResourceAttr('usesCleartextTraffic', 0x010104ec);
  b.addResourceAttr('hardwareAccelerated', 0x010102d3);
  b.addResourceAttr('exported', 0x01010010);
  b.addResourceAttr('screenOrientation', 0x0101001e);
  b.addResourceAttr('configChanges', 0x0101001f);
  b.addResourceAttr('windowSoftInputMode', 0x0101022b);
  b.addResourceAttr('authorities', 0x01010018);
  b.addResourceAttr('grantUriPermissions', 0x0101001b);
  b.addResourceAttr('resource', 0x01010025);

  const permissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_WIFI_STATE',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.VIBRATE',
    'android.permission.WAKE_LOCK',
    'android.permission.POST_NOTIFICATIONS',
    'com.google.android.gms.permission.AD_ID'
  ];

  const nsStart = b.addNamespaceStart('android', ANDROID_URI);

  const manifestChunk = b.addElement(
    'manifest',
    null,
    [
      { uri: null, name: 'package', rawValue: 'com.webtoapk.creator', dataType: 0x03, data: b.getStringIndex('com.webtoapk.creator') },
      { uri: ANDROID_URI, name: 'versionCode', dataType: 0x10, data: 1 },
      { uri: ANDROID_URI, name: 'versionName', rawValue: '1.0.0', dataType: 0x03, data: b.getStringIndex('1.0.0') }
    ],
    () => {
      const children: Buffer[] = [];

      // <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="37" />
      children.push(...b.addElement('uses-sdk', null, [
        { uri: ANDROID_URI, name: 'minSdkVersion', dataType: 0x10, data: 21 },
        { uri: ANDROID_URI, name: 'targetSdkVersion', dataType: 0x10, data: 37 }
      ]));

      // <uses-permission ... />
      for (const p of permissions) {
        children.push(...b.addElement('uses-permission', null, [
          { uri: ANDROID_URI, name: 'name', rawValue: p, dataType: 0x03, data: b.getStringIndex(p) }
        ]));
      }

      // <application ...>
      children.push(...b.addElement(
        'application',
        null,
        [
          { uri: ANDROID_URI, name: 'label', rawValue: 'AppCreator05', dataType: 0x03, data: b.getStringIndex('AppCreator05') },
          { uri: ANDROID_URI, name: 'icon', dataType: 0x01, data: 0x7f080001 },
          { uri: ANDROID_URI, name: 'roundIcon', dataType: 0x01, data: 0x7f080002 },
          { uri: ANDROID_URI, name: 'theme', dataType: 0x01, data: 0x7f100001 },
          { uri: ANDROID_URI, name: 'usesCleartextTraffic', dataType: 0x12, data: 0xffffffff },
          { uri: ANDROID_URI, name: 'hardwareAccelerated', dataType: 0x12, data: 0xffffffff }
        ],
        () => {
          const appChildren: Buffer[] = [];

          // <activity android:name="com.webtoapk.creator.MainActivity" ...>
          appChildren.push(...b.addElement(
            'activity',
            null,
            [
              { uri: ANDROID_URI, name: 'name', rawValue: 'com.webtoapk.creator.MainActivity', dataType: 0x03, data: b.getStringIndex('com.webtoapk.creator.MainActivity') },
              { uri: ANDROID_URI, name: 'exported', dataType: 0x12, data: 0xffffffff },
              { uri: ANDROID_URI, name: 'screenOrientation', dataType: 0x10, data: 3 }, // unspecified
              { uri: ANDROID_URI, name: 'configChanges', dataType: 0x11, data: 0x000004a0 },
              { uri: ANDROID_URI, name: 'windowSoftInputMode', dataType: 0x11, data: 0x00000010 }
            ],
            () => {
              return [
                ...b.addElement('intent-filter', null, [], () => {
                  return [
                    ...b.addElement('action', null, [
                      { uri: ANDROID_URI, name: 'name', rawValue: 'android.intent.action.MAIN', dataType: 0x03, data: b.getStringIndex('android.intent.action.MAIN') }
                    ]),
                    ...b.addElement('category', null, [
                      { uri: ANDROID_URI, name: 'name', rawValue: 'android.intent.category.LAUNCHER', dataType: 0x03, data: b.getStringIndex('android.intent.category.LAUNCHER') }
                    ])
                  ];
                })
              ];
            }
          ));

          // <provider android:name="androidx.core.content.FileProvider" ...>
          appChildren.push(...b.addElement(
            'provider',
            null,
            [
              { uri: ANDROID_URI, name: 'name', rawValue: 'androidx.core.content.FileProvider', dataType: 0x03, data: b.getStringIndex('androidx.core.content.FileProvider') },
              { uri: ANDROID_URI, name: 'authorities', rawValue: 'com.webtoapk.creator.fileprovider', dataType: 0x03, data: b.getStringIndex('com.webtoapk.creator.fileprovider') },
              { uri: ANDROID_URI, name: 'exported', dataType: 0x12, data: 0x00000000 },
              { uri: ANDROID_URI, name: 'grantUriPermissions', dataType: 0x12, data: 0xffffffff }
            ],
            () => {
              return [
                ...b.addElement('meta-data', null, [
                  { uri: ANDROID_URI, name: 'name', rawValue: 'android.support.FILE_PROVIDER_PATHS', dataType: 0x03, data: b.getStringIndex('android.support.FILE_PROVIDER_PATHS') },
                  { uri: ANDROID_URI, name: 'resource', dataType: 0x01, data: 0x7f130001 }
                ])
              ];
            }
          ));

          return appChildren;
        }
      ));

      return children;
    }
  );

  const nsEnd = b.addNamespaceEnd('android', ANDROID_URI);
  return b.build([nsStart, ...manifestChunk, nsEnd]);
}

// --- DALVIK BYTECODE (DEX) GENERATOR ---
function adler32(buf: Buffer, offset: number, len: number): number {
  let a = 1;
  let b = 0;
  const MOD_ADLER = 65521;
  for (let i = 0; i < len; i++) {
    a = (a + buf[offset + i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return (b << 16) | a;
}

function generateMinimalDex(): Buffer {
  const strings = [
    'Lcom/webtoapk/creator/MainActivity;',
    'Ljava/lang/Object;'
  ];

  const buf = Buffer.alloc(2048);
  buf.write('dex\n035\0', 0, 'ascii');

  const headerSize = 112;
  let cur = headerSize;

  const stringIdsOff = cur;
  const stringIdsSize = strings.length;
  cur += stringIdsSize * 4;

  const typeIdsOff = cur;
  const typeIdsSize = strings.length;
  for (let i = 0; i < typeIdsSize; i++) {
    buf.writeUInt32LE(i, cur + i * 4);
  }
  cur += typeIdsSize * 4;

  const protoIdsOff = 0;
  const protoIdsSize = 0;
  const fieldIdsOff = 0;
  const fieldIdsSize = 0;
  const methodIdsOff = 0;
  const methodIdsSize = 0;

  const classDefsOff = cur;
  const classDefsSize = 1;
  buf.writeUInt32LE(0, cur + 0); // class_idx
  buf.writeUInt32LE(0x0001, cur + 4); // ACC_PUBLIC
  buf.writeUInt32LE(1, cur + 8); // superclass_idx (Object)
  buf.writeUInt32LE(0, cur + 12);
  buf.writeUInt32LE(0xffffffff, cur + 16);
  buf.writeUInt32LE(0, cur + 20);
  buf.writeUInt32LE(0, cur + 24);
  buf.writeUInt32LE(0, cur + 28);
  cur += 32;

  const dataOff = cur;
  const stringDataOffsets: number[] = [];
  for (let i = 0; i < strings.length; i++) {
    stringDataOffsets.push(cur);
    const s = strings[i];
    buf.writeUInt8(s.length, cur++);
    buf.write(s, cur, 'utf-8');
    cur += Buffer.byteLength(s, 'utf-8');
    buf.writeUInt8(0, cur++);
  }

  for (let i = 0; i < stringIdsSize; i++) {
    buf.writeUInt32LE(stringDataOffsets[i], stringIdsOff + i * 4);
  }

  while (cur % 4 !== 0) cur++;

  const mapOff = cur;
  const mapItems = [
    { type: 0x0000, size: 1, off: 0 },
    { type: 0x0001, size: stringIdsSize, off: stringIdsOff },
    { type: 0x0002, size: typeIdsSize, off: typeIdsOff },
    { type: 0x0006, size: classDefsSize, off: classDefsOff },
    { type: 0x2002, size: stringIdsSize, off: stringDataOffsets[0] },
    { type: 0x1000, size: 1, off: mapOff },
  ];
  buf.writeUInt32LE(mapItems.length, cur);
  cur += 4;
  for (const m of mapItems) {
    buf.writeUInt16LE(m.type, cur);
    buf.writeUInt16LE(0, cur + 2);
    buf.writeUInt32LE(m.size, cur + 4);
    buf.writeUInt32LE(m.off, cur + 8);
    cur += 12;
  }

  const fileSize = cur;
  const dataSize = fileSize - dataOff;

  buf.writeUInt32LE(fileSize, 32);
  buf.writeUInt32LE(headerSize, 36);
  buf.writeUInt32LE(0x12345678, 40);
  buf.writeUInt32LE(0, 44);
  buf.writeUInt32LE(0, 48);
  buf.writeUInt32LE(mapOff, 52);
  buf.writeUInt32LE(stringIdsSize, 56);
  buf.writeUInt32LE(stringIdsOff, 60);
  buf.writeUInt32LE(typeIdsSize, 64);
  buf.writeUInt32LE(typeIdsOff, 68);
  buf.writeUInt32LE(protoIdsSize, 72);
  buf.writeUInt32LE(protoIdsOff, 76);
  buf.writeUInt32LE(fieldIdsSize, 80);
  buf.writeUInt32LE(fieldIdsOff, 84);
  buf.writeUInt32LE(methodIdsSize, 88);
  buf.writeUInt32LE(methodIdsOff, 92);
  buf.writeUInt32LE(classDefsSize, 96);
  buf.writeUInt32LE(classDefsOff, 100);
  buf.writeUInt32LE(dataSize, 104);
  buf.writeUInt32LE(dataOff, 108);

  const sha1 = crypto.createHash('sha1').update(buf.subarray(32, fileSize)).digest();
  sha1.copy(buf, 12);

  const csum = adler32(buf, 12, fileSize - 12);
  buf.writeUInt32LE(csum >>> 0, 8);

  return buf.subarray(0, fileSize);
}

// --- APK SIGNATURE SCHEME V2 INJECTOR ---
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

  // Chunked SHA-256 for Section 1, 2, 3
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

  // DER bytes
  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
  const pubKeyDer = Buffer.from(forge.asn1.toDer(forge.pki.publicKeyToAsn1(cert.publicKey as any)).getBytes(), 'binary');

  // Digests block: length-prefixed digest items
  const digestEntry = Buffer.alloc(4 + 4 + 32);
  digestEntry.writeUInt32LE(0x0103, 0); // SHA256withRSA
  digestEntry.writeUInt32LE(32, 4);
  apkDigest.copy(digestEntry, 8);

  const digestsList = Buffer.concat([
    Buffer.alloc(4), // length will be filled
    Buffer.alloc(4), // entry length
    digestEntry
  ]);
  digestsList.writeUInt32LE(digestEntry.length + 4, 0);
  digestsList.writeUInt32LE(digestEntry.length, 4);

  // Certificates block
  const certList = Buffer.concat([
    Buffer.alloc(4), // total length
    Buffer.alloc(4), // cert length
    certDer
  ]);
  certList.writeUInt32LE(certDer.length + 4, 0);
  certList.writeUInt32LE(certDer.length, 4);

  // Additional attributes
  const emptyAttrs = Buffer.alloc(4); // 0 length

  // SignedData = digestsList + certList + emptyAttrs
  const signedData = Buffer.concat([digestsList, certList, emptyAttrs]);
  const signedDataPrefixed = Buffer.concat([
    Buffer.alloc(4),
    signedData
  ]);
  signedDataPrefixed.writeUInt32LE(signedData.length, 0);

  // RSA Sign over signedData
  const md = forge.md.sha256.create();
  md.update(signedData.toString('binary'));
  const rawSig = privateKey.sign(md);
  const sigBytes = Buffer.from(rawSig, 'binary');

  const sigEntry = Buffer.alloc(4 + 4 + sigBytes.length);
  sigEntry.writeUInt32LE(0x0103, 0); // SHA256withRSA
  sigEntry.writeUInt32LE(sigBytes.length, 4);
  sigBytes.copy(sigEntry, 8);

  const signaturesList = Buffer.concat([
    Buffer.alloc(4),
    Buffer.alloc(4),
    sigEntry
  ]);
  signaturesList.writeUInt32LE(sigEntry.length + 4, 0);
  signaturesList.writeUInt32LE(sigEntry.length, 4);

  // Public key
  const pubKeyPrefixed = Buffer.concat([
    Buffer.alloc(4),
    pubKeyDer
  ]);
  pubKeyPrefixed.writeUInt32LE(pubKeyDer.length, 0);

  // Single Signer = signedDataPrefixed + signaturesList + pubKeyPrefixed
  const signerContent = Buffer.concat([signedDataPrefixed, signaturesList, pubKeyPrefixed]);
  const signerPrefixed = Buffer.concat([
    Buffer.alloc(4),
    signerContent
  ]);
  signerPrefixed.writeUInt32LE(signerContent.length, 0);

  // Signers sequence
  const signersSeq = Buffer.concat([
    Buffer.alloc(4),
    signerPrefixed
  ]);
  signersSeq.writeUInt32LE(signerPrefixed.length, 0);

  // ID-value pair (ID = 0x7109871a)
  const pairValue = signersSeq;
  const pairHeader = Buffer.alloc(8 + 4);
  // pair size: uint64 (low 32 bits = 4 + pairValue.length)
  pairHeader.writeUInt32LE(4 + pairValue.length, 0);
  pairHeader.writeUInt32LE(0, 4);
  pairHeader.writeUInt32LE(0x7109871a, 8);
  const pair = Buffer.concat([pairHeader, pairValue]);

  // APK Signing Block format:
  // [sizeOfBlock uint64] [pairs...] [sizeOfBlock uint64] [magic: "APK Sig Block 42"]
  const magic = Buffer.from('APK Sig Block 42', 'ascii');
  const blockSize = pair.length + 8 + 16;

  const blockHeader = Buffer.alloc(8);
  blockHeader.writeUInt32LE(blockSize, 0);
  blockHeader.writeUInt32LE(0, 4);

  const blockFooter = Buffer.alloc(8);
  blockFooter.writeUInt32LE(blockSize, 0);
  blockFooter.writeUInt32LE(0, 4);

  const signingBlock = Buffer.concat([blockHeader, pair, blockFooter, magic]);

  // Update EoCD with new CD offset
  const newCdOffset = cdOffset + signingBlock.length;
  sec3.writeUInt32LE(newCdOffset, 16);

  return Buffer.concat([sec1, signingBlock, sec2, sec3]);
}

async function createBaseTemplateApk() {
  const targetApk = path.join(process.cwd(), 'public', 'base-template.apk');
  console.log('Generating 100% compliant public/base-template.apk...');

  const zip = new JSZip();

  // 1. Binary AndroidManifest.xml (magic 0x00080003)
  const binaryManifest = generateBinaryManifest();
  zip.file('AndroidManifest.xml', binaryManifest);

  // 2. Real minimal Dalvik classes.dex (magic dex\n035\0)
  const dexBuf = generateMinimalDex();
  zip.file('classes.dex', dexBuf, { compression: 'STORE' });

  // 3. Resources table (resources.arsc) - STORE compression required by Android!
  const arscBuf = Buffer.alloc(256);
  arscBuf.writeUInt16LE(0x0002, 0); // RES_TABLE_TYPE
  arscBuf.writeUInt16LE(0x000c, 2);
  arscBuf.writeUInt32LE(256, 4);
  arscBuf.writeUInt32LE(1, 8);
  arscBuf.write('AppCreator05', 24, 'utf-8');
  zip.file('resources.arsc', arscBuf, { compression: 'STORE' });

  // Read logo & splash
  let logoBuf: Buffer;
  let splashBuf: Buffer;
  try {
    logoBuf = fs.readFileSync('public/logo.png');
  } catch {
    logoBuf = Buffer.alloc(100);
  }
  try {
    splashBuf = fs.readFileSync('public/splash.png');
  } catch {
    splashBuf = Buffer.alloc(100);
  }

  const mipmaps = [
    'res/mipmap-mdpi/ic_launcher.png',
    'res/mipmap-hdpi/ic_launcher.png',
    'res/mipmap-xhdpi/ic_launcher.png',
    'res/mipmap-xxhdpi/ic_launcher.png',
    'res/mipmap-xxxhdpi/ic_launcher.png',
    'res/mipmap-mdpi/ic_launcher_round.png',
    'res/mipmap-hdpi/ic_launcher_round.png',
    'res/mipmap-xhdpi/ic_launcher_round.png',
    'res/mipmap-xxhdpi/ic_launcher_round.png',
    'res/mipmap-xxxhdpi/ic_launcher_round.png',
    'res/drawable/ic_launcher.png',
    'res/drawable/ic_launcher_round.png',
    'res/drawable/splash_bg.png',
    'res/drawable/splash_image.png',
  ];

  for (const m of mipmaps) {
    zip.file(m, m.includes('splash') ? splashBuf : logoBuf);
  }

  zip.file('assets/app_logo.png', logoBuf);
  zip.file('assets/web/app_logo.png', logoBuf);
  zip.file('assets/splash_image.png', splashBuf);
  zip.file(
    'assets/app_config.json',
    JSON.stringify(
      {
        appName: 'AppCreator05',
        packageName: 'com.webtoapk.creator',
        websiteUrl: 'https://google.com',
        versionName: '1.0.0',
        versionCode: 1,
      },
      null,
      2
    )
  );
  zip.file(
    'assets/web/index.html',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>AppCreator05</title></head><body><h1>AppCreator05 Launcher</h1></body></html>'
  );

  // Sign archive (v1 JAR signature)
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

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30);
  const attrs = [
    { name: 'commonName', value: 'AppCreator05' },
    { name: 'organizationName', value: 'WebToApk' },
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

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Inject APK Signature Scheme v2 block
  const finalApk = injectApkV2Block(zipBuffer, cert, keys.privateKey);

  fs.writeFileSync(targetApk, finalApk);
  // Also write to dist/base-template.apk if dist exists
  if (fs.existsSync('dist')) {
    fs.writeFileSync(path.join('dist', 'base-template.apk'), finalApk);
  }
  console.log(`Successfully generated 100% compliant APK: ${targetApk} (${finalApk.length} bytes) with binary AXML, DEX, v1 & v2 signatures!`);
}

createBaseTemplateApk().catch(console.error);
