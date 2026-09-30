import { buildApiUrl, getBackendBaseUrl, isAppAssetsOrHashUrl } from './apiConfig';

/**
 * Utility for downloading and sharing files seamlessly on both Web browsers and inside
 * Android WebView wrappers using Native Chrome Custom Tabs, Android MediaStore bridge,
 * File System Access API, and Web Share API.
 */

export function isInsideAndroidApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    (!!(window as any).AndroidDownloader ||
      !!(window as any).AndroidApp ||
      !!(window as any).Android ||
      !!(window as any).JSBridge)
  );
}

/**
 * Converts a Blob to a base64 Data URL string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

/**
 * Uploads a file blob to the server's download endpoint to create a real public HTTPS URL.
 * When this URL is opened in Chrome / Chrome Custom Tabs, Chrome's native download manager
 * downloads the file directly to the device's public Downloads folder!
 */
export async function createDownloadUrl(
  blob: Blob,
  fileName: string,
  mimeType: string = 'application/vnd.android.package-archive'
): Promise<string> {
  const base64 = await blobToBase64(blob);
  const targetApi = buildApiUrl('/api/prepare-download');
  const response = await fetch(targetApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, base64, mimeType }),
  });

  if (!response.ok) {
    throw new Error('Failed to prepare download URL on server');
  }

  const data = await response.json();

  // 1. If server returned an absolute HTTPS URL, use it directly (this is the authoritative server hosting the file)
  if (
    data.downloadUrl &&
    (data.downloadUrl.startsWith('https://') || data.downloadUrl.startsWith('http://'))
  ) {
    if (
      !data.downloadUrl.includes('localhost') &&
      !data.downloadUrl.includes('127.0.0.1') &&
      !data.downloadUrl.includes('appassets.androidplatform.net')
    ) {
      return data.downloadUrl;
    }
  }

  // 2. Otherwise compose URL using the authoritative backend server base URL
  const backendBase = getBackendBaseUrl().replace(/\/+$/, '');
  const downloadPath = data.downloadPath || ('/api/download/' + data.id + '/' + encodeURIComponent(fileName));
  return `${backendBase}${downloadPath}`;
}

/**
 * Downloads a file via Chrome Custom Tabs (inside Android app) using a real HTTPS URL.
 * This ensures the APK file is 100% saved into the user's phone's Internal Storage > Download folder.
 */
export async function downloadViaCustomTabs(
  blob: Blob,
  fileName: string,
  mimeType: string = 'application/vnd.android.package-archive'
): Promise<string> {
  const url = await createDownloadUrl(blob, fileName, mimeType);
  openInChromeCustomTabs(url);
  return url;
}

/**
 * Saves file to a user-chosen folder on phone/PC using the modern File System Access API.
 * This allows the user to directly pick ANY folder (Downloads, Documents, WhatsApp, SD Card).
 */
export async function saveFileToDeviceFolder(
  blob: Blob,
  fileName: string,
  mimeType: string = 'application/vnd.android.package-archive'
): Promise<{ success: boolean; method: 'picker' | 'server-download' | 'blob'; error?: string }> {
  // 1. Try File System Access API (showSaveFilePicker)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '.apk';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: `${ext.toUpperCase()} File`,
            accept: { [mimeType]: [ext] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'picker' };
    } catch (pickerErr: any) {
      if (pickerErr?.name === 'AbortError') {
        // User cancelled folder picker
        return { success: false, method: 'picker', error: 'User cancelled folder selection' };
      }
      console.warn('showSaveFilePicker unavailable or failed:', pickerErr);
    }
  }

  // 2. Fallback: Create real server HTTPS download URL and open in top-level window
  try {
    const url = await createDownloadUrl(blob, fileName, mimeType);
    window.open(url, '_blank');
    return { success: true, method: 'server-download' };
  } catch (err: any) {
    // 3. Fallback to standard Blob download
    const ok = await downloadBlobOrFile(blob, fileName, mimeType);
    return { success: ok, method: 'blob', error: ok ? undefined : 'Failed to save' };
  }
}

/**
 * Downloads a Blob directly into the device's storage.
 * - On native Android app: uses Chrome Custom Tabs with a real HTTPS download URL
 *   so Chrome's download engine saves it directly into Internal Storage > Download.
 * - In browsers/iframes: uses server HTTPS URL opened in new tab to bypass iframe blocks,
 *   with fallback to HTML5 Blob Object URL.
 */
