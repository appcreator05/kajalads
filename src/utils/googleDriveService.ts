import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure single Firebase instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token caching ONLY (per Workspace Integration Security Guidelines)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export interface GoogleDriveUploadResult {
  fileId: string;
  fileName: string;
  folderName: string;
  webViewLink: string;
  directDownloadUrl: string;
  uploadedAt: number;
}

export function initAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token must be acquired via interactive sign-in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
}

/**
 * Ensures Google Identity Services (GIS) library is loaded
 */
function ensureGisLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      (existing as HTMLScriptElement).addEventListener('load', () => resolve());
      setTimeout(resolve, 800);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Obtains an OAuth access token using Google Identity Services (GIS)
 * directly from accounts.google.com without relying on firebaseapp.com redirect handler.
 */
export async function requestGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  await ensureGisLoaded();

  // 1. Primary: Google Identity Services token client
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    try {
      const token = await new Promise<string>((resolve, reject) => {
        try {
          const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: firebaseConfig.oAuthClientId,
            scope: SCOPES.join(' '),
            prompt: '',
            callback: (response: any) => {
              if (response.error) {
                reject(new Error(response.error_description || response.error));
              } else if (response.access_token) {
                resolve(response.access_token);
              } else {
                reject(new Error('No access token received from Google authorization.'));
              }
            },
            error_callback: (err: any) => {
              reject(new Error(err?.message || 'Google authorization window was closed.'));
            },
          });
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (initErr) {
          reject(initErr);
        }
      });

      if (token) {
        cachedAccessToken = token;
        return token;
      }
    } catch (gisError: any) {
      console.warn('GIS Token client error, falling back to Firebase Auth:', gisError);
      // Fall through to Firebase fallback if GIS failed
    }
  }

  // 2. Fallback: Firebase signInWithPopup
  const authResult = await googleSignIn();
  return authResult.accessToken;
}

/**
 * Initiates interactive Google Sign-In with Google Drive scope.
 */
export async function googleSignIn(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access authorization was not granted.');
    }
    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function getCurrentUser(): User | null {
  return cachedUser;
}

export async function googleSignOut() {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
}

/**
 * Uploads a file (APK / AAB) directly to the user's Google Drive.
 * Makes the file publicly accessible via link so any end user can download it with 1 click.
 */
export async function uploadToGoogleDrive(
  fileBlob: Blob,
  fileName: string,
  onStatusUpdate?: (status: string) => void
): Promise<GoogleDriveUploadResult> {
  let token = await getAccessToken();

  if (!token) {
    onStatusUpdate?.('Connecting to Google Drive via official Google service...');
    token = await requestGoogleAccessToken();
  }

  if (!token) {
    throw new Error('Authentication required: Could not connect to Google Drive.');
  }

  onStatusUpdate?.('Uploading package directly to your Google Drive (My Drive)...');

  // 1. Prepare Multipart Upload for Google Drive REST API v3
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Placed directly in root "My Drive" for instant visibility in Google Drive app & web
  const metadata: any = {
    name: fileName,
    mimeType: 'application/vnd.android.package-archive',
    description: 'Built with AppCreator05',
  };

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${fileBlob.type || 'application/vnd.android.package-archive'}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n';

  // Convert Blob to ArrayBuffer then Base64
  const arrayBuffer = await fileBlob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  const multipartBody = metadataPart + base64Data + closeDelimiter;

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    // If token expired, clear cache and prompt
    if (uploadResponse.status === 401) {
      cachedAccessToken = null;
      throw new Error('Google Drive authorization session expired. Please tap upload again.');
    }
    throw new Error(`Google Drive upload failed (${uploadResponse.status}): ${errorText}`);
  }

  const fileData = await uploadResponse.json();
  const fileId = fileData.id;

  onStatusUpdate?.('Configuring public download permissions...');

  // 2. Set permission: Anyone with link can view/download
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (permError) {
    console.warn('Failed to set public permission:', permError);
  }

  // 3. Construct direct 1-click download link
  const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const webViewLink = fileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

  onStatusUpdate?.('Google Drive upload complete!');

  return {
    fileId,
    fileName: fileData.name || fileName,
    folderName: 'My Drive (আমার ড্রাইভ)',
    webViewLink,
    directDownloadUrl,
    uploadedAt: Date.now(),
  };
}
