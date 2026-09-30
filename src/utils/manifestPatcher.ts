import { AppConfig, AppPermissions } from '../types';

/**
 * Patches the compiled Android binary XML (AXML) AndroidManifest.xml to:
 * 1. Update the application package name, app label/name, version name, and component authorities
 *    (FileProvider, StartupProvider, Dynamic Receiver permissions) so the APK is recognized as a
 *    completely distinct and independent application on Android.
 * 2. Set the requested Activity screenOrientation (landscape / portrait / auto-rotate) so that
 *    Android OS locks the Activity into the exact orientation the user selected!
 *    Crucial Android OS specification: The Resource Map (ResMap) chunk 0x00080180 MUST remain in
 *    strictly ascending sorted order (0x0101001e inserted at index 11), with string indices
 *    accurately remapped throughout all XML chunks.
 */
export function patchBinaryAndroidManifest(
  buf: Uint8Array,
  config: AppConfig
): Uint8Array {
  try {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== 0x00080003) {
      console.warn('Not a valid Android binary XML (AXML) file. Magic:', magic.toString(16));
      return buf;
    }

    const spChunkType = view.getUint32(8, true);
    if (spChunkType !== 0x001c0001) {
      console.warn('First chunk is not StringPool (0x001c0001). Found:', spChunkType.toString(16));
      return buf;
    }

    const spOrigSize = view.getUint32(12, true);
    const stringCount = view.getUint32(16, true);
    const styleCount = view.getUint32(20, true);
    const spFlags = view.getUint32(24, true);
    const spStringsStart = view.getUint32(28, true);
    const spStylesStart = view.getUint32(32, true);

    const absStringsStart = 8 + spStringsStart;
    const strings: string[] = [];
    const origStrings: string[] = [];
    for (let i = 0; i < stringCount; i++) {
      const offset = view.getUint32(36 + i * 4, true);
      const strPos = absStringsStart + offset;
      const len = view.getUint16(strPos, true);
      let str = '';
      for (let c = 0; c < len; c++) {
        str += String.fromCharCode(view.getUint16(strPos + 2 + c * 2, true));
      }
      strings.push(str);
      origStrings.push(str);
    }

    // 1. Sanitize and format the new package name
    let rawPkg = (config.packageName || 'com.app.webtoapk').trim().toLowerCase();
    rawPkg = rawPkg.replace(/[^a-z0-9_.]/g, '_').replace(/_+/g, '_');
    const segments = rawPkg.split('.').filter(Boolean);
    const validSegments = segments.map((seg) => {
      if (/^[0-9_]/.test(seg)) {
        return `app_${seg}`;
      }
      return seg;
    });
    let finalPkg = validSegments.join('.');
    if (!finalPkg.includes('.')) {
      finalPkg = `com.app.${finalPkg || 'mywebsite'}`;
    }

    const appName = (config.appName || 'My App').trim();
    const versionName = (config.versionName || '1.0.0').trim();

    // Map known string pool indices in base-template.apk
    for (let i = 0; i < strings.length; i++) {
      const s = strings[i];
      if (s === 'com.webtoapk.creator') {
        strings[i] = finalPkg;
      } else if (s === 'com.webtoapk.creator.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION') {
        strings[i] = `${finalPkg}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`;
      } else if (s === 'com.webtoapk.creator.androidx-startup') {
        strings[i] = `${finalPkg}.androidx-startup`;
      } else if (s === 'com.webtoapk.creator.fileprovider') {
        strings[i] = `${finalPkg}.fileprovider`;
      } else if (i === 32 || s === 'APK Creator') {
        strings[i] = appName;
      } else if (i === 30 || s === '1.0.0') {
        if (versionName) strings[i] = versionName;
      }
    }

    // 2. Determine target screenOrientation integer value for Android
    // In Android ActivityInfo:
    // SCREEN_ORIENTATION_LANDSCAPE = 0
    // SCREEN_ORIENTATION_PORTRAIT = 1
    // SCREEN_ORIENTATION_SENSOR_LANDSCAPE = 6
    // SCREEN_ORIENTATION_SENSOR = 4
    // SCREEN_ORIENTATION_UNSPECIFIED = -1
    let orientVal = -1;
    const orientation = config.orientation || 'auto_rotate';
    if (orientation === 'landscape') {
      orientVal = 0; // Landscape locked (even if phone is locked in portrait!)
    } else if (orientation === 'portrait') {
      orientVal = 1; // Portrait locked
    } else if (orientation === 'auto_rotate') {
      orientVal = -1; // Auto-rotate
    }

    // 3. Read ResMap chunk (0x00080180)
    const rmOff = 8 + spOrigSize;
    const rmType = view.getUint32(rmOff, true);
    const rmOrigSize = view.getUint32(rmOff + 4, true);
    const rmOrigCount = (rmOrigSize - 8) / 4;

    const origResIds: number[] = [];
    for (let i = 0; i < rmOrigCount; i++) {
      origResIds.push(view.getUint32(rmOff + 8 + i * 4, true));
    }
    const resIds = [...origResIds];

    // The Android AssetManager strictly requires the ResMap array to be in ascending order.
    // 0x0101001e (android.R.attr.screenOrientation) belongs between 0x0101001b (idx 10) and 0x0101001f (idx 11).
    // Therefore, it must be inserted at position 11 in both strings and resIds.
    const shouldAddOrient = orientVal !== -1;
    const INSERT_POS = 11;
    const RES_ID_SCREEN_ORIENTATION = 0x0101001e;

    if (shouldAddOrient) {
      strings.splice(INSERT_POS, 0, 'screenOrientation');
      resIds.splice(INSERT_POS, 0, RES_ID_SCREEN_ORIENTATION);
    }

    function remap(idx: number): number {
      if (!shouldAddOrient || idx === 0xffffffff || idx === undefined) return idx;
      return idx >= INSERT_POS ? idx + 1 : idx;
    }

    // 4. Collect requested permissions to inject into AndroidManifest.xml
    const permissionsToEnsure: string[] = [];
    const p: Partial<AppPermissions> = config.permissions || {};
    if (p.internet !== false) permissionsToEnsure.push('android.permission.INTERNET');
    if (p.accessNetworkState !== false) permissionsToEnsure.push('android.permission.ACCESS_NETWORK_STATE');
    permissionsToEnsure.push('android.permission.ACCESS_WIFI_STATE');
    if (p.accessCoarseLocation || config.enableGpsPrompt) permissionsToEnsure.push('android.permission.ACCESS_COARSE_LOCATION');
    if (p.accessFineLocation || config.enableGpsPrompt) permissionsToEnsure.push('android.permission.ACCESS_FINE_LOCATION');
    if (p.camera) permissionsToEnsure.push('android.permission.CAMERA');
    if (p.readExternalStorage) permissionsToEnsure.push('android.permission.READ_EXTERNAL_STORAGE');
    if (p.writeExternalStorage) permissionsToEnsure.push('android.permission.WRITE_EXTERNAL_STORAGE');
    if (p.recordAudio) {
      permissionsToEnsure.push('android.permission.RECORD_AUDIO');
      permissionsToEnsure.push('android.permission.MODIFY_AUDIO_SETTINGS');
    }
    if (p.vibrate) permissionsToEnsure.push('android.permission.VIBRATE');
    if (p.postNotifications !== false) permissionsToEnsure.push('android.permission.POST_NOTIFICATIONS');
    if (config.adNetwork === 'admob' || config.adNetwork === 'startio') {
      permissionsToEnsure.push('com.google.android.gms.permission.AD_ID');
    }

    // Ensure all permission strings exist in string pool (appended after INSERT_POS)
    const permStringMap = new Map<string, number>();
    for (const perm of permissionsToEnsure) {
      let idx = strings.indexOf(perm);
      if (idx === -1) {
        idx = strings.length;
        strings.push(perm);
      }
      permStringMap.set(perm, idx);
    }

    const usesPermStrIdx = remap(origStrings.indexOf('uses-permission'));
    const nameAttrIdx = remap(origStrings.indexOf('name'));
    const origNsIdx = origStrings.indexOf('http://schemas.android.com/apk/res/android');
    const androidNsIdx = remap(origNsIdx !== -1 ? origNsIdx : 65);

    // 5. Re-encode StringPool in UTF-16LE
    const newOffsets: number[] = [];
    let currentOffset = 0;
    const strDataChunks: Uint8Array[] = [];

    for (let i = 0; i < strings.length; i++) {
      newOffsets.push(currentOffset);
      const s = strings[i];
      const charLen = s.length;
      const chunkLen = 2 + charLen * 2 + 2;
      const chunk = new Uint8Array(chunkLen);
      const cView = new DataView(chunk.buffer);
      cView.setUint16(0, charLen, true);
      for (let c = 0; c < charLen; c++) {
        cView.setUint16(2 + c * 2, s.charCodeAt(c), true);
      }
      cView.setUint16(2 + charLen * 2, 0, true); // null terminator
      strDataChunks.push(chunk);
      currentOffset += chunkLen;
    }

    const remainder = currentOffset % 4;
    const paddingBytes = remainder === 0 ? 0 : 4 - remainder;
    const headerAndOffsetsSize = 28 + strings.length * 4 + styleCount * 4;
    const newSpChunkSize = headerAndOffsetsSize + currentOffset + paddingBytes;

    const newSpHeader = new Uint8Array(headerAndOffsetsSize);
    const nspView = new DataView(newSpHeader.buffer);
    nspView.setUint32(0, spChunkType, true);
    nspView.setUint32(4, newSpChunkSize, true);
    nspView.setUint32(8, strings.length, true);
    nspView.setUint32(12, styleCount, true);
    nspView.setUint32(16, spFlags, true);
    nspView.setUint32(20, headerAndOffsetsSize, true);
    nspView.setUint32(24, spStylesStart, true);

    for (let i = 0; i < strings.length; i++) {
      nspView.setUint32(28 + i * 4, newOffsets[i], true);
    }

    // 5. Re-encode ResMap chunk
    const newRmSize = 8 + resIds.length * 4;
    const newRm = new Uint8Array(newRmSize);
    const nrmView = new DataView(newRm.buffer);
    nrmView.setUint32(0, rmType, true);
    nrmView.setUint32(4, newRmSize, true);
    for (let i = 0; i < resIds.length; i++) {
      nrmView.setUint32(8 + i * 4, resIds[i], true);
    }

    // 6. Process XML chunks: patch <activity> with android:screenOrientation & inject permissions
    const xmlStart = rmOff + rmOrigSize;
    let curOff = xmlStart;
    const xmlChunks: Uint8Array[] = [];
    let patchedActivity = false;
    let injectedExtraPerms = false;
    let skipNextEndElement = false;
    const emittedPerms = new Set<string>();

    function createUsesPermissionChunks(
      uPermIdx: number,
      aNsIdx: number,
      nAttrIdx: number,
      pStrIdx: number
    ): Uint8Array[] {
      const startChunk = new Uint8Array(56);
      const sView = new DataView(startChunk.buffer);
      sView.setUint32(0, 0x00100102, true); // START_ELEMENT
      sView.setUint32(4, 56, true);         // Chunk size
      sView.setUint32(8, 11, true);         // Line number
      sView.setUint32(12, 0xffffffff, true);// Comment
      sView.setUint32(16, 0xffffffff, true);// Namespace
      sView.setUint32(20, uPermIdx, true);  // "uses-permission"
      sView.setUint16(24, 0x0014, true);    // Attr start (20)
      sView.setUint16(26, 0x0014, true);    // Attr size (20)
      sView.setUint16(28, 1, true);         // Attr count (1)
      sView.setUint16(30, 0, true);         // idIndex
      sView.setUint16(32, 0, true);         // classIndex
      sView.setUint16(34, 0, true);         // styleIndex

      sView.setUint32(36, aNsIdx, true);    // android schema ns
      sView.setUint32(40, nAttrIdx, true);  // "name" attr
      sView.setUint32(44, pStrIdx, true);   // rawVal
      sView.setUint16(48, 8, true);         // size
      sView.setUint8(50, 0);                // res0
      sView.setUint8(51, 3);                // TYPE_STRING
      sView.setUint32(52, pStrIdx, true);   // data

      const endChunk = new Uint8Array(24);
      const eView = new DataView(endChunk.buffer);
      eView.setUint32(0, 0x00100103, true); // END_ELEMENT
      eView.setUint32(4, 24, true);         // Chunk size
      eView.setUint32(8, 11, true);         // Line number
      eView.setUint32(12, 0xffffffff, true);// Comment
      eView.setUint32(16, 0xffffffff, true);// Namespace
      eView.setUint32(20, uPermIdx, true);  // "uses-permission"

      return [startChunk, endChunk];
    }

    while (curOff < buf.length) {
      const chunkType = view.getUint32(curOff, true);
      const chunkSize = view.getUint32(curOff + 4, true);

      if (chunkType === 0x00100100 || chunkType === 0x00100101) { // START_NAMESPACE / END_NAMESPACE
        const chunkBuf = new Uint8Array(chunkSize);
        chunkBuf.set(buf.subarray(curOff, curOff + chunkSize), 0);
        const cView = new DataView(chunkBuf.buffer);
        cView.setUint32(16, remap(cView.getUint32(16, true)), true);
        cView.setUint32(20, remap(cView.getUint32(20, true)), true);
        xmlChunks.push(chunkBuf);
      } else if (chunkType === 0x00100102) { // START_ELEMENT
        const origNameIdx = view.getUint32(curOff + 20, true);
        const tagName = origStrings[origNameIdx];

        // If we hit queries or application and haven't yet injected remaining requested permissions:
        if ((tagName === 'queries' || tagName === 'application') && !injectedExtraPerms) {
          injectedExtraPerms = true;
          for (const perm of permissionsToEnsure) {
            if (!emittedPerms.has(perm)) {
              const pStrIdx = permStringMap.get(perm);
              if (pStrIdx !== undefined) {
                const [startC, endC] = createUsesPermissionChunks(usesPermStrIdx, androidNsIdx, nameAttrIdx, pStrIdx);
                xmlChunks.push(startC);
                xmlChunks.push(endC);
                emittedPerms.add(perm);
              }
            }
          }
        }

        // Check if this is an existing uses-permission
        if (tagName === 'uses-permission') {
          const origAttrCount = view.getUint16(curOff + 28, true);
          let permName = '';
          for (let a = 0; a < origAttrCount; a++) {
            const aOff = curOff + 36 + a * 20;
            const aRawVal = view.getUint32(aOff + 8, true);
            if (aRawVal < origStrings.length) {
              permName = origStrings[aRawVal];
            }
          }

          // Any configurable permission that is NOT in permissionsToEnsure must be excluded/skipped
          const isConfigurable =
            permName.startsWith('android.permission.') &&
            permName !== 'android.permission.REQUEST_INSTALL_PACKAGES' &&
            permName !== 'android.permission.DUMP';

          if (isConfigurable && !permissionsToEnsure.includes(permName)) {
            skipNextEndElement = true;
            curOff += chunkSize;
            continue;
          }

          if (permName) {
            emittedPerms.add(permName);
          }
        }

        const isActivity = tagName === 'activity';
        const origAttrCount = view.getUint16(curOff + 28, true);

        const addAttr = isActivity && !patchedActivity && shouldAddOrient;
        const newAttrCount = addAttr ? origAttrCount + 1 : origAttrCount;
        const newChunkSize = chunkSize + (addAttr ? 20 : 0);

        const chunkBuf = new Uint8Array(newChunkSize);
        chunkBuf.set(buf.subarray(curOff, curOff + chunkSize), 0);
        const cView = new DataView(chunkBuf.buffer);
        cView.setUint32(4, newChunkSize, true);
        cView.setUint32(16, remap(cView.getUint32(16, true)), true);
        cView.setUint32(20, remap(origNameIdx), true);
        cView.setUint16(28, newAttrCount, true);

        // Collect and remap all attributes
        interface AttrEntry {
          ns: number;
          name: number;
          rawVal: number;
          size: number;
          res0: number;
          type: number;
          data: number;
          resId: number;
        }

        const attrList: AttrEntry[] = [];
        for (let a = 0; a < origAttrCount; a++) {
          const aOff = curOff + 36 + a * 20;
          const origNs = view.getUint32(aOff, true);
          const origName = view.getUint32(aOff + 4, true);
          const origRawVal = view.getUint32(aOff + 8, true);
          const size = view.getUint16(aOff + 12, true);
          const res0 = view.getUint8(aOff + 14);
          const valType = view.getUint8(aOff + 15);
          let valData = view.getUint32(aOff + 16, true);

          const remappedNs = remap(origNs);
          const remappedName = remap(origName);
          const remappedRawVal = remap(origRawVal);
          if (valType === 0x03) { // TYPE_STRING
            valData = remap(valData);
          }

          const rId = origName < origResIds.length ? origResIds[origName] : 0;
          attrList.push({
            ns: remappedNs,
            name: remappedName,
            rawVal: remappedRawVal,
            size,
            res0,
            type: valType,
            data: valData,
            resId: rId,
          });
        }

        if (addAttr) {
          const nsIdx = origStrings.indexOf('http://schemas.android.com/apk/res/android');
          attrList.push({
            ns: remap(nsIdx !== -1 ? nsIdx : 65),
            name: INSERT_POS, // screenOrientation
            rawVal: 0xffffffff,
            size: 0x0008,
            res0: 0,
            type: 0x10, // TYPE_INT_DEC
            data: orientVal,
            resId: 0x0101001e, // screenOrientation resource ID
          });
          patchedActivity = true;
        }

        // Android AXML parser strictly requires attributes to be sorted by resource ID in ascending order
        attrList.sort((a, b) => {
          if (a.resId !== b.resId) {
            return a.resId - b.resId;
          }
          return a.name - b.name;
        });

        // Write attributes into chunkBuf
        for (let a = 0; a < attrList.length; a++) {
          const aWrite = 36 + a * 20;
          const attr = attrList[a];
          cView.setUint32(aWrite, attr.ns, true);
          cView.setUint32(aWrite + 4, attr.name, true);
          cView.setUint32(aWrite + 8, attr.rawVal, true);
          cView.setUint16(aWrite + 12, attr.size, true);
          cView.setUint8(aWrite + 14, attr.res0);
          cView.setUint8(aWrite + 15, attr.type);
          cView.setUint32(aWrite + 16, attr.data, true);
        }

        xmlChunks.push(chunkBuf);
      } else if (chunkType === 0x00100103) { // END_ELEMENT
        if (skipNextEndElement) {
          skipNextEndElement = false;
          curOff += chunkSize;
          continue;
        }
        const chunkBuf = new Uint8Array(chunkSize);
        chunkBuf.set(buf.subarray(curOff, curOff + chunkSize), 0);
        const cView = new DataView(chunkBuf.buffer);
        cView.setUint32(16, remap(cView.getUint32(16, true)), true);
        cView.setUint32(20, remap(cView.getUint32(20, true)), true);
        xmlChunks.push(chunkBuf);
      } else {
        xmlChunks.push(buf.subarray(curOff, curOff + chunkSize));
      }

      curOff += chunkSize;
      if (chunkSize <= 0) break;
    }

    // 7. Assemble final binary XML
    const totalXmlSize = xmlChunks.reduce((sum, c) => sum + c.length, 0);
    const totalFileSize = 8 + newSpChunkSize + newRmSize + totalXmlSize;

    const out = new Uint8Array(totalFileSize);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, magic, true);
    outView.setUint32(4, totalFileSize, true);

    let pos = 8;
    out.set(newSpHeader, pos);
    pos += headerAndOffsetsSize;
    for (const c of strDataChunks) {
      out.set(c, pos);
      pos += c.length;
    }
    pos += paddingBytes;

    out.set(newRm, pos);
    pos += newRmSize;

    for (const c of xmlChunks) {
      out.set(c, pos);
      pos += c.length;
    }

    return out;
  } catch (err) {
    console.error('Failed to patch binary AndroidManifest.xml:', err);
    return buf;
  }
}