export async function downloadBlobOrFile(
  blob: Blob,
  fileName: string,
  mimeType: string = 'application/vnd.android.package-archive',
  forceCustomTabs: boolean = false
): Promise<boolean> {
  const insideApp = isInsideAndroidApp();
  const androidBridge =
    typeof window !== 'undefined'
      ? (window as any).AndroidDownloader ||
        (window as any).AndroidApp ||
        (window as any).Android ||
        (window as any).JSBridge
      : null;

  // 1. If running inside native Android App wrapper with file saver bridge:
  // Directly save to phone's Downloads directory (instant, 100% reliable, offline!)
  if (androidBridge && typeof androidBridge.saveBase64File === 'function') {
    try {
      const base64Data = await blobToBase64(blob);
      androidBridge.saveBase64File(base64Data, fileName, mimeType);
      return true;
    } catch (err) {
      console.warn('Native Android bridge saveBase64File failed:', err);
    }
  }

  // 2. Prepare real HTTPS server download URL (for Custom Tabs, DownloadManager, or iframe bypass)
  let serverUrl = '';
  try {
    serverUrl = await createDownloadUrl(blob, fileName, mimeType);
  } catch (serverErr) {
    console.warn('Server download preparation failed:', serverErr);
  }

  // 3. Custom Tabs or WebView Navigation
  if (serverUrl) {
    if (androidBridge && typeof androidBridge.openInCustomTabs === 'function') {
      try {
        androidBridge.openInCustomTabs(serverUrl);
        return true;
      } catch (tabErr) {
        console.warn('Bridge openInCustomTabs failed:', tabErr);
      }
    }
    if (androidBridge && typeof androidBridge.downloadUrl === 'function') {
      try {
        androidBridge.downloadUrl(serverUrl);
        return true;
      } catch (dlErr) {
        console.warn('Bridge downloadUrl failed:', dlErr);
      }
    }

    if (forceCustomTabs || insideApp) {
      try {
        openInChromeCustomTabs(serverUrl);
        return true;
      } catch (customErr) {
        console.warn('Custom tabs launcher failed:', customErr);
      }
    }

    // Standard Browser / WebView download trigger via Anchor and location.href
    try {
      const a = document.createElement('a');
      a.href = serverUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 1500);

      // On Android mobile devices / WebViews, setting location.href triggers DownloadListener / Chrome
      const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
      if (isAndroid) {
        try {
          window.location.href = serverUrl;
        } catch {}
      }
      return true;
    } catch (anchorErr) {
      console.warn('Anchor server download failed:', anchorErr);
    }
  }

  // 4. Standard HTML5 Blob URL download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.setAttribute('download', fileName);
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, 30000);
    }, 1000);

    return true;
  } catch (blobErr) {
    console.warn('Blob URL download failed, trying data URL fallback:', blobErr);
  }

  // 5. Fallback: Data URL
  try {
    const dataUrl = await blobToBase64(blob);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.setAttribute('download', fileName);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1500);

    return true;
  } catch (dataErr) {
    console.error('All download methods failed:', dataErr);
    return false;
  }
}

/**
 * Checks if the browser supports the Web Share API with file attachments (common on Android Chrome)
 */
export function canWebShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !(navigator as any).canShare) return false;
  try {
    const dummyFile = new File([''], 'test.apk', {
      type: 'application/octet-stream',
    });
    return (navigator as any).canShare({ files: [dummyFile] });
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is a real public HTTP/HTTPS URL (not a local blob: or webview asset URL)
 */
export function isPublicHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;
  if (trimmed.includes('appassets.androidplatform.net')) return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

/**
 * Checks if Web Share API is available in any form (file, link, or text)
 */
export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
}

/**
 * Native mobile file sharing: directly passes APK file to Android system share sheet
 * (WhatsApp, Google Drive "Save to Drive", Files "Save to Device", Gmail, Telegram, etc.)
 */
export async function shareFileOnMobile(
  blob: Blob,
  fileName: string,
  mimeType: string = 'application/vnd.android.package-archive',
  downloadUrl?: string
): Promise<boolean> {
  const androidApp =
    typeof window !== 'undefined'
      ? (window as any).AndroidApp ||
        (window as any).AndroidDownloader ||
        (window as any).Android ||
        (window as any).JSBridge
      : null;

  // 1. If running inside native Android App, call shareFileNative directly
  if (androidApp && typeof androidApp.shareFileNative === 'function') {
    try {
      const base64 = await blobToBase64(blob);
      androidApp.shareFileNative(base64, fileName, mimeType);
      return true;
    } catch (e) {
      console.warn('Native shareFileNative failed:', e);
    }
  }

  // 2. Try sharing actual file binary first (opens Android system sheet with WhatsApp, Drive, Files)
  // We test application/octet-stream first because Android Chrome allows octet-stream for APK files
  if (typeof navigator !== 'undefined' && (navigator as any).canShare) {
    const candidateMimes = ['application/octet-stream', mimeType, ''];
    for (const testMime of candidateMimes) {
      try {
        const file = new File([blob], fileName, { type: testMime });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            files: [file],
            title: fileName,
          });
          return true;
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          return false;
        }
        console.warn(`Direct file sharing error with mime ${testMime}:`, e);
      }
    }
  }

  // 3. Fallback: Share via URL and title using Web Share API only if valid public HTTP URL exists
  if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      let targetUrl = isPublicHttpUrl(downloadUrl) ? downloadUrl : '';
      if (!targetUrl) {
        try {
          const prepared = await createDownloadUrl(blob, fileName, mimeType);
          if (isPublicHttpUrl(prepared)) {
            targetUrl = prepared;
          }
        } catch {}
      }

      if (targetUrl) {
        await (navigator as any).share({
          title: fileName,
          text: `Download and install ${fileName}:`,
          url: targetUrl,
        });
        return true;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return false;
      console.warn('URL Web Share API error:', e);
    }
  }

  return false;
}

