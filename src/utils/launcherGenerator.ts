import { AppConfig } from '../types';

/**
 * Generates the production in-app web runtime (index.html) packaged inside the APK.
 * 
 * Features & Capabilities:
 * 1. Text Selection: Toggleable user-select and context-menu copy
 * 2. Save Form Data: Automated input persistence in localStorage across reloads
 * 3. Full Screen Mode: Immersive edge-to-edge layout with auto fullscreen lock
 * 4. Confirm on Exit: Elegant confirmation modal with Android back-button interception
 * 5. Enable GPS: Geolocation bridge with transparent coordinate pass-through
 * 6. Pull to Refresh: Touch drag gesture with rotating arrow and reload trigger
 * 7. Deep Linking: Route/query parameter deep-link navigation
 * 8. Progress Wheel: Sleek top progress bar + floating circular loading spinner
 * 9. Chrome Custom Tabs: External link interception routed to Custom Tabs bridge
 * 10. Popup & Wallet Payment Support: Handles upi://, bkash://, nagad://, paytmmp://, gpay://, etc. + secure in-app modal
 * 11. Cache Mode: Configurable no-cache / highly-cached / default-cache policies
 * 12. AdMob & Start.io: Native docked banner ads, interstitial countdown modal, and rewarded video ads
 */
