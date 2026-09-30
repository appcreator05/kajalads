/**
 * Utility functions for resizing images on the client side using HTML5 Canvas.
 * - App Logo: Resizes to exact 512x512px with high-quality image smoothing.
 * - Splash Screen: Resizes to exact 1080x1920px (9:16 aspect ratio standard for mobile).
 */

export interface ResizeOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'image/png' | 'image/jpeg';
  fit?: 'cover' | 'contain';
  bgColor?: string;
}

/**
 * Resizes an image (file, blob, data URL, or remote URL) to specific dimensions using Canvas.
 * Supports aspect ratio preservation with center crop ('cover') or letterbox ('contain').
 */
export async function resizeImage(
  source: File | Blob | string,
  width: number,
  height: number,
  options?: {
    fit?: 'cover' | 'contain';
    bgColor?: string;
    format?: 'image/png' | 'image/jpeg';
    quality?: number;
  }
): Promise<string> {
  const fit = options?.fit || 'cover';
  const format = options?.format || 'image/png';
  const quality = options?.quality ?? 0.92;
  const bgColor = options?.bgColor;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let objectUrlToRevoke: string | null = null;

    const cleanUp = () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
        objectUrlToRevoke = null;
      }
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanUp();
          reject(new Error('Failed to create canvas context for image resizing'));
          return;
        }

        // Enable high quality image scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas or fill with background color
        if (bgColor) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, width, height);
        } else if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }

        const srcWidth = img.naturalWidth || img.width;
        const srcHeight = img.naturalHeight || img.height;

        let drawX = 0;
        let drawY = 0;
        let drawWidth = width;
        let drawHeight = height;

        if (fit === 'cover') {
          // Center crop to fill target dimensions without stretching
          const scale = Math.max(width / srcWidth, height / srcHeight);
          drawWidth = srcWidth * scale;
          drawHeight = srcHeight * scale;
          drawX = (width - drawWidth) / 2;
          drawY = (height - drawHeight) / 2;
        } else if (fit === 'contain') {
          // Center fit inside target dimensions
          const scale = Math.min(width / srcWidth, height / srcHeight);
          drawWidth = srcWidth * scale;
          drawHeight = srcHeight * scale;
          drawX = (width - drawWidth) / 2;
          drawY = (height - drawHeight) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        const dataUrl = canvas.toDataURL(format, quality);
        cleanUp();
        resolve(dataUrl);
      } catch (err) {
        cleanUp();
        reject(err);
      }
    };

    img.onerror = (err) => {
      cleanUp();
      reject(err);
    };

    if (typeof source === 'string') {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        // Fetch as blob first to prevent CORS / tainted canvas issues
        fetch(source, { mode: 'cors' })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            return res.blob();
          })
          .then((blob) => {
            objectUrlToRevoke = URL.createObjectURL(blob);
            img.src = objectUrlToRevoke;
          })
          .catch(() => {
            // Direct URL fallback if fetch fails
            img.src = source;
          });
      } else {
        img.src = source;
      }
    } else {
      objectUrlToRevoke = URL.createObjectURL(source);
      img.src = objectUrlToRevoke;
    }
  });
}

/**
 * Resizes any input App Logo to strictly 512x512px (PNG format).
 * Android standard icon requirement for Google Play & Launchers.
 */
export async function resizeLogoTo512(source: File | Blob | string): Promise<string> {
  return resizeImage(source, 512, 512, {
    fit: 'cover',
    format: 'image/png',
  });
}

/**
 * Resizes any input Splash Screen to strictly 1080x1920px (PNG format).
 * Standard 9:16 high-definition mobile portrait splash screen.
 */
export async function resizeSplashTo1080x1920(
  source: File | Blob | string,
  bgColor?: string
): Promise<string> {
  return resizeImage(source, 1080, 1920, {
    fit: 'cover',
    format: 'image/jpeg',
    quality: 0.88,
    bgColor: bgColor || '#070b19',
  });
}
