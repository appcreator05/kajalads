import { AppConfig, DEFAULT_APP_CONFIG } from '../types';

const DB_NAME = 'appcreator05_storage_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_store';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores large media string (data URL or base64) securely in IndexedDB
 * avoiding browser localStorage 5MB quota exhaustion.
 */
export async function saveMediaItem(key: string, dataUrl: string): Promise<void> {
  if (!dataUrl || !key) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveMediaItem fallback:', err);
    try {
      localStorage.setItem(`appcreator05_${key}`, dataUrl);
    } catch (_) {}
  }
}

/**
 * Retrieves stored media string (data URL or base64) from IndexedDB or localStorage
 */
export async function getMediaItem(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && typeof req.result === 'string') {
          resolve(req.result);
        } else {
          // Fallback to localStorage
          resolve(localStorage.getItem(`appcreator05_${key}`));
        }
      };
      req.onerror = () => {
        resolve(localStorage.getItem(`appcreator05_${key}`));
      };
    });
  } catch (_) {
    return localStorage.getItem(`appcreator05_${key}`);
  }
}

/**
 * Persists the entire application configuration safely:
 * - Saves lightweight config JSON in localStorage
 * - Saves high-res App Logo and Splash Screen in IndexedDB
 */
export async function persistAppConfig(config: AppConfig): Promise<void> {
  try {
    // 1. Save media to IndexedDB
    if (config.appLogoUrl && config.appLogoUrl.startsWith('data:')) {
      await saveMediaItem('app_logo', config.appLogoUrl);
    }
    if (config.splashImageUrl && config.splashImageUrl.startsWith('data:')) {
      await saveMediaItem('splash_image', config.splashImageUrl);
    }

    // 2. Save full config to localStorage
    try {
      localStorage.setItem('webtoapk_saved_config', JSON.stringify(config));
    } catch (quotaError) {
      // If quota exceeded, store a clean config with placeholder media in localStorage
      // while the full data URLs remain safe in IndexedDB
      const slimConfig = {
        ...config,
        appLogoUrl: config.appLogoUrl?.startsWith('data:') ? '__INDEXED_DB_LOGO__' : config.appLogoUrl,
        splashImageUrl: config.splashImageUrl?.startsWith('data:') ? '__INDEXED_DB_SPLASH__' : config.splashImageUrl,
      };
      localStorage.setItem('webtoapk_saved_config', JSON.stringify(slimConfig));
    }
  } catch (err) {
    console.warn('Failed to persist app config:', err);
  }
}

/**
 * Restores the complete application configuration on startup
 */
export async function restoreAppConfig(): Promise<AppConfig> {
  let baseConfig = { ...DEFAULT_APP_CONFIG };

  try {
    const saved = localStorage.getItem('webtoapk_saved_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      baseConfig = { ...DEFAULT_APP_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse saved config from localStorage:', e);
  }

  // Restore logo and splash from IndexedDB if saved or placeholder
  try {
    const [savedLogo, savedSplash] = await Promise.all([
      getMediaItem('app_logo'),
      getMediaItem('splash_image'),
    ]);

    if (savedLogo && (baseConfig.appLogoUrl === '__INDEXED_DB_LOGO__' || !baseConfig.appLogoUrl || baseConfig.appLogoUrl === '/logo.png')) {
      baseConfig.appLogoUrl = savedLogo;
    } else if (savedLogo && savedLogo.startsWith('data:')) {
      baseConfig.appLogoUrl = savedLogo;
    }

    if (savedSplash && (baseConfig.splashImageUrl === '__INDEXED_DB_SPLASH__' || !baseConfig.splashImageUrl || baseConfig.splashImageUrl === '/splash.png')) {
      baseConfig.splashImageUrl = savedSplash;
    } else if (savedSplash && savedSplash.startsWith('data:')) {
      baseConfig.splashImageUrl = savedSplash;
    }
  } catch (err) {
    console.warn('Failed to restore media from IndexedDB:', err);
  }

  return baseConfig;
}