export interface WhatsAppShareResponse {
  success: boolean;
  method: 'native_android' | 'web_share_files' | 'whatsapp_link' | 'whatsapp_document_guide';
  message: string;
  downloadUrl?: string;
}

/**
 * Share direct APK file or verified download link to WhatsApp
 */
export async function shareToWhatsApp(
  blob: Blob,
  fileName: string,
  appName: string,
  mimeType: string = 'application/vnd.android.package-archive',
  existingUrl?: string
): Promise<WhatsAppShareResponse> {
  const androidApp =
    typeof window !== 'undefined'
      ? (window as any).AndroidApp ||
        (window as any).AndroidDownloader ||
        (window as any).Android ||
        (window as any).JSBridge
      : null;

  // 1. Android App Bridge: Share the APK file directly to WhatsApp as a Document attachment!
  if (androidApp && typeof androidApp.shareApkToWhatsApp === 'function') {
    try {
      const base64 = await blobToBase64(blob);
      androidApp.shareApkToWhatsApp(base64, fileName);
      return {
        success: true,
        method: 'native_android',
        message: 'Opening WhatsApp, send file directly as Document...',
      };
    } catch (e) {
      console.warn('Native Android WhatsApp share failed:', e);
    }
  }

  // 2. Mobile Browser: Try Web Share API with actual file attachment!
  // In Chrome on Android, sharing a File with 'application/octet-stream' brings up WhatsApp's Document picker!
  if (typeof navigator !== 'undefined' && typeof (navigator as any).canShare === 'function') {
    const candidateMimes = ['application/octet-stream', mimeType, ''];
    for (const testMime of candidateMimes) {
      try {
        const file = new File([blob], fileName, { type: testMime });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            files: [file],
            title: fileName,
          });
          return {
            success: true,
            method: 'web_share_files',
            message: '✅ Shared APK file directly to WhatsApp or app!',
          };
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          return {
            success: false,
            method: 'web_share_files',
            message: 'Share cancelled',
          };
        }
        console.warn(`Web Share attempt failed with MIME ${testMime}:`, e);
      }
    }
  }

  // 3. Fallback: Save file to device storage first so user has it offline in Downloads
  try {
    await downloadBlobOrFile(blob, fileName, mimeType, true);
  } catch (e) {
    console.warn('Auto-save to downloads failed:', e);
  }

  // Determine if we have a valid public HTTP URL
  let validDownloadUrl = isPublicHttpUrl(existingUrl) ? existingUrl!.trim() : '';
  if (!validDownloadUrl) {
    try {
      const prepared = await createDownloadUrl(blob, fileName, mimeType);
      if (isPublicHttpUrl(prepared)) {
        validDownloadUrl = prepared.trim();
      }
    } catch (e) {
      console.warn('Could not prepare server download URL:', e);
    }
  }

  if (validDownloadUrl) {
    const textMsg = `🚀 *${appName}* Android App Package\n\n📦 File: *${fileName}*\n\n📥 Download Link:\n${validDownloadUrl}\n\n👆 Click link to download & install directly on your phone!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
    openInChromeCustomTabs(whatsappUrl);
    return {
      success: true,
      method: 'whatsapp_link',
      downloadUrl: validDownloadUrl,
      message: 'WhatsApp opened. The file is also saved in your Downloads folder to attach as 📎 Document!',
    };
  } else {
    // Guide the user to attach the downloaded file in WhatsApp
    const textMsg = `🚀 *${appName}* Android App Package\n📦 File: *${fileName}*\n\n✅ App file saved in your device Downloads folder.\n📎 To send: In WhatsApp tap Paperclip (📎) -> Document -> Select *${fileName}*.`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
    openInChromeCustomTabs(whatsappUrl);
    return {
      success: true,
      method: 'whatsapp_document_guide',
      message: `${fileName} saved in Downloads folder! Select and send via WhatsApp 📎 Document.`,
    };
  }
}

/**
 * Save / Upload to Google Drive helper
 */
export async function saveToGoogleDrive(
  blob: Blob,
  fileName: string,
  mimeType: string = 'application/vnd.android.package-archive',
  downloadUrl?: string
): Promise<boolean> {
  // Method 1: Try Mobile Share Sheet with file (On Android, this shows "Save to Drive" directly!)
  const shared = await shareFileOnMobile(blob, fileName, mimeType, downloadUrl);
  if (shared) return true;

  // Method 2: Open Google Drive web upload
  openInChromeCustomTabs('https://drive.google.com/drive/my-drive');
  return false;
}

/**
 * Builds an Android Chrome Custom Tabs Intent URL.
 * When visited or clicked on Android, this directly instructs Android OS to launch
 * Google Chrome (Custom Tab / browser) and open the URL directly.
 */
export function buildChromeIntent(url: string): string {
  const cleanUrl = url.replace(/^https?:\/\//i, '');
  const scheme = url.startsWith('http://') ? 'http' : 'https';
  return `intent://${cleanUrl}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end`;
}

