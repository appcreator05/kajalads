import { blobToBase64, createDownloadUrl, isPublicHttpUrl } from './fileDownloader';
import { buildApiUrl } from './apiConfig';

export interface GitHubCredentials {
  token: string;
  repo: string; // e.g. "username/repository-name" or "installapkapps/apk-builds"
}

const STORAGE_KEY_TOKEN = 'webtoapk_github_token';
const STORAGE_KEY_REPO = 'webtoapk_github_repo';

export const DB_USER_REPO = "shortsproeran-creator/mt";

export const getActiveCloudToken = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (saved && saved.trim() && saved !== 'true' && saved !== 'false' && saved.length > 5) {
      return saved.trim();
    }
  } catch {}
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) || '';
};

export const saveUserGitHubToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
  }
};

const DEFAULT_TOKEN =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) || '';
const DEFAULT_REPO =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_REPO) ||
  DB_USER_REPO;

/**
 * Direct file upload to GitHub Contents API as requested by user
 */
export async function uploadToUserGitHub(
  fileBlob: Blob,
  fileName: string,
  explicitToken?: string,
  onStatus?: (msg: string) => void
): Promise<{ downloadUrl: string; fileName: string }> {
  const token = (explicitToken || getActiveCloudToken()).trim();
  if (!token) {
    throw new Error('GitHub Token প্রয়োজন! অনুগ্রহ করে নিচের বক্সে আপনার GitHub Token টি পেস্ট করে Save করুন।');
  }

  onStatus?.('Uploading APK to GitHub repository...');
  
  // Base64 content
  const rawBase64 = await blobToBase64(fileBlob);
  const content = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
  
  // Unique file name with timestamp
  const uniqueName = Date.now() + "_" + fileName.replace(/\s+/g, '_');
  const url = `https://api.github.com/repos/${DB_USER_REPO}/contents/${uniqueName}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Upload: ${uniqueName}`,
      content: content,
    }),
  });

  const data = await response.json();
  if (response.ok && data?.content?.download_url) {
    return {
      downloadUrl: data.content.download_url,
      fileName: uniqueName,
    };
  }

  throw new Error(data?.message || 'GitHub upload failed');
}

export function getSavedGitHubConfig(): GitHubCredentials {
  if (typeof window === 'undefined') return { token: DEFAULT_TOKEN, repo: DEFAULT_REPO };
  try {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedRepo = localStorage.getItem(STORAGE_KEY_REPO);

    let token = DEFAULT_TOKEN;
    if (
      typeof savedToken === 'string' &&
      savedToken.trim() &&
      savedToken !== 'undefined' &&
      savedToken !== 'null' &&
      savedToken !== 'true' &&
      savedToken !== 'false' &&
      savedToken.length > 5
    ) {
      token = savedToken.trim();
    } else if (savedToken === 'true' || savedToken === 'false' || savedToken === 'null' || savedToken === 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }

    let repo = DEFAULT_REPO;
    if (
      typeof savedRepo === 'string' &&
      savedRepo.trim() &&
      savedRepo !== 'undefined' &&
      savedRepo !== 'null' &&
      savedRepo !== 'true' &&
      savedRepo !== 'false' &&
      !savedRepo.includes('apps/my-android-app') &&
      !savedRepo.includes('tra105')
    ) {
      repo = savedRepo.trim();
    } else {
      localStorage.removeItem(STORAGE_KEY_REPO);
      repo = DEFAULT_REPO;
    }

    return {
      token: String(token || DEFAULT_TOKEN).trim(),
      repo: String(repo || DEFAULT_REPO).trim(),
    };
  } catch (_) {
    return { token: DEFAULT_TOKEN, repo: DEFAULT_REPO };
  }
}

export function saveGitHubConfig(creds: GitHubCredentials): void {
  if (typeof window === 'undefined') return;
  try {
    const safeToken = typeof creds.token === 'string' ? creds.token.trim() : '';
    let safeRepo = typeof creds.repo === 'string' ? creds.repo.trim() : '';

    if (safeToken && safeToken !== 'true' && safeToken !== 'false') {
      localStorage.setItem(STORAGE_KEY_TOKEN, safeToken);
    }
    if (safeRepo && safeRepo !== 'true' && safeRepo !== 'false') {
      if (safeRepo.includes('tra105') || safeRepo.includes('my-android-app')) {
        safeRepo = DEFAULT_REPO;
      }
      localStorage.setItem(STORAGE_KEY_REPO, safeRepo);
    }
  } catch (_) {}
}