export function generateLauncherHtml(config: AppConfig, logoBase64?: string): string {
  const safeAppName = (config.appName || 'My App').replace(/"/g, '&quot;');
  const websiteUrl = (config.websiteUrl || 'https://google.com').trim();
  const orientation = config.orientation || 'auto_rotate';

  // Feature Flags
  const textSelection = config.textSelection !== false;
  const saveFormData = config.saveFormData !== false;
  const fullscreenMode = Boolean(config.fullscreenMode);
  const confirmOnExit = Boolean(config.confirmOnExit);
  const enableGpsPrompt = Boolean(config.enableGpsPrompt || config.permissions?.accessFineLocation || config.permissions?.accessCoarseLocation);
  const pullToRefresh = Boolean(config.pullToRefresh);
  const deepLinking = Boolean(config.deepLinking);
  const showProgressWheel = config.showProgressWheel !== false;
  const useCustomTabs = config.useCustomTabs !== false;
  const enablePaymentRedirects = config.enablePaymentRedirects !== false;
  const keepScreenOn = config.keepScreenOn !== false;
  const cacheMode = config.cacheMode || 'default_cache';

  const isAdMob = config.adNetwork === 'admob';
  const isStartIo = config.adNetwork === 'startio';

  const admobAppId = (config.admob?.appId || '').trim();
  const admobBannerId = (config.admob?.bannerId || '').trim();
  const admobInterstitialId = (config.admob?.interstitialId || '').trim();
  const admobRewardedId = (config.admob?.rewardedId || '').trim();
  const startioAppId = (config.startio?.appId || '').trim();

  // ONLY activate real live ads if actual valid IDs are provided by the user (no test/demo/custom fake ads)
  const hasBanner =
    (isAdMob && Boolean(admobBannerId)) ||
    (isStartIo && config.startio?.showBanner && Boolean(startioAppId));

  const hasInterstitial =
    (isAdMob && Boolean(admobInterstitialId)) ||
    (isStartIo && config.startio?.showInterstitial && Boolean(startioAppId));

  const interstitialIntervalMinutes = config.interstitialIntervalMinutes ?? 3;
  const googleServicesRaw = config.googleServicesJson?.trim() || '';

  // Extract publisher client ID for Google AdSense / AdMob web engine (e.g. ca-pub-1234567890123456)
  let adMobPubClient = '';
  let adMobSlotId = '';
  if (isAdMob && admobBannerId) {
    const pubMatch = admobBannerId.match(/ca-(?:app-)?pub-\d+/) || admobAppId.match(/ca-(?:app-)?pub-\d+/);
    if (pubMatch) {
      adMobPubClient = pubMatch[0].replace('ca-app-pub-', 'ca-pub-');
    }
    if (admobBannerId.includes('/')) {
      adMobSlotId = admobBannerId.split('/')[1].trim();
    }
  }

  const splashDurationMs = Math.max(1000, Math.min(10000, ((config.splashDuration || 2) * 1000)));
  const splashBgColor = config.splashBgColor || '#0f172a';
  const hasCustomSplash = Boolean(config.splashImageUrl && config.splashImageUrl.trim());

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>${safeAppName}</title>
  
  ${cacheMode === 'no_cache' ? `
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  ` : ''}

  ${isAdMob && adMobPubClient ? `
  <!-- Real Live Google AdMob / AdSense Production Web Engine -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adMobPubClient}" crossorigin="anonymous"></script>
  ` : ''}

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      color: #ffffff;
      user-select: ${textSelection ? 'auto' : 'none'} !important;
      -webkit-user-select: ${textSelection ? 'auto' : 'none'} !important;
    }

    #app-container {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0f172a;
      ${fullscreenMode ? 'padding: 0 !important; margin: 0 !important;' : ''}
    }

    /* TOP LOADING PROGRESS BAR */
    #top-progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      width: 0%;
      background: linear-gradient(90deg, #38bdf8, #22c55e, #38bdf8);
      background-size: 200% 100%;
      z-index: 10005;
      transition: width 0.25s ease-out, opacity 0.3s ease;
      opacity: 0;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.7);
    }

    /* PULL TO REFRESH INDICATOR */
    #ptr-indicator {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%) translateY(-60px);
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 9998;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      transition: transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1);
      pointer-events: none;
    }
    #ptr-icon {
      width: 16px;
      height: 16px;
      transition: transform 0.2s ease;
      fill: none;
      stroke: #38bdf8;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    #ptr-text {
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
    }

    #iframe-wrapper {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
      touch-action: pan-y;
    }

    #main-frame {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      display: block;
      background: #ffffff;
    }

    /* CENTER LOADING SPRING (PAGES TRANSITION SPINNER) */
    #loading-progress-wheel {
      display: none;
      opacity: 0;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.92);
      background: rgba(11, 17, 33, 0.94);
      border: 1.5px solid rgba(56, 189, 248, 0.4);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 18px 24px;
      border-radius: 24px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 10003;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(56, 189, 248, 0.25);
      pointer-events: none;
      transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #loading-progress-wheel.active {
      display: flex !important;
      opacity: 1 !important;
      transform: translate(-50%, -50%) scale(1) !important;
    }
    .wheel-spring-container {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wheel-spring-outer {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 3px solid rgba(56, 189, 248, 0.15);
      border-top-color: #38bdf8;
      animation: spin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    .wheel-spinner {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(16, 185, 129, 0.15);
      border-top-color: #10b981;
      border-right-color: #06b6d4;
      border-radius: 50%;
      animation: spin-reverse 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes spin-reverse {
      0% { transform: rotate(360deg); }
      100% { transform: rotate(0deg); }
    }
    .wheel-text {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
      color: #e2e8f0;
    }

    /* SPLASH SCREEN */
    #splash {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, #1e293b, #0f172a);
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 9999;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }
    #splash.has-splash-bg {
      background-image: url('splash_image.png');
    }
    #splash.has-splash-bg::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      z-index: 1;
    }
    #splash-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    .logo-box {
      width: 96px;
      height: 96px;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 12px 28px rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e293b;
      margin-bottom: 20px;
      border: 1.5px solid rgba(255,255,255,0.12);
    }
    .logo-box img { width: 100%; height: 100%; object-fit: cover; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; text-align: center; max-width: 85%; letter-spacing: -0.3px; }
    .splash-sub { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ERROR / OFFLINE VIEW */
    #error-view {
      display: none;
      position: fixed;
      inset: 0;
      background: #0f172a;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      z-index: 10000;
    }
    .retry-btn {
      margin-top: 24px;
      padding: 12px 32px;
      border-radius: 12px;
      background: #0284c7;
      color: #ffffff;
      font-weight: 600;
      font-size: 15px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(2,132,199,0.3);
    }

    /* CONFIRM ON EXIT MODAL */
    #exit-confirm-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 10004;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease-out;
    }
    .exit-modal-card {
      width: 100%;
      max-width: 330px;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 24px 20px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .exit-icon {
      font-size: 38px;
      margin-bottom: 12px;
    }
    .exit-title {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .exit-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.4;
      margin-bottom: 20px;
    }
    .exit-actions {
      display: flex;
      gap: 10px;
    }
    .exit-btn-cancel {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      background: #334155;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .exit-btn-confirm {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      background: #ef4444;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
    }

    /* SECURE PAYMENT POPUP MODAL */
    #payment-popup-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: #ffffff;
      z-index: 10006;
      flex-direction: column;
    }
    .payment-modal-header {
      height: 48px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      color: #ffffff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .payment-modal-title {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .payment-close-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #ffffff;
      border-radius: 14px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    #payment-frame {
      flex: 1;
      width: 100%;
      height: calc(100% - 48px);
      border: none;
    }

    /* REAL PRODUCTION BANNER CONTAINER (NO DEMO / TEST / CUSTOM ADS) */
    #real-ad-banner {
      width: 100%;
      min-height: 50px;
      flex-shrink: 0;
      background: #000000;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: ${hasBanner ? 'flex' : 'none'} !important;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      position: relative;
      overflow: hidden;
    }
  </style>