export function buildBrowserIntent(url: string): string {
  const cleanUrl = url.replace(/^https?:\/\//i, '');
  const scheme = url.startsWith('http://') ? 'http' : 'https';
  return `intent://${cleanUrl}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}

/**
 * Opens a URL in Chrome Custom Tabs (inside Android app) or a new browser tab (on web)
 */
export function openInChromeCustomTabs(url?: string): void {
  // Never allow appassets.androidplatform.net or '#' to be launched in Chrome!
  let rawUrl = (url || '').trim();

  if (isAppAssetsOrHashUrl(rawUrl)) {
    // If invalid or local android asset url, fallback to canonical web server
    rawUrl = getBackendBaseUrl();
  }

  const targetUrl =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : buildApiUrl(rawUrl);

  // Hard safety check: Never open local WebView asset domain in Chrome
  if (targetUrl.includes('appassets.androidplatform.net') || targetUrl.endsWith('#')) {
    console.warn('Blocked opening local app asset url in Chrome Custom Tabs:', targetUrl);
    return;
  }

  // 1. Android Bridge if running inside native Android wrapper
  const androidBridge =
    (window as any).AndroidDownloader ||
    (window as any).AndroidApp ||
    (window as any).Android ||
    (window as any).JSBridge;

  if (androidBridge) {
    if (typeof androidBridge.openInCustomTabs === 'function') {
      try {
        androidBridge.openInCustomTabs(targetUrl);
        return;
      } catch (e) {
        console.warn('Bridge openInCustomTabs failed:', e);
      }
    }

    if (typeof androidBridge.downloadUrl === 'function') {
      try {
        androidBridge.downloadUrl(targetUrl);
        return;
      } catch (e) {
        console.warn('Bridge downloadUrl failed:', e);
      }
    }
  }

  // 2. Android device handling: Launch Chrome Intent to open Chrome Custom Tab directly!
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      const chromeIntent = buildChromeIntent(targetUrl);
      window.location.href = chromeIntent;

      // Fallback intent if Chrome is not default
      setTimeout(() => {
        try {
          const browserIntent = buildBrowserIntent(targetUrl);
          window.location.href = browserIntent;
        } catch (_) {}
      }, 400);

      // Also trigger a real anchor click in parallel
      setTimeout(() => {
        try {
          const a = document.createElement('a');
          a.href = targetUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
          }, 500);
        } catch (_) {}
      }, 700);

      return;
    } catch (_) {}
  }

  // 3. Desktop / iOS / Web fallback
  try {
    const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = targetUrl;
    }
  } catch {
    window.location.href = targetUrl;
  }
}

/**
 * Triggers package installation for a previously downloaded file if running inside native Android app.
 */
export function installApkIfSupported(fileName: string): boolean {
  const androidBridge =
    (window as any).AndroidDownloader ||
    (window as any).AndroidApp ||
    (window as any).Android ||
    (window as any).JSBridge;
  if (androidBridge && typeof androidBridge.installDownloadedApk === 'function') {
    androidBridge.installDownloadedApk(fileName);
    return true;
  }
  return false;
}

/**
 * Directly opens the mobile device's system Downloads folder / manager
 */
export function openDeviceDownloadsFolder(): boolean {
  const androidBridge =
    (window as any).AndroidDownloader ||
    (window as any).AndroidApp ||
    (window as any).Android ||
    (window as any).JSBridge;
  if (androidBridge && typeof androidBridge.openDownloadsFolder === 'function') {
    androidBridge.openDownloadsFolder();
    return true;
  }
  return false;
}



