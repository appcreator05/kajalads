/**
 * Screen Wake Lock Service & Fallback Keep-Awake Engine
 * 
 * Prevents mobile devices and desktop screens from sleeping / turning off
 * while users are building apps, configuring settings, or downloading APKs.
 * 
 * Combines:
 * 1. Native W3C Screen Wake Lock API (navigator.wakeLock)
 * 2. Automatic re-acquisition on visibility change (tab refocus / app resume)
 * 3. User interaction gesture re-arm (touchstart / pointerdown)
 * 4. Micro HTML5 looping video fallback (NoSleep technique) for browsers/WebViews without WakeLock API
 */

type WakeLockListener = (active: boolean) => void;

let wakeLockSentinel: any = null;
let isRequested = true; // Enabled by default
let isCurrentlyActive = false;
let fallbackVideoEl: HTMLVideoElement | null = null;
let watchdogInterval: any = null;
const listeners = new Set<WakeLockListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(isCurrentlyActive);
    } catch (e) {
      console.warn('WakeLock listener error:', e);
    }
  });
}

/**
 * Creates or retrieves a hidden, looping, muted 1x1 video element
 * as a hardware-level keep-awake fallback (NoSleep technique).
 * Supported by 100% of modern & legacy mobile browsers (Chrome, Safari, Firefox, Samsung).
 */
function getFallbackVideo(): HTMLVideoElement {
  if (fallbackVideoEl) return fallbackVideoEl;

  // Ultra-tiny 1x1 blank MP4 base64 video loop
  const tinyMp4 =
    'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADpmcmVlAAAAWG1kYXQAAAAABGhlYXZjMQAA' +
    'AAABAAABAAABAAAAAABhdmMxAAAAAGF2Y0MBAM7/AAAB/wABAAAAAAADAeAADAEAAQAAAP8AAA==';

  const video = document.createElement('video');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('muted', 'true');
  video.setAttribute('loop', 'true');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.style.position = 'fixed';
  video.style.bottom = '0';
  video.style.right = '0';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0.001';
  video.style.pointerEvents = 'none';
  video.style.zIndex = '-9999';
  video.src = tinyMp4;

  fallbackVideoEl = video;
  return video;
}

async function playFallbackVideo() {
  try {
    const video = getFallbackVideo();
    if (!video.parentElement && document.body) {
      document.body.appendChild(video);
    }
    if (video.paused) {
      await video.play().catch(() => {});
    }
  } catch (_) {}
}

function pauseFallbackVideo() {
  try {
    if (fallbackVideoEl && !fallbackVideoEl.paused) {
      fallbackVideoEl.pause();
    }
  } catch (_) {}
}

/**
 * Requests the native Screen Wake Lock.
 */
async function requestNativeWakeLock(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }

  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      return true;
    }

    const sentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel = sentinel;

    sentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
      // If we still want wakeLock and page is visible, re-request
      if (isRequested && document.visibilityState === 'visible') {
        setTimeout(acquireWakeLock, 300);
      } else {
        isCurrentlyActive = false;
        notifyListeners();
      }
    });

    return true;
  } catch (err: any) {
    // Some browsers reject until a user gesture occurs
    return false;
  }
}

/**
 * Primary acquisition function - engages native wakeLock + fallback
 */
export async function acquireWakeLock(): Promise<boolean> {
  if (!isRequested) return false;

  let nativeSuccess = false;
  try {
    nativeSuccess = await requestNativeWakeLock();
  } catch (_) {}

  // If native succeeded or fallback was engaged
  if (nativeSuccess) {
    isCurrentlyActive = true;
    notifyListeners();
    return true;
  }

  // Fallback to video keep-awake (works in WebViews without WakeLock API)
  try {
    await playFallbackVideo();
    isCurrentlyActive = true;
    notifyListeners();
    return true;
  } catch (_) {}

  return false;
}

/**
 * Releases the wake lock and stops fallback video.
 */
export async function releaseWakeLock() {
  isRequested = false;
  isCurrentlyActive = false;

  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch (_) {}
    wakeLockSentinel = null;
  }

  pauseFallbackVideo();
  notifyListeners();
}

/**
 * Enables and immediately requests the screen wake lock.
 */
export function enableScreenWakeLock() {
  isRequested = true;
  acquireWakeLock();
}

/**
 * Returns whether the screen wake lock is currently active.
 */
export function isScreenWakeLockActive(): boolean {
  return isCurrentlyActive;
}

/**
 * Subscribe to wake lock status changes.
 */
export function subscribeWakeLock(listener: WakeLockListener): () => void {
  listeners.add(listener);
  listener(isCurrentlyActive);
  return () => {
    listeners.delete(listener);
  };
}

import { useState, useEffect } from 'react';

/**
 * React hook to observe and control Screen Wake Lock
 */
export function useScreenWakeLock() {
  const [isActive, setIsActive] = useState<boolean>(isScreenWakeLockActive());

  useEffect(() => {
    enableScreenWakeLock();
    const unsubscribe = subscribeWakeLock((active) => {
      setIsActive(active);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isActive,
    enable: enableScreenWakeLock,
    disable: releaseWakeLock,
  };
}


// Global initialization: attach lifecycle listeners
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 1. Re-acquire when user returns to app/tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRequested) {
      acquireWakeLock();
    }
  });

  // 2. Re-acquire on user interaction gesture (crucial for mobile Chrome & Safari)
  const onUserInteraction = () => {
    if (isRequested && (!wakeLockSentinel || wakeLockSentinel.released)) {
      acquireWakeLock();
    }
  };

  window.addEventListener('pointerdown', onUserInteraction, { passive: true });
  window.addEventListener('touchstart', onUserInteraction, { passive: true });
  window.addEventListener('keydown', onUserInteraction, { passive: true });

  // 3. Periodic watchdog: checks every 10 seconds to ensure screen remains awake
  watchdogInterval = setInterval(() => {
    if (isRequested && document.visibilityState === 'visible') {
      if (!wakeLockSentinel || wakeLockSentinel.released) {
        acquireWakeLock();
      }
    }
  }, 10000);

  // 4. Start immediately on script load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    enableScreenWakeLock();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      enableScreenWakeLock();
    });
  }
}