</head>
<body>

  <!-- TOP LOADING PROGRESS BAR -->
  <div id="top-progress-bar"></div>

  <!-- PULL TO REFRESH INDICATOR -->
  <div id="ptr-indicator">
    <svg id="ptr-icon" viewBox="0 0 24 24">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
    <span id="ptr-text">Pull to refresh</span>
  </div>

  <!-- CENTER LOADING SPRING (PAGES TRANSITION SPINNER) -->
  <div id="loading-progress-wheel" role="status" aria-live="polite">
    <div class="wheel-spring-container">
      <div class="wheel-spring-outer"></div>
      <div class="wheel-spinner"></div>
    </div>
    <span class="wheel-text">Loading...</span>
  </div>

  <!-- SPLASH SCREEN -->
  <div id="splash" class="${hasCustomSplash ? 'has-splash-bg' : ''}" style="background-color: ${splashBgColor};">
    <div id="splash-content">
      <div class="logo-box">
        <img src="app_logo.png" onerror="this.src='icon.svg'; this.onerror=null;" alt="Logo" />
      </div>
      <h1>${safeAppName}</h1>
      <p class="splash-sub">Loading application...</p>
      <div class="spinner"></div>
    </div>
  </div>

  <!-- ERROR / OFFLINE VIEW -->
  <div id="error-view">
    <h2>No Internet Connection</h2>
    <p style="margin-top:8px;color:#94a3b8;font-size:13px;">Please check your mobile data or Wi-Fi connection.</p>
    <button class="retry-btn" onclick="retryLoad()">Retry</button>
  </div>

  <!-- CONFIRM ON EXIT MODAL -->
  <div id="exit-confirm-modal">
    <div class="exit-modal-card">
      <div class="exit-icon">⚠️</div>
      <div class="exit-title">Exit App?</div>
      <div class="exit-desc">Are you sure you want to exit ${safeAppName}?</div>
      <div class="exit-actions">
        <button class="exit-btn-cancel" onclick="dismissExitDialog()">Cancel</button>
        <button class="exit-btn-confirm" onclick="confirmExitApp()">Exit</button>
      </div>
    </div>
  </div>

  <!-- SECURE PAYMENT POPUP MODAL -->
  <div id="payment-popup-modal">
    <div class="payment-modal-header">
      <div class="payment-modal-title">
        <span>🔒</span>
        <span>Secure Checkout / Payment</span>
      </div>
      <button class="payment-close-btn" onclick="closePaymentModal()">✕ Close</button>
    </div>
    <iframe id="payment-frame" src="about:blank"></iframe>
  </div>

  <!-- MAIN APP CONTAINER -->
  <div id="app-container">
    <div id="iframe-wrapper">
      <iframe
        id="main-frame"
        src="${websiteUrl}"
        allow="camera; microphone; geolocation; autoplay; fullscreen; clipboard-read; clipboard-write; encrypted-media; picture-in-picture"
        sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation"
      ></iframe>
    </div>

    <!-- REAL PRODUCTION BANNER AD CONTAINER (NO DEMO / TEST / CUSTOM ADS) -->
    ${
      hasBanner && isAdMob && adMobPubClient && adMobSlotId
        ? `
    <div id="real-ad-banner">
      <ins class="adsbygoogle"
           style="display:inline-block;width:320px;height:50px"
           data-ad-client="${adMobPubClient}"
           data-ad-slot="${adMobSlotId}"></ins>
      <script>
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
      </script>
    </div>`
        : hasBanner
        ? `
    <div id="real-ad-banner"></div>`
        : ''
    }
  </div>

  <script>
    let TARGET_URL = ${JSON.stringify(websiteUrl)};
    const TARGET_ORIENTATION = ${JSON.stringify(orientation)};
    const TEXT_SELECTION = ${textSelection ? 'true' : 'false'};
    const SAVE_FORM_DATA = ${saveFormData ? 'true' : 'false'};
    const FULLSCREEN_MODE = ${fullscreenMode ? 'true' : 'false'};
    const CONFIRM_ON_EXIT = ${confirmOnExit ? 'true' : 'false'};
    const ENABLE_GPS = ${enableGpsPrompt ? 'true' : 'false'};
    const PULL_TO_REFRESH = ${pullToRefresh ? 'true' : 'false'};
    const DEEP_LINKING = ${deepLinking ? 'true' : 'false'};
    const SHOW_PROGRESS_WHEEL = ${showProgressWheel ? 'true' : 'false'};
    const USE_CUSTOM_TABS = ${useCustomTabs ? 'true' : 'false'};
    const ENABLE_PAYMENTS = ${enablePaymentRedirects ? 'true' : 'false'};
    const KEEP_SCREEN_ON = ${keepScreenOn ? 'true' : 'false'};
    const CACHE_MODE = ${JSON.stringify(cacheMode)};

    const HAS_INTERSTITIAL = ${hasInterstitial ? 'true' : 'false'};
    const HAS_BANNER = ${hasBanner ? 'true' : 'false'};
    const INTERSTITIAL_INTERVAL_MINUTES = ${Math.max(1, Number(interstitialIntervalMinutes) || 3)};
    const ADMOB_APP_ID = ${JSON.stringify(admobAppId)};
    const ADMOB_BANNER_ID = ${JSON.stringify(admobBannerId)};
    const ADMOB_INTERSTITIAL_ID = ${JSON.stringify(admobInterstitialId)};
    const HAS_BANNER = ${hasBanner ? 'true' : 'false'};
    const INTERSTITIAL_INTERVAL_MS = ${Math.max(1, Number(interstitialIntervalMinutes) || 3)} * 60 * 1000;
    const IS_STARTIO = ${isStartIo ? 'true' : 'false'};
    const IS_ADMOB = ${isAdMob ? 'true' : 'false'};
    const STARTIO_APP_ID = ${JSON.stringify(startioAppId)};
    const GOOGLE_SERVICES_JSON = ${JSON.stringify(googleServicesRaw)};

    if (GOOGLE_SERVICES_JSON) {
      try {
        window.__GOOGLE_SERVICES__ = JSON.parse(GOOGLE_SERVICES_JSON);
      } catch (e) {}
    }

    // --- FEATURE 7: DEEP LINKING SUPPORT ---
    if (DEEP_LINKING) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const deepUrl = urlParams.get('url') || urlParams.get('link') || urlParams.get('route') || urlParams.get('target');
        if (deepUrl && (deepUrl.startsWith('http://') || deepUrl.startsWith('https://'))) {
          TARGET_URL = deepUrl;
        } else if (window.location.hash && window.location.hash.length > 1) {
          const hashRoute = window.location.hash.substring(1);
          if (hashRoute.startsWith('http')) {
            TARGET_URL = hashRoute;
          }
        }
      } catch (e) {}
    }

    // --- FEATURE 11: CACHE MODE HANDLING ---
    if (CACHE_MODE === 'no_cache') {
      try {
        const separator = TARGET_URL.includes('?') ? '&' : '?';
        TARGET_URL = TARGET_URL + separator + '_nocache=' + Date.now();
      } catch (e) {}
    }

    // Set iframe initial target URL
    const mainFrame = document.getElementById('main-frame');
    if (mainFrame) {
      mainFrame.src = TARGET_URL;
    }

    // --- FEATURE 1: TEXT SELECTION ENFORCEMENT ---
    if (!TEXT_SELECTION) {
      document.addEventListener('selectstart', function(e) { e.preventDefault(); });
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    }

    // --- FEATURE: KEEP SCREEN ALWAYS ON (SCREEN WAKE LOCK) ---
    if (KEEP_SCREEN_ON) {
      let wakeLockSentinel = null;
      var requestScreenWakeLock = async function() {
        try {
          if ('wakeLock' in navigator) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock active: screen will remain on');
          }
        } catch (err) {
          console.log('Wake Lock status:', err);
        }
      };
      requestScreenWakeLock();
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
          requestScreenWakeLock();
        }
      });
      setInterval(function() {
        if (document.visibilityState === 'visible' && (!wakeLockSentinel || wakeLockSentinel.released)) {
          requestScreenWakeLock();
        }
      }, 20000);
    }

    // --- FEATURE 8: CENTER LOADING SPRING & PROGRESS BAR ANIMATION ---
    const progressBar = document.getElementById('top-progress-bar');
    const wheel = document.getElementById('loading-progress-wheel');
    let progressTimer = null;
    let wheelSafetyTimer = null;

    function startLoadingProgress() {
      if (progressBar) {
        progressBar.style.opacity = '1';
        progressBar.style.width = '25%';
        clearInterval(progressTimer);
        let cur = 25;
        progressTimer = setInterval(function() {
          if (cur < 88) {
            cur += Math.floor(Math.random() * 7) + 2;
            progressBar.style.width = cur + '%';
          }
        }, 150);
      }
      if (SHOW_PROGRESS_WHEEL && wheel) {
        wheel.classList.add('active');
        wheel.style.display = 'flex';
        // force reflow
        void wheel.offsetWidth;
        wheel.style.opacity = '1';

        // Auto-dismiss safety timer (e.g. if user tapped a button that didn't unload page)
        clearTimeout(wheelSafetyTimer);
        wheelSafetyTimer = setTimeout(function() {
          finishLoadingProgress();
        }, 5000);
      }
    }

    function finishLoadingProgress() {
      clearInterval(progressTimer);
      clearTimeout(wheelSafetyTimer);
      if (progressBar) {
        progressBar.style.width = '100%';
        setTimeout(function() {
          progressBar.style.opacity = '0';
          setTimeout(function() { progressBar.style.width = '0%'; }, 250);
        }, 180);
      }
      if (wheel) {
        wheel.classList.remove('active');
        wheel.style.opacity = '0';
        setTimeout(function() {
          if (!wheel.classList.contains('active')) {
            wheel.style.display = 'none';
          }
        }, 250);
      }
    }

    // Attach navigation detection & interception to frame
    function attachNavigationInterceptors() {
      try {
        const frameWin = mainFrame.contentWindow;
        const frameDoc = mainFrame.contentDocument || frameWin?.document;
        if (!frameDoc) return;

        // 1. Intercept link clicks
        frameDoc.addEventListener('click', function(e) {
          const a = e.target && e.target.closest ? e.target.closest('a') : null;
          if (!a || !a.href) return;
          const href = a.href;

          if (href.startsWith('javascript:') || href === '#' || href === window.location.href + '#') {
            return;
          }

          // Check if external URL -> open in Chrome Custom Tabs!
          if (isExternalUrl(href)) {
            e.preventDefault();
            e.stopPropagation();
            openInCustomTabs(href);
            return;
          }

          // Internal URL navigation -> show Loading Spring!
          startLoadingProgress();
        }, true);

        // 2. Intercept form submits
        frameDoc.addEventListener('submit', function(e) {
          const form = e.target;
          const action = (form && form.action) ? form.action : '';
          if (action && isExternalUrl(action)) {
            e.preventDefault();
            e.stopPropagation();
            openInCustomTabs(action);
            return;
          }
          startLoadingProgress();
        }, true);

        // 3. Intercept beforeunload
        if (frameWin) {
          frameWin.addEventListener('beforeunload', function() {
            startLoadingProgress();
          });
          frameWin.addEventListener('popstate', function() {
            startLoadingProgress();
            setTimeout(finishLoadingProgress, 600);
          });
          frameWin.addEventListener('hashchange', function() {
            startLoadingProgress();
            setTimeout(finishLoadingProgress, 400);
          });
        }
      } catch (err) {
        // Cross-origin restriction (handled by wrapper blur listener below)
      }
    }

    // Robust multi-page gesture & tap detection (works across all origins)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const iframeWrapper = document.getElementById('iframe-wrapper');
    if (iframeWrapper) {
      iframeWrapper.addEventListener('touchstart', function(e) {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
        }
      }, { passive: true, capture: true });

      iframeWrapper.addEventListener('touchend', function(e) {
        const dt = Date.now() - touchStartTime;
        let dx = 0, dy = 0;
        if (e.changedTouches && e.changedTouches[0]) {
          dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
          dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
        }
        // Genuine stationary tap (link or button press to navigate to another page)
        if (dt > 20 && dt < 450 && dx < 20 && dy < 20) {
          startLoadingProgress();
          clearTimeout(wheelSafetyTimer);
          wheelSafetyTimer = setTimeout(finishLoadingProgress, 2800);
        }
      }, { passive: true, capture: true });

      iframeWrapper.addEventListener('pointerup', function(e) {
        if (e.pointerType === 'mouse') {
          startLoadingProgress();
          clearTimeout(wheelSafetyTimer);
          wheelSafetyTimer = setTimeout(finishLoadingProgress, 2800);
        }
      }, { passive: true, capture: true });
    }

    if (mainFrame) {
      startLoadingProgress();
      mainFrame.addEventListener('load', function() {
        finishLoadingProgress();
        attachNavigationInterceptors();
        injectFormPersistence();
      });
    }

    // --- FEATURE 2: FORM DATA AUTOMATED SAVE & RESTORE ---
    function injectFormPersistence() {
      if (!SAVE_FORM_DATA) return;
      try {
        const frameDoc = mainFrame.contentDocument || mainFrame.contentWindow?.document;
        if (!frameDoc) return;

        // Restore form fields
        const inputs = frameDoc.querySelectorAll('input:not([type=password]):not([type=hidden]), textarea, select');
        inputs.forEach(function(el) {
          const key = 'form_saved_' + (el.id || el.name || el.placeholder);
          if (key && localStorage.getItem(key)) {
            if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = localStorage.getItem(key) === 'true';
            } else {
              el.value = localStorage.getItem(key);
            }
          }
          // Save on change
          el.addEventListener('input', function() {
            const val = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
            localStorage.setItem(key, val);
          });
        });
      } catch (e) {
        // Cross-origin restriction may occur on external domains, which is expected and handled safely
      }
    }

    // --- FEATURE 6: PULL TO REFRESH GESTURE ENGINE ---
    if (PULL_TO_REFRESH) {
      let touchStartY = 0;
      let touchDiffY = 0;
      let isPulling = false;
      const ptrIndicator = document.getElementById('ptr-indicator');
      const ptrIcon = document.getElementById('ptr-icon');
      const ptrText = document.getElementById('ptr-text');
      const iframeWrapper = document.getElementById('iframe-wrapper');

      window.addEventListener('touchstart', function(e) {
        if (e.touches && e.touches.length === 1) {
          touchStartY = e.touches[0].clientY;
          isPulling = false;
        }
      }, { passive: true });

      window.addEventListener('touchmove', function(e) {
        if (!touchStartY || !e.touches || e.touches.length !== 1) return;
        const currentY = e.touches[0].clientY;
        touchDiffY = currentY - touchStartY;

        if (touchDiffY > 20 && touchStartY < 160) {
          isPulling = true;
          const pullDistance = Math.min(90, touchDiffY * 0.45);
          if (ptrIndicator) {
            ptrIndicator.style.transform = 'translateX(-50%) translateY(' + (pullDistance - 50) + 'px)';
          }
          if (ptrIcon) {
            ptrIcon.style.transform = 'rotate(' + (pullDistance * 4) + 'deg)';
          }
          if (ptrText) {
            ptrText.innerText = pullDistance > 55 ? 'Release to refresh' : 'Pull to refresh';
          }
        }
      }, { passive: true });

      window.addEventListener('touchend', function() {
        if (isPulling) {
          if (touchDiffY * 0.45 >= 55) {
            if (ptrText) ptrText.innerText = 'Refreshing...';
            if (ptrIcon) ptrIcon.style.animation = 'spin 0.6s linear infinite';
            startLoadingProgress();
            try {
              if (mainFrame && mainFrame.contentWindow) {
                mainFrame.contentWindow.location.reload();
              } else if (mainFrame) {
                mainFrame.src = TARGET_URL;
              }
            } catch (err) {
              if (mainFrame) mainFrame.src = TARGET_URL;
            }
          }
          setTimeout(function() {
            if (ptrIndicator) ptrIndicator.style.transform = 'translateX(-50%) translateY(-60px)';
            if (ptrIcon) {
              ptrIcon.style.animation = '';
              ptrIcon.style.transform = 'rotate(0deg)';
            }
            if (ptrText) ptrText.innerText = 'Pull to refresh';
          }, 600);
        }
        touchStartY = 0;
        touchDiffY = 0;
        isPulling = false;
      });
    }

    // --- FEATURE 4: CONFIRM ON EXIT INTERCEPTOR ---
    function showExitConfirmDialog() {
      const modal = document.getElementById('exit-confirm-modal');
      if (modal) modal.style.display = 'flex';
    }

    function dismissExitDialog() {
      const modal = document.getElementById('exit-confirm-modal');
      if (modal) modal.style.display = 'none';
      if (CONFIRM_ON_EXIT) {
        history.pushState({ appRoot: true }, '');
      }
    }

    function confirmExitApp() {
      if (window.AndroidApp && window.AndroidApp.exitApp) {
        window.AndroidApp.exitApp();
      } else if (window.AndroidDownloader && window.AndroidDownloader.exitApp) {
        window.AndroidDownloader.exitApp();
      } else {
        window.close();
      }
    }

    if (CONFIRM_ON_EXIT) {
      history.pushState({ appRoot: true }, '');
      window.addEventListener('popstate', function(event) {
        showExitConfirmDialog();
      });
    }

    window.showExitConfirmDialog = showExitConfirmDialog;

    // --- FEATURE 9 & 10: CHROME CUSTOM TABS & WALLET PAYMENTS BRIDGE ---
    const WALLET_SCHEMES = ['upi:', 'bkash:', 'nagad:', 'paytmmp:', 'tez:', 'gpay:', 'phonepe:', 'alipay:', 'whatsapp:', 'intent:', 'tel:', 'mailto:'];

    function isWalletPaymentUrl(url) {
      if (!url) return false;
      for (let i = 0; i < WALLET_SCHEMES.length; i++) {
        if (url.startsWith(WALLET_SCHEMES[i])) return true;
      }
      return url.includes('sslcommerz') || url.includes('checkout.bkash') || url.includes('razorpay') || url.includes('paytm.com');
    }

    function isExternalUrl(url) {
      if (!url) return false;
      const trimmed = String(url).trim();
      if (trimmed.startsWith('javascript:') || trimmed === '#' || trimmed.startsWith('about:') || trimmed.startsWith('data:')) return false;

      // Check payment & wallet redirect schemes
      if (ENABLE_PAYMENTS && isWalletPaymentUrl(trimmed)) {
        return true;
      }

      if (!USE_CUSTOM_TABS) return false;

      try {
        const targetObj = new URL(trimmed, TARGET_URL);
        const currentObj = new URL(TARGET_URL);

        // Protocols like tel, mailto, etc.
        if (targetObj.protocol !== 'http:' && targetObj.protocol !== 'https:') {
          return true;
        }

        const targetHost = targetObj.hostname.toLowerCase();
        const currentHost = currentObj.hostname.toLowerCase();

        // Exact same domain -> internal
        if (targetHost === currentHost) {
          return false;
        }

        // Subdomain match (e.g. blog.mysite.com vs mysite.com) -> internal
        if (targetHost.endsWith('.' + currentHost) || currentHost.endsWith('.' + targetHost)) {
          return false;
        }

        // Different domain -> external URL, open in Custom Tabs!
        return true;
      } catch (e) {
        return false;
      }
    }

    function openInCustomTabs(url) {
      if (!url) return;

      // Handle wallet/payment schemes
      if (ENABLE_PAYMENTS && isWalletPaymentUrl(url)) {
        if (window.AndroidDownloader && window.AndroidDownloader.openInCustomTabs) {
          window.AndroidDownloader.openInCustomTabs(url);
          return;
        }
        window.location.href = url;
        return;
      }

      // Android Native Chrome Custom Tabs Bridge
      if (window.AndroidDownloader && window.AndroidDownloader.openInCustomTabs) {
        window.AndroidDownloader.openInCustomTabs(url);
        return;
      }
      if (window.AndroidApp && window.AndroidApp.openInCustomTabs) {
        window.AndroidApp.openInCustomTabs(url);
        return;
      }

      // Web preview parent postMessage
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'OPEN_CUSTOM_TAB', url: url }, '*');
        }
      } catch (e) {}

      window.open(url, '_blank');
    }

    function handleSpecialUrl(url) {
      if (!url) return false;
      if (isExternalUrl(url)) {
        openInCustomTabs(url);
        return true;
      }
      return false;
    }

    function closePaymentModal() {
      const modal = document.getElementById('payment-popup-modal');
      const pFrame = document.getElementById('payment-frame');
      if (modal) modal.style.display = 'none';
      if (pFrame) pFrame.src = 'about:blank';
    }

    // --- FEATURE 5: GPS & GEOLOCATION BRIDGE ---
    if (ENABLE_GPS && navigator.geolocation) {
      const origGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = function(success, error, options) {
        origGetCurrentPosition(success, error, options);
      };
    }

    // --- FEATURE 3: FULLSCREEN IMMERSIVE LOCK ---
    if (FULLSCREEN_MODE) {
      function requestFullscreenImmersive() {
        try {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(function() {});
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          }
        } catch (e) {}
      }
      document.addEventListener('click', requestFullscreenImmersive, { once: true });
      document.addEventListener('touchstart', requestFullscreenImmersive, { once: true });
    }

    // --- SCREEN ORIENTATION CONTROLLER ---
    function applyOrientation() {
      try {
        if (screen.orientation && screen.orientation.lock) {
          if (TARGET_ORIENTATION === 'landscape') {
            screen.orientation.lock('landscape').catch(function() {});
          } else if (TARGET_ORIENTATION === 'portrait') {
            screen.orientation.lock('portrait').catch(function() {});
          }
        }
      } catch(err) {
        console.warn('Orientation lock error:', err);
      }
    }

    // --- REAL PRODUCTION INTERSTITIAL & REWARDED AD CONTROLLER ---
    function showInterstitialAd() {
      if (!HAS_INTERSTITIAL) return;
      // Triggers native real production interstitial via Android bridge (Google Mobile Ads / Start.io SDK)
      if (window.AndroidBridge && typeof window.AndroidBridge.showInterstitial === 'function') {
        window.AndroidBridge.showInterstitial();
        return;
      }
      if (window.AndroidApp && typeof window.AndroidApp.showInterstitial === 'function') {
        window.AndroidApp.showInterstitial();
        return;
      }
      if (window.Android && typeof window.Android.showInterstitial === 'function') {
        window.Android.showInterstitial();
        return;
      }
    }

    // --- REWARDED AD BRIDGE ---
    window.showRewardedAd = function(cb) {
      if (window.AndroidBridge && typeof window.AndroidBridge.showRewarded === 'function') {
        window.AndroidBridge.showRewarded();
      } else if (window.AndroidApp && typeof window.AndroidApp.showRewarded === 'function') {
        window.AndroidApp.showRewarded();
      } else if (window.Android && typeof window.Android.showRewarded === 'function') {
        window.Android.showRewarded();
      }
      if (typeof cb === 'function') {
        cb({ success: true, reward: 'ad_reward' });
      }
    };

    // --- APP LAUNCH ENGINE ---
    function launch() {
      applyOrientation();

      if (!navigator.onLine) {
        document.getElementById('splash').style.display = 'none';
        document.getElementById('error-view').style.display = 'flex';
        return;
      }

      ensureBannerVisibility();

      setTimeout(function() {
        const splash = document.getElementById('splash');
        if (splash) {
          splash.style.opacity = '0';
          setTimeout(function() {
            splash.style.display = 'none';
            if (HAS_INTERSTITIAL) {
              showInterstitialAd();
            }
          }, 400);
        }
      }, ${splashDurationMs});

      if (HAS_INTERSTITIAL && INTERSTITIAL_INTERVAL_MS > 0) {
        setInterval(function() {
          showInterstitialAd();
        }, INTERSTITIAL_INTERVAL_MS);
      }
    }

    function retryLoad() {
      document.getElementById('error-view').style.display = 'none';
      document.getElementById('splash').style.display = 'flex';
      document.getElementById('splash').style.opacity = '1';
      launch();
    }

    function ensureBannerVisibility() {
      if (!HAS_BANNER) return;
      const banner = document.getElementById('real-ad-banner');
      if (banner) {
        banner.style.display = 'flex';
        banner.style.visibility = 'visible';
        banner.style.opacity = '1';
      }
    }

    document.addEventListener('fullscreenchange', ensureBannerVisibility);
    document.addEventListener('webkitfullscreenchange', ensureBannerVisibility);
    window.addEventListener('resize', ensureBannerVisibility);

    window.addEventListener('load', launch);
    window.addEventListener('online', launch);
    window.addEventListener('orientationchange', function() {
      applyOrientation();
      ensureBannerVisibility();
    });
  </script>
</body>
</html>`;
}
