import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Play,
  Maximize2,
  Volume2,
  X,
  Award,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  Sparkles,
  CreditCard,
  Lock,
  Share2,
  Check,
  Smartphone,
  Phone,
  MessageSquare,
  Camera,
  Settings,
  Wifi,
  Battery,
  Search,
  Image as ImageIcon,
} from 'lucide-react';
import { AppConfig } from '../types';

interface MobileDevicePreviewProps {
  config: AppConfig;
}

export const MobileDevicePreview: React.FC<MobileDevicePreviewProps> = ({ config }) => {
  const [activeView, setActiveView] = useState<'launcher' | 'splash' | 'webview'>('launcher');
  const [showInterstitialModal, setShowInterstitialModal] = useState(false);
  const [interstitialTimer, setInterstitialTimer] = useState(5);
  const [showRewardedModal, setShowRewardedModal] = useState(false);
  const [rewardedTimer, setRewardedTimer] = useState(10);
  const [rewardEarned, setRewardEarned] = useState(false);
  const [showCustomTabModal, setShowCustomTabModal] = useState(false);
  const [customTabUrl, setCustomTabUrl] = useState('https://external-auth.example.com');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'checkout' | 'success'>('checkout');
  const [splashProgress, setSplashProgress] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Catch external URL navigation requests posted from inside webview
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'OPEN_CUSTOM_TAB') {
        setCustomTabUrl(e.data.url || 'https://external-service.com');
        setShowCustomTabModal(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Page loading spring effect when navigating, switching or reloading
  useEffect(() => {
    setIsPageLoading(true);
    const t = setTimeout(() => setIsPageLoading(false), 900);
    return () => clearTimeout(t);
  }, [iframeKey, config.websiteUrl, activeView]);

  // Splash screen animation timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeView === 'splash') {
      setSplashProgress(0);
      const stepTime = (config.splashDuration * 1000) / 100;
      interval = setInterval(() => {
        setSplashProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setActiveView('webview'), 400);
            return 100;
          }
          return prev + 2;
        });
      }, stepTime);
    }
    return () => clearInterval(interval);
  }, [activeView, config.splashDuration]);

  // Interstitial countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showInterstitialModal && interstitialTimer > 0) {
      timer = setInterval(() => {
        setInterstitialTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showInterstitialModal, interstitialTimer]);

  // Rewarded countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showRewardedModal && rewardedTimer > 0) {
      timer = setInterval(() => {
        setRewardedTimer((prev) => {
          if (prev <= 1) {
            setRewardEarned(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showRewardedModal, rewardedTimer]);

  const handleTriggerInterstitial = () => {
    setInterstitialTimer(5);
    setShowInterstitialModal(true);
  };

  const handleTriggerRewarded = () => {
    setRewardedTimer(10);
    setRewardEarned(false);
    setShowRewardedModal(true);
  };

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
    setIframeError(false);
  };

  const isAdMob = config.adNetwork === 'admob';
  const isStartIo = config.adNetwork === 'startio';

  const hasBanner =
    (isAdMob && Boolean(config.admob.bannerId)) || (isStartIo && config.startio.showBanner);

  const hasInterstitial =
    (isAdMob && Boolean(config.admob.interstitialId)) ||
    (isStartIo && config.startio.showInterstitial);

  const hasRewarded =
    (isAdMob && Boolean(config.admob.rewardedId)) || (isStartIo && config.startio.showRewarded);

  return (
    <div className="flex flex-col items-center">
      {/* Simulator Control Toolbar */}
      <div className="w-full max-w-sm mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveView('launcher')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
              activeView === 'launcher'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📱 Installed App
          </button>
          <button
            type="button"
            onClick={() => setActiveView('splash')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
              activeView === 'splash'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ Splash
          </button>
          <button
            type="button"
            onClick={() => setActiveView('webview')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
              activeView === 'webview'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌐 App
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReload}
            title="Reload Webview"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <a
            href={config.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Website in new tab"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

              {/* Ad Trigger Test Badges */}
      <div className="w-full max-w-sm mb-3 flex flex-wrap items-center gap-1.5 px-1 justify-center">
        {/* Test Page-to-Page Navigation Loading Spring */}
        <button
          type="button"
          onClick={() => {
            setIsPageLoading(true);
            setTimeout(() => setIsPageLoading(false), 1200);
          }}
          title="Simulate page navigation with loading spring"
          className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition"
        >
          <RotateCcw className="w-3 h-3 text-emerald-400 animate-spin" />
          <span>Test Page Spring</span>
        </button>

        {hasInterstitial && (
          <button
            type="button"
            onClick={handleTriggerInterstitial}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Test Interstitial Ad</span>
          </button>
        )}

        {hasRewarded && (
          <button
            type="button"
            onClick={handleTriggerRewarded}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 transition"
          >
            <Award className="w-3 h-3 text-cyan-400" />
            <span>Test Rewarded Ad</span>
          </button>
        )}

        {config.useCustomTabs !== false && (
          <button
            type="button"
            onClick={() => {
              setCustomTabUrl('https://accounts.google.com/o/oauth2/v2/auth');
              setShowCustomTabModal(true);
            }}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 transition"
          >
            <ExternalLink className="w-3 h-3 text-blue-400" />
            <span>Test Custom Tab</span>
          </button>
        )}

        {config.enablePaymentRedirects !== false && (
          <button
            type="button"
            onClick={() => {
              setPaymentStep('checkout');
              setShowPaymentModal(true);
            }}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition"
          >
            <CreditCard className="w-3 h-3 text-emerald-400" />
            <span>Test Wallet Return</span>
          </button>
        )}
      </div>

      {/* Realistic Mobile Phone Frame (Adapts to orientation) */}
      <div
        className={`relative ${
          config.orientation === 'landscape'
            ? 'w-[580px] max-w-full h-[340px]'
            : 'w-[340px] h-[670px]'
        } bg-slate-950 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700/80 ring-1 ring-white/10 flex flex-col items-center justify-between select-none overflow-hidden transition-all duration-300`}
      >
        {/* Phone Speaker & Dynamic Island Punch-hole */}
        <div
          className={`absolute ${
            config.orientation === 'landscape'
              ? 'left-4 top-1/2 -translate-y-1/2 h-20 w-4 flex-col'
              : 'top-4 left-1/2 -translate-x-1/2 w-24 h-5'
          } z-40 bg-black rounded-full flex items-center justify-center gap-2 border border-slate-800 shadow-md`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-950/80" />
        </div>

        {/* FULLSCREEN IMMERSIVE SCREEN CONTAINER */}
        {/* Notice: Absolutely NO top status bar (battery/wifi) and NO bottom navigation bar */}
        <div className="w-full h-full rounded-[34px] overflow-hidden relative flex flex-col bg-black">
          {/* VIEW 0: ANDROID HOME SCREEN (App installed on mobile) */}
          {activeView === 'launcher' && (
            <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 select-none bg-gradient-to-b from-slate-900 via-indigo-950/80 to-slate-950 text-white">
              {/* Android Top Status Bar */}
              <div className="w-full flex items-center justify-between text-[11px] font-medium text-slate-300 px-2 pt-1">
                <span>12:45</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">5G</span>
                  <Wifi className="w-3 h-3 text-slate-300" />
                  <div className="flex items-center gap-0.5">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px]">98%</span>
                  </div>
                </div>
              </div>

              {/* Clock & Date Widget */}
              <div className="mt-4 px-3 flex flex-col items-start">
                <span className="text-4xl font-light tracking-tight text-white/90">12:45</span>
                <span className="text-xs text-cyan-300/80 font-medium">Saturday, Sep 13 • 28°C</span>
              </div>

              {/* Google Search Bar Mockup */}
              <div className="mt-4 mx-1 px-3 py-2 bg-slate-800/80 backdrop-blur-md rounded-full border border-slate-700/60 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-gradient-to-r from-blue-400 via-red-400 to-yellow-400 bg-clip-text text-transparent">G</span>
                  <span className="text-[11px] text-slate-400">Search apps &amp; web...</span>
                </div>
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* App Grid: Standard Apps + User's Installed App */}
              <div className="my-auto grid grid-cols-4 gap-y-5 gap-x-2 px-1 pt-2">
                {/* Standard System Apps */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-2.5 flex items-center justify-center shadow-md">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Phone</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-2.5 flex items-center justify-center shadow-md">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Messages</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 p-2.5 flex items-center justify-center shadow-md">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Camera</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-2.5 flex items-center justify-center shadow-md">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Gallery</span>
                </div>

                {/* ROW 2: THE INSTALLED APP (HIGHLIGHTED) */}
                <button
                  type="button"
                  onClick={() => setActiveView('splash')}
                  className="flex flex-col items-center gap-1 group relative cursor-pointer"
                >
                  <div className="relative">
                    <div className="w-13 h-13 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-xl shadow-cyan-500/30 group-hover:scale-105 transition duration-200">
                      <img
                        src={config.appLogoUrl || '/logo.png'}
                        alt={config.appName || 'App'}
                        className="w-full h-full object-cover rounded-xl bg-slate-950"
                      />
                    </div>
                    {/* Installed Pulse Badge */}
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-semibold text-cyan-300 truncate max-w-[68px] text-center">
                    {config.appName || 'AppCreator05'}
                  </span>
                  <span className="text-[8px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1 rounded-full scale-90">
                    Tap to open
                  </span>
                </button>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 flex items-center justify-center shadow-md">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Play Store</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-500 p-2.5 flex items-center justify-center shadow-md">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Settings</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-2.5 flex items-center justify-center shadow-md">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-300">Toolbox</span>
                </div>
              </div>

              {/* Bottom Dock */}
              <div className="mt-auto pt-3 pb-1">
                <div className="p-2 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-around">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Gesture pill */}
                <div className="w-28 h-1 bg-white/40 rounded-full mx-auto mt-2" />
              </div>
            </div>
          )}

          {/* VIEW 1: SPLASH SCREEN */}
          {activeView === 'splash' && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-between p-6 text-center"
              style={{
                backgroundColor: config.splashBgColor,
                backgroundImage: config.splashImageUrl ? `url(${config.splashImageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {config.splashImageUrl === '/splash.png' ? (
                // Full official splash screen: show loading bar overlay at bottom
                <div className="absolute inset-x-0 bottom-8 z-20 flex flex-col items-center px-8">
                  <div className="w-full max-w-[240px] h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-2 border border-cyan-500/20">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-150 shadow-[0_0_8px_rgba(0,229,255,0.8)]"
                      style={{ width: `${splashProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-cyan-200/90 font-medium tracking-wide">
                    Launching {config.appName || 'AppCreator05'} ({Math.round(splashProgress)}%)
                  </span>
                </div>
              ) : (
                // Custom uploaded splash image: render centered logo box and loading bar
                <>
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
                  <div className="relative z-10 w-full pt-16 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900 flex items-center justify-center mb-5 animate-pulse">
                      <img
                        src={config.appLogoUrl}
                        alt={config.appName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-md">
                      {config.appName}
                    </h3>
                    <span className="text-[11px] text-slate-300/90 mt-1 font-mono">
                      {config.packageName}
                    </span>
                  </div>

                  <div className="relative z-10 w-full pb-8 flex flex-col items-center">
                    <div className="w-3/4 h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-150"
                        style={{ width: `${splashProgress}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/70">
                      Launching Fullscreen App...
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW 2: FULLSCREEN WEBVIEW */}
          <div className="relative w-full h-full flex flex-col bg-slate-950">
            {/* Top Minimal Loading Line (Matches real Android WebChromeClient progressBar) */}
            <div className="h-0.5 w-full bg-transparent overflow-hidden">
              <div className="h-full bg-emerald-500 w-full animate-pulse" />
            </div>

            {/* Edge to Edge Web Content */}
            <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-900">
              {!config.websiteUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Enter Website URL</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                    Type your website address on the left to preview your live mobile app here.
                  </p>
                </div>
              ) : (
                <iframe
                  key={iframeKey}
                  src={config.websiteUrl}
                  title="Fullscreen App View"
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onLoad={() => setIsPageLoading(false)}
                  onError={() => {
                    setIframeError(true);
                    setIsPageLoading(false);
                  }}
                />
              )}

              {/* Center Loading Spring (Requested: page loading holei show hoye ar page load hoye gele sore jaye) */}
              {isPageLoading && config.showProgressWheel !== false && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] pointer-events-none transition-all duration-200 animate-in fade-in">
                  <div className="p-5 rounded-3xl bg-slate-900/95 border border-cyan-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_24px_rgba(6,182,212,0.2)] flex flex-col items-center gap-3">
                    {/* Dual-Ring Spring Animation */}
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-[3.5px] border-cyan-500/20 border-t-cyan-400 animate-spin" />
                      <div className="w-8 h-8 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-400 border-r-teal-400 animate-[spin_0.8s_linear_infinite_reverse]" />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-semibold text-slate-100 tracking-wide">Loading Page...</span>
                      <span className="text-[10px] text-cyan-300/80 mt-0.5">Please wait</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback overlay if website has X-Frame-Options: DENY / SAMEORIGIN */}
              {iframeError && (
                <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center text-slate-200">
                  <Info className="w-10 h-10 text-amber-400 mb-3" />
                  <p className="text-sm font-semibold text-white">Live App View Protected</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    This domain restricts external iframe embedding in browsers. In your compiled Android APK, 
                    it will load natively without restrictions with full JavaScript and cookies!
                  </p>
                  <a
                    href={config.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open {config.websiteUrl}</span>
                  </a>
                </div>
              )}
            </div>

            {/* LIVE BANNER AD SIMULATION (AdMob or Start.io) */}
            {hasBanner && (
              <div className="w-full shrink-0 z-20">
                {isAdMob && (
                  <div className="w-full bg-amber-950/90 border-t border-amber-500/30 px-2 py-1 flex items-center justify-between text-[11px] text-amber-200">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black font-extrabold text-[9px] uppercase tracking-wider">
                        AdMob
                      </span>
                      <span className="truncate max-w-[170px] text-slate-200">
                        {config.admob.bannerId ? `Live Banner (${config.admob.bannerId.slice(-6)})` : 'Live Banner Unit'}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400/80 font-mono">Live 320x50</span>
                  </div>
                )}

                {isStartIo && (
                  <div className="w-full bg-cyan-950/90 border-t border-cyan-500/30 px-2 py-1 flex items-center justify-between text-[11px] text-cyan-200">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-black font-extrabold text-[9px] uppercase tracking-wider">
                        Start.io
                      </span>
                      <span className="truncate max-w-[170px] text-slate-200">
                        App ID: {config.startio.appId || 'Configured'}
                      </span>
                    </div>
                    <span className="text-[10px] text-cyan-400 font-mono">Banner Ad</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIMULATED FULLSCREEN INTERSTITIAL AD MODAL */}
          {showInterstitialModal && (
            <div className="absolute inset-0 z-50 bg-black flex flex-col justify-between p-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between w-full">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase">
                  {isAdMob ? 'Google AdMob Interstitial' : 'Start.io Interstitial'}
                </span>
                {interstitialTimer > 0 ? (
                  <span className="text-xs text-white/80 font-mono px-2 py-1 rounded-full bg-white/10">
                    Skip in {interstitialTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowInterstitialModal(false)}
                    className="p-1 rounded-full bg-white/20 text-white hover:bg-white/40 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center justify-center my-auto text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-amber-500/30">
                  <Zap className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">
                  {isAdMob ? 'AdMob Fullscreen Ad' : 'Start.io Fullscreen Ad'}
                </h4>
                <p className="text-xs text-slate-400 max-w-[220px]">
                  High revenue full-screen interstitial loaded automatically between user actions.
                </p>
                <button
                  type="button"
                  onClick={() => setShowInterstitialModal(false)}
                  className="mt-6 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition"
                >
                  Learn More
                </button>
              </div>

              <div className="text-center text-[10px] text-white/50 pb-2">
                Real Live Production Ad • {isAdMob ? 'Google AdMob' : 'Start.io'}
              </div>
            </div>
          )}

          {/* SIMULATED REWARDED VIDEO AD MODAL */}
          {showRewardedModal && (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between w-full">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
                  <Award className="w-3 h-3" /> Rewarded Ad
                </span>
                <span className="text-xs text-white font-mono px-2.5 py-1 rounded-full bg-cyan-950 border border-cyan-800">
                  {rewardedTimer > 0 ? `${rewardedTimer}s remaining` : 'Finished!'}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center my-auto text-center px-4">
                {rewardEarned ? (
                  <div className="animate-in zoom-in-50 duration-300">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <h4 className="text-lg font-bold text-white">Reward Granted!</h4>
                    <p className="text-xs text-emerald-300 mt-1">
                      User successfully received bonus reward callback!
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowRewardedModal(false)}
                      className="mt-6 px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition"
                    >
                      Collect & Close
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-16 h-16 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 mx-auto mb-4 animate-spin">
                      <Volume2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-white">
                      Watching Rewarded Ad...
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Watch until end to receive app reward.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-white/50 pb-2">
                {isAdMob ? 'Google Mobile Ads SDK' : 'StartApp InApp SDK'}
              </div>
            </div>
          )}

          {/* SIMULATED CHROME CUSTOM TAB MODAL */}
          {showCustomTabModal && (
            <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col animate-in slide-in-from-bottom duration-300">
              {/* Chrome Custom Tab Toolbar */}
              <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center justify-between text-white shadow-md">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomTabModal(false)}
                    className="p-1 rounded-full hover:bg-slate-700 text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-white flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      {(() => {
                        try {
                          return new URL(customTabUrl).hostname;
                        } catch (e) {
                          return 'external-link.com';
                        }
                      })()}
                    </span>
                    <span className="text-[9px] text-slate-400">Chrome Custom Tab</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Custom Tab Content */}
              <div className="flex-1 p-5 flex flex-col items-center justify-center text-center bg-slate-950 text-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center mb-3">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Chrome Custom Tab Active</h4>
                <p className="text-[11px] font-mono text-cyan-300 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md mt-1 mb-2 max-w-[260px] truncate">
                  {customTabUrl}
                </p>
                <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                  External URL was intercepted! It opens in Chrome Custom Tabs instead of navigating away from your app.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCustomTabModal(false)}
                  className="mt-5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Close & Return to App
                </button>
              </div>
            </div>
          )}

          {/* SIMULATED PAYMENT GATEWAY & WALLET RETURN MODAL */}
          {showPaymentModal && (
            <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col justify-between animate-in slide-in-from-bottom duration-300">
              {/* Header */}
              <div className="bg-slate-800/90 border-b border-slate-700 px-3.5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block leading-tight">
                      Payment & Wallet Gateway
                    </span>
                    <span className="text-[10px] text-emerald-400">Secure Popup Window</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col justify-center text-center">
                {paymentStep === 'checkout' ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left">
                      <div className="text-[11px] text-slate-400">Subscription Item:</div>
                      <div className="text-sm font-semibold text-white">Monthly VIP Membership</div>
                      <div className="text-xs font-mono text-emerald-400 mt-0.5">$9.99 / month</div>
                    </div>

                    <div className="text-[11px] text-slate-400 text-left">
                      Select Payment Wallet:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                      <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-center">
                        bKash / Nagad
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 text-center">
                        UPI / Paytm / GPay
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Deep-link redirect opens wallet app directly. When payment succeeds, app catches the callback URL and returns right here!
                    </p>

                    <button
                      type="button"
                      onClick={() => setPaymentStep('success')}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                    >
                      Simulate Pay & Return to App
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-white">Payment Successful!</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Redirecting back to your webview application with active subscription status.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="mt-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700"
                    >
                      Back to App Webview
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 text-center">
                Auto-handles window.open, 3DS, & wallet app intent redirects
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Screen Mode Indicator Footnote */}
      <div className="mt-3 text-center">
        <p className="text-xs text-emerald-400 flex items-center justify-center gap-1 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Fullscreen Immersive Mode Active
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Top status bar & bottom navigation bar are completely hidden
        </p>
      </div>
    </div>
  );
};