/**
 * Patches resources.arsc to point the default launcher icon and round icon
 * away from the template's adaptive XML (res/mipmap-anydpi-v26/ic_launcher.xml)
 * directly to the user's custom PNG icons (res/mipmap-xxxhdpi-v4/ic_launcher.png).
 * This ensures Android launcher home screens and app drawers display the user's
 * chosen custom app icon instead of the creator app's default logo!
 */
export function patchResourcesArscIcon(arscBuf: Uint8Array): Uint8Array {
  try {
    const patched = new Uint8Array(arscBuf);
    const target1 = 'res/mipmap-anydpi-v26/ic_launcher.xml';
    const rep1 = 'res/mipmap-xxxhdpi-v4/ic_launcher.png'; // Exact 37 characters!
    const target2 = 'res/mipmap-anydpi-v26/ic_launcher_round.xml';
    const rep2 = 'res/mipmap-xxxhdpi-v4/ic_launcher_round.png'; // Exact 43 characters!

    // Helper to find substring index in Uint8Array
    function findBytes(source: Uint8Array, patternStr: string): number {
      const pLen = patternStr.length;
      for (let i = 0; i <= source.length - pLen; i++) {
        let match = true;
        for (let j = 0; j < pLen; j++) {
          if (source[i + j] !== patternStr.charCodeAt(j)) {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
      return -1;
    }

    const idx1 = findBytes(patched, target1);
    if (idx1 !== -1) {
      for (let i = 0; i < rep1.length; i++) {
        patched[idx1 + i] = rep1.charCodeAt(i);
      }
    }

    const idx2 = findBytes(patched, target2);
    if (idx2 !== -1) {
      for (let i = 0; i < rep2.length; i++) {
        patched[idx2 + i] = rep2.charCodeAt(i);
      }
    }

    return patched;
  } catch (e) {
    console.warn('Could not patch resources.arsc icon references:', e);
    return arscBuf;
  }
}