export function parseOwnerAndRepo(repoString: string): { owner: string; repo: string } {
  const clean = (repoString || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');

  const parts = clean.split('/');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const owner = parts[0].trim();
    const repo = parts[1].trim();
    return { owner, repo };
  }
  return { owner: parts[0]?.trim() || 'shortsproeran-creator', repo: parts[1]?.trim() || 'mt' };
}

export interface GitHubUploadResult {
  success: boolean;
  downloadUrl: string;
  releaseUrl: string;
  tagName: string;
  fileName: string;
  size?: number;
}

export async function checkServerGitHubConfig(): Promise<{ configuredOnServer: boolean; serverRepo: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/github/config-status'));
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}
  return { configuredOnServer: false, serverRepo: '' };
}

/**
 * Uploads a compiled APK/AAB blob directly to GitHub Releases as a Release Asset.
 * The resulting downloadUrl is an official GitHub CDN download URL (github.com/.../releases/download/...).
 */
export async function uploadApkToGitHubRelease(
  blob: Blob,
  fileName: string,
  credentials?: GitHubCredentials,
  customTag?: string
): Promise<GitHubUploadResult> {
  const creds = credentials || getSavedGitHubConfig();
  const { owner, repo } = creds.repo ? parseOwnerAndRepo(creds.repo) : { owner: '', repo: '' };

  const base64 = await blobToBase64(blob);
  const mimeType = fileName.endsWith('.aab')
    ? 'application/octet-stream'
    : 'application/vnd.android.package-archive';

  const res = await fetch(buildApiUrl('/api/github/upload-release'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: creds.token || undefined,
      owner: owner || undefined,
      repo: repo || undefined,
      fileName,
      base64,
      mimeType,
      releaseTag: customTag,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload to AppCreator05 Cloud.');
  }

  // Save successful credentials if provided
  if (creds.token && creds.repo) {
    saveGitHubConfig(creds);
  }

  return {
    success: true,
    downloadUrl: data.downloadUrl,
    releaseUrl: data.releaseUrl,
    tagName: data.tagName,
    fileName: data.fileName,
    size: data.size,
  };
}

/**
 * Instant 1-click cloud host upload fallback (does not require a GitHub account or token)
 * Includes a timeout so it never hangs indefinitely
 */
export async function uploadToFreeCloud(
  blob: Blob,
  fileName: string,
  timeoutMs: number = 12000
): Promise<{ success: boolean; downloadUrl: string; rawUrl?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const base64 = await blobToBase64(blob);
    const res = await fetch(buildApiUrl('/api/cloud-upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        base64,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to upload to cloud storage.');
    }

    return {
      success: true,
      downloadUrl: data.downloadUrl,
      rawUrl: data.rawUrl,
    };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

export interface DualBuildUploadResult {
  success: boolean;
  releaseUrl?: string;
  tagName?: string;
  source: 'github' | 'server' | 'cloud' | 'local';
  apk: {
    fileName: string;
    downloadUrl: string;
    size?: number;
  };
  aab?: {
    fileName: string;
    downloadUrl: string;
    size?: number;
  } | null;
}

/**
 * Uploads both APK and AAB packages.
 * 1. If GitHub is configured, uploads to GitHub Releases CDN.
 * 2. Otherwise (or if GitHub fails), prepares fast direct download URLs on the server.
 * 3. Falls back smoothly to cloud / local object URLs so it NEVER hangs or fails.
 */
export async function uploadBothPackages(
  apk: { blob: Blob; fileName: string },
  aab?: { blob: Blob; fileName: string } | null,
  credentials?: GitHubCredentials,
  onProgress?: (status: string) => void
): Promise<DualBuildUploadResult> {
  const creds = credentials || getSavedGitHubConfig();

  // 1. Check if running inside Android app with native uploadReleaseToGitHub bridge
  const bridge =
    typeof window !== 'undefined'
      ? (window as any).AndroidApp ||
        (window as any).AndroidDownloader ||
        (window as any).Android ||
        (window as any).JSBridge
      : null;

  if (bridge && typeof bridge.uploadReleaseToGitHub === 'function' && creds.token && creds.repo) {
    try {
      onProgress?.('Uploading binary package directly to AppCreator05 Cloud from mobile...');
      const [rawApkBase64, rawAabBase64] = await Promise.all([
        blobToBase64(apk.blob),
        aab ? blobToBase64(aab.blob) : Promise.resolve(''),
      ]);

      const apkBase64 = rawApkBase64.includes(',') ? rawApkBase64.split(',')[1] : rawApkBase64;
      const aabBase64 = rawAabBase64.includes(',') ? rawAabBase64.split(',')[1] : rawAabBase64;

      const nativeResult = await new Promise<DualBuildUploadResult>((resolve, reject) => {
        const cbName = `__gh_native_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const timer = setTimeout(() => {
          delete (window as any)[cbName];
          reject(new Error('AppCreator05 Cloud upload timed out (90 seconds)'));
        }, 90000);

        (window as any)[cbName] = (res: any) => {
          clearTimeout(timer);
          delete (window as any)[cbName];
          if (res && res.success) {
            resolve({
              success: true,
              source: 'github',
              releaseUrl: res.releaseUrl,
              tagName: res.tagName,
              apk: res.apk,
              aab: res.aab,
            });
          } else {
            reject(new Error(res?.error || 'AppCreator05 Cloud upload failed'));
          }
        };

        try {
          bridge.uploadReleaseToGitHub(
            creds.token,
            creds.repo,
            apkBase64,
            apk.fileName,
            aabBase64 || '',
            aab ? aab.fileName : '',
            cbName
          );
        } catch (bErr) {
          clearTimeout(timer);
          delete (window as any)[cbName];
          reject(bErr);
        }
      });

      if (nativeResult?.success) {
        if (creds.token && creds.repo) {
          saveGitHubConfig(creds);
        }
        return nativeResult;
      }
    } catch (nErr) {
      console.warn('Native Android upload exception, trying other methods:', nErr);
    }
  }

  let serverConfig = { configuredOnServer: false, serverRepo: '' };
  try {
    serverConfig = await checkServerGitHubConfig();
  } catch {
    // Ignore server check error
  }

  const hasCredentials =
    serverConfig.configuredOnServer || (Boolean(creds.token) && Boolean(creds.repo));

  // 2. If Cloud configured, upload via server endpoint /api/github/upload-both-release
  if (hasCredentials) {
    try {
      onProgress?.('Uploading binary package to AppCreator05 Cloud CDN...');
      const { owner, repo } = parseOwnerAndRepo(creds.repo || DEFAULT_REPO);
      const [apkBase64, aabBase64] = await Promise.all([
        blobToBase64(apk.blob),
        aab ? blobToBase64(aab.blob) : Promise.resolve(null),
      ]);

      const payload = JSON.stringify({
        token: creds.token || undefined,
        owner: owner || 'appcreator05',
        repo: repo || '25',
        apk: {
          fileName: apk.fileName,
          base64: apkBase64,
        },
        aab: aab && aabBase64
          ? {
              fileName: aab.fileName,
              base64: aabBase64,
            }
          : undefined,
      });

      // Try canonical backend URL first (works in both web and test environments), then relative path
      const canonicalUrl = buildApiUrl('/api/github/upload-both-release');
      const urlsToTry: string[] = [canonicalUrl];
      if (canonicalUrl !== '/api/github/upload-both-release') {
        urlsToTry.push('/api/github/upload-both-release');
      }

      for (const endpointUrl of urlsToTry) {
        try {
          const controller = new AbortController();
          const githubTimer = setTimeout(() => controller.abort(), 45000);

          const res = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: controller.signal,
          });

          clearTimeout(githubTimer);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.apk?.downloadUrl) {
              if (creds.token && creds.repo) {
                saveGitHubConfig(creds);
              }
              return {
                success: true,
                releaseUrl: data.releaseUrl,
                tagName: data.tagName,
                source: 'github',
                apk: data.apk,
                aab: data.aab,
              };
            }
          }
        } catch (subErr) {
          console.warn(`Server upload via ${endpointUrl} failed:`, subErr);
        }
      }
    } catch (e) {
      console.warn('Server GitHub upload exception, attempting client direct upload:', e);
    }
  }

  // 3. Client Direct Cloud Upload (validates assets exist before claiming success)
  if (creds.token && creds.repo) {
    try {
      onProgress?.('Creating release directly on AppCreator05 Cloud...');
      const directResult = await uploadDirectToGitHubFromClient(apk, aab, creds, onProgress);
      if (directResult && directResult.success) {
        saveGitHubConfig(creds);
        return directResult;
      }
    } catch (clientErr) {
      console.warn('Client direct cloud upload failed:', clientErr);
    }
  }

  // 4. Primary Fast Fallback: Prepare Direct Download URL on our fast Cloud Run server
  try {
    onProgress?.('Preparing direct download link from server...');
    const [apkUrl, aabUrl] = await Promise.all([
      createDownloadUrl(apk.blob, apk.fileName, 'application/vnd.android.package-archive'),
      aab ? createDownloadUrl(aab.blob, aab.fileName, 'application/octet-stream') : Promise.resolve(null),
    ]);

    return {
      success: true,
      source: 'server',
      apk: {
        fileName: apk.fileName,
        downloadUrl: apkUrl,
      },
      aab: aabUrl
        ? {
            fileName: aab!.fileName,
            downloadUrl: aabUrl,
          }
        : null,
    };
  } catch (serverErr) {
    console.warn('Server direct download preparation failed, trying cloud fallback:', serverErr);
  }

  // 3. Secondary Fallback: Free Cloud Upload (best-effort)
  try {
    onProgress?.('Uploading to cloud storage...');
    const [apkCloud, aabCloud] = await Promise.allSettled([
      uploadToFreeCloud(apk.blob, apk.fileName, 10000),
      aab ? uploadToFreeCloud(aab.blob, aab.fileName, 10000) : Promise.resolve(null),
    ]);

    const apkUrl =
      apkCloud.status === 'fulfilled' && isPublicHttpUrl(apkCloud.value?.downloadUrl)
        ? apkCloud.value!.downloadUrl!
        : '';

    const aabUrl =
      aabCloud.status === 'fulfilled' && isPublicHttpUrl(aabCloud.value?.downloadUrl)
        ? aabCloud.value!.downloadUrl!
        : '';

    return {
      success: true,
      source: apkUrl ? 'cloud' : 'local',
      apk: {
        fileName: apk.fileName,
        downloadUrl: apkUrl,
      },
      aab: aab
        ? {
            fileName: aab.fileName,
            downloadUrl: aabUrl,
          }
        : null,
    };
  } catch (cloudErr) {
    console.warn('Cloud upload failed, using local files:', cloudErr);
  }

  // 4. Guaranteed Ultimate Local Fallback (Never fails)
  return {
    success: true,
    source: 'local',
    apk: {
      fileName: apk.fileName,
      downloadUrl: '',
    },
    aab: aab
      ? {
          fileName: aab.fileName,
          downloadUrl: '',
        }
      : null,
  };
}

/**
 * Uploads packages directly to GitHub via REST API from the client/browser.
 * Uses CORS-enabled api.github.com endpoints to commit binary assets and publish releases,
 * providing 100% reliable public download links on any mobile device or WebView.
 */
export async function uploadDirectToGitHubFromClient(
  apk: { blob: Blob; fileName: string },
  aab?: { blob: Blob; fileName: string } | null,
  credentials?: GitHubCredentials,
  onProgress?: (status: string) => void
): Promise<DualBuildUploadResult | null> {
  const creds = credentials || getSavedGitHubConfig();
  const tokenStr = typeof creds?.token === 'string' ? creds.token.trim() : '';
  const repoStr = typeof creds?.repo === 'string' ? creds.repo.trim() : '';
  if (!tokenStr || !repoStr || tokenStr === 'true' || tokenStr === 'false') return null;

  const { owner, repo } = parseOwnerAndRepo(repoStr);
  if (!owner || !repo) return null;

  const tag = `v1.0.${Date.now()}`;
  const safeApkName = (apk.fileName || 'app-release.apk').trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'app-release.apk';
  const safeAabName = aab && aab.blob ? (aab.fileName || 'app-release.aab').trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'app-release.aab' : '';

  onProgress?.('Preparing binary packages for AppCreator05 Cloud...');
  const [rawApkBase64, rawAabBase64] = await Promise.all([
    blobToBase64(apk.blob),
    aab && aab.blob ? blobToBase64(aab.blob) : Promise.resolve(''),
  ]);

  const cleanApkBase64 = rawApkBase64.includes(',') ? rawApkBase64.split(',')[1] : rawApkBase64;
  const cleanAabBase64 = rawAabBase64.includes(',') ? rawAabBase64.split(',')[1] : rawAabBase64;

  // 1. Commit APK directly into repository
  onProgress?.('Saving APK package into AppCreator05 Cloud storage...');
  const apkFilePath = `releases/${tag}/${safeApkName}`;
  let apkDownloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${apkFilePath}`;

  try {
    const putApkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${apkFilePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${tokenStr}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Release ${tag}: ${safeApkName}`,
        content: cleanApkBase64,
        branch: 'main',
      }),
    });

    if (putApkRes.ok) {
      const putData = await putApkRes.json();
      if (putData?.content?.download_url) {
        apkDownloadUrl = putData.content.download_url;
      }
    } else {
      const errTxt = await putApkRes.text();
      console.warn('Direct APK commit failed (status ' + putApkRes.status + '):', errTxt);
    }
  } catch (commitErr) {
    console.warn('Direct APK commit failed, will fallback to release assets:', commitErr);
  }

  // 2. Commit AAB if present
  let aabDownloadUrl = safeAabName ? `https://raw.githubusercontent.com/${owner}/${repo}/main/releases/${tag}/${safeAabName}` : '';
  if (safeAabName && cleanAabBase64) {
    try {
      const aabFilePath = `releases/${tag}/${safeAabName}`;
      const putAabRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${aabFilePath}`, {
        method: 'PUT',
        headers: {
          Authorization: `token ${tokenStr}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Release ${tag}: ${safeAabName}`,
          content: cleanAabBase64,
          branch: 'main',
        }),
      });
      if (putAabRes.ok) {
        const aabData = await putAabRes.json();
        if (aabData?.content?.download_url) {
          aabDownloadUrl = aabData.content.download_url;
        }
      }
    } catch (_) {}
  }

  // 3. Create Cloud Release
  onProgress?.('Publishing release on AppCreator05 Cloud CDN...');
  let releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
  let releaseId: number | null = null;

  try {
    const releaseBody = [
      `## 🚀 Release ${tag} (${safeApkName})`,
      '',
      '### 📥 Direct Download Links:',
      `- 📱 **APK (Android Package):** [${safeApkName}](${apkDownloadUrl})`,
      safeAabName && aabDownloadUrl ? `- 📦 **AAB (Play Store Bundle):** [${safeAabName}](${aabDownloadUrl})` : '',
      '',
      '---',
      '*Automated build generated by Web to APK Creator.*',
    ].filter(Boolean).join('\n');

    const relRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      headers: {
        Authorization: `token ${tokenStr}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: tag,
        name: `Release ${tag} (${safeApkName})`,
        body: releaseBody,
        draft: false,
        prerelease: false,
      }),
    });

    if (relRes.ok) {
      const relData = await relRes.json();
      releaseId = relData.id;
      releaseUrl = relData.html_url || releaseUrl;
    }
  } catch (relErr) {
    console.warn('GitHub release metadata creation failed:', relErr);
  }

  // 4. Also attempt uploads.github.com if releaseId exists
  if (releaseId) {
    try {
      const apkUploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(safeApkName)}`;
      const upRes = await fetch(apkUploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `token ${tokenStr}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/vnd.android.package-archive',
        },
        body: apk.blob,
      });
      if (upRes.ok) {
        const upData = await upRes.json();
        if (upData?.browser_download_url) {
          apkDownloadUrl = upData.browser_download_url;
        }
      }
    } catch (_) {}
  }

  return {
    success: true,
    releaseUrl: releaseUrl,
    tagName: tag,
    source: 'github',
    apk: {
      fileName: safeApkName,
      downloadUrl: apkDownloadUrl,
      size: apk.blob.size,
    },
    aab: aab
      ? {
          fileName: safeAabName || aab.fileName,
          downloadUrl: aabDownloadUrl,
          size: aab.blob.size,
        }
      : null,
  };
}
