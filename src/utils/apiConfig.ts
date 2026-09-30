/**
 * API configuration and base URL resolution.
 * Ensures that even when running inside an Android WebView (where the origin is
 * https://appassets.androidplatform.net) or from embedded blogspot pages,
 * API requests and download preparation always reach the live backend server.
 */

export const CANONICAL_BACKEND_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) ||
  'https://ais-dev-efp2gwmprtbqxmtubrr5na-516868855102.asia-southeast1.run.app';

export function getBackendBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const origin = window.location.origin || '';
  const isAndroidAsset = origin.includes('appassets.androidplatform.net');
  const isForeign =
    origin.includes('blogspot.') ||
    origin.includes('wordpress.') ||
    origin.includes('github.io');

  // If running directly on web (AI Studio dev/preview/shared or localhost):
  // Use relative path ('') so it always connects to the local Express backend
  if (origin && !isAndroidAsset && !isForeign) {
    try {
      localStorage.setItem('apk_creator_backend_url', origin);
    } catch (_) {}
    return '';
  }

  // Check if we have a saved working backend origin
  try {
    const cached = localStorage.getItem('apk_creator_backend_url');
    if (
      cached &&
      !cached.includes('appassets.androidplatform.net') &&
      (cached.startsWith('https://') || cached.startsWith('http://'))
    ) {
      return cached.replace(/\/+$/, '');
    }
  } catch (_) {}

  return CANONICAL_BACKEND_URL;
}

export function buildApiUrl(path: string): string {
  const base = getBackendBaseUrl().replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function isAppAssetsOrHashUrl(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) return true;
  if (trimmed.includes('appassets.androidplatform.net')) return true;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return true;
  return false;
}
