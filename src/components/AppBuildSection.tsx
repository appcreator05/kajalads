import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  QrCode,
  Smartphone,
  Cloud,
  Download,
  ShieldCheck,
  RefreshCw,
  MessageCircle,
  HardDrive,
  Share2,
  Check,
  Key,
  FolderDown,
  Wallet,
  X,
  Lock,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { AppConfig } from '../types';
import { buildDirectApkFile, buildDirectAabFile } from '../utils/apkBuilder';
import { generateStandardJksBuffer } from '../utils/keystoreGenerator';
import {
  DualBuildUploadResult,
  uploadBothPackages,
  getSavedGitHubConfig,
  saveGitHubConfig,
  checkServerGitHubConfig,
} from '../utils/githubUploader';

interface AppBuildSectionProps {
  config: AppConfig;
  onBackToConfig: () => void;
  onToast: (message: string) => void;
}

type BuildStage = 'loading' | 'completed' | 'error';
type PackageTab = 'apk' | 'aab' | 'keystore';

export const AppBuildSection: React.FC<AppBuildSectionProps> = ({
  config,
  onBackToConfig,
  onToast,
}) => {
  const { isLoggedIn, balance, deductBuildFee, openWalletModal } = useWallet();
  const [stage, setStage] = useState<BuildStage>('loading');
  const [progressPercent, setProgressPercent] = useState<number>(10);
  const [progressStatus, setProgressStatus] = useState<string>('Initializing Android compilation engine...');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isWalletError, setIsWalletError] = useState(false);

  const [apkPackage, setApkPackage] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [aabPackage, setAabPackage] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [buildResult, setBuildResult] = useState<DualBuildUploadResult | null>(null);

  const [activeTab, setActiveTab] = useState<PackageTab>('apk');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedKeyPass, setCopiedKeyPass] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // AppCreator05 Cloud config state (defaults to appcreator05/25)
  const [showCloudInput, setShowCloudInput] = useState(false);
  const [cloudToken, setCloudToken] = useState<string>(() => {
    const t = getSavedGitHubConfig().token;
    return typeof t === 'string' && t !== 'true' && t !== 'false' && t.length > 5
      ? t
      : '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';
  });
  const [cloudRepo, setCloudRepo] = useState<string>(() => {
    const r = getSavedGitHubConfig().repo;
    if (typeof r === 'string' && r !== 'true' && r !== 'false' && !r.includes('tra105') && !r.includes('my-android-app') && r) {
      return r;
    }
    return 'https://github.com/appcreator05/25';
  });
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);

  const isBuildingRef = useRef(false);

  // Warning Popup state when user clicks Back to Settings
  const [showExitWarningModal, setShowExitWarningModal] = useState(false);
  // Second confirmation popup state (Yes/No)
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Trigger back button click: show warning if build is completed
  const handleBackRequest = () => {
    if (stage === 'completed') {
      setShowExitWarningModal(true);
    } else {
      try {
        localStorage.removeItem('webtoapk_build_locked');
        localStorage.removeItem('webtoapk_saved_build_result');
        localStorage.removeItem('webtoapk_saved_build_apk');
        localStorage.removeItem('webtoapk_saved_build_aab');
        localStorage.setItem('webtoapk_active_view', 'config');
      } catch (_) {}
      onBackToConfig();
    }
  };

  const handleProceedToConfirmExit = () => {
    setShowExitWarningModal(false);
    setShowExitConfirmModal(true);
  };

  const handleFinalConfirmYes = () => {
    setShowExitConfirmModal(false);
    // User explicitly confirmed exit - unlock the build section!
    try {
      localStorage.removeItem('webtoapk_build_locked');
      localStorage.removeItem('webtoapk_saved_build_result');
      localStorage.removeItem('webtoapk_saved_build_apk');
      localStorage.removeItem('webtoapk_saved_build_aab');
      localStorage.setItem('webtoapk_active_view', 'config');
    } catch (_) {}
    onBackToConfig();
  };

  const handleFinalConfirmNo = () => {
    setShowExitConfirmModal(false);
  };

  const handleRebuild = () => {
    try {
      localStorage.removeItem('webtoapk_saved_build_result');
      localStorage.removeItem('webtoapk_saved_build_apk');
      localStorage.removeItem('webtoapk_saved_build_aab');
    } catch (_) {}
    startBuild();
  };

  const startBuild = async () => {
    if (isBuildingRef.current) return;
    isBuildingRef.current = true;

    setStage('loading');
    setProgressPercent(10);
    setProgressStatus('Verifying wallet balance (₹50 required)...');
    setErrorMessage('');
    setIsWalletError(false);

    try {
      // Step 0: Check authentication and deduct ₹50 build fee from Firebase
      if (!isLoggedIn) {
        setIsWalletError(true);
        throw new Error('Please login to your Wallet first. Each app build requires ₹50 balance.');
      }

      setProgressPercent(15);
      setProgressStatus('Deducting ₹50 build fee from wallet...');
      const deductResult = await deductBuildFee(config.appName || 'Android App');

      if (!deductResult.success) {
        setIsWalletError(true);
        throw new Error(deductResult.error || 'Insufficient balance! You need ₹50 to build this app.');
      }

      onToast(`⚡ ₹50 deducted for build! Remaining balance: ₹${(deductResult.remainingBalance ?? (balance - 50)).toFixed(2)}`);

      // 1. Build Direct APK
      setProgressPercent(35);
      setProgressStatus('Compiling Android Binary Package (.apk)...');
      const apk = await buildDirectApkFile(config, (status) => {
        setProgressStatus(status);
      });
      setApkPackage(apk);

      // 2. Build Direct AAB
      setProgressPercent(70);
      setProgressStatus('Assembling Google Play App Bundle (.aab)...');
      const aab = await buildDirectAabFile(config, (status) => {
        setProgressStatus(status);
      });
      setAabPackage(aab);

      // 3. Connect to AppCreator05 Cloud CDN
      setProgressPercent(88);
      setProgressStatus('Uploading packages and creating direct download link...');

      const configCreds = getSavedGitHubConfig();
      const rawToken = typeof cloudToken === 'string' ? cloudToken.trim() : '';
      let rawRepo = typeof cloudRepo === 'string' ? cloudRepo.trim() : '';
      if (rawRepo.includes('tra105') || rawRepo.includes('my-android-app')) {
        rawRepo = 'https://github.com/appcreator05/25';
      }
      const activeToken = rawToken || configCreds.token || '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';
      const activeRepo = rawRepo || configCreds.repo || 'https://github.com/appcreator05/25';

      const uploadResult = await uploadBothPackages(
        apk,
        aab,
        { token: activeToken, repo: activeRepo },
        (status) => {
          setProgressStatus(status);
        }
      );

      setBuildResult(uploadResult);
      setProgressPercent(100);
      setProgressStatus('App ready for installation & distribution!');
      setStage('completed');

      // Persist build session lock and completed result
      try {
        localStorage.setItem('webtoapk_build_locked', 'true');
        localStorage.setItem('webtoapk_active_view', 'build');
        localStorage.setItem('webtoapk_saved_build_result', JSON.stringify(uploadResult));
        localStorage.setItem('webtoapk_saved_build_apk', JSON.stringify({ fileName: apk.fileName }));
        if (aab) {
          localStorage.setItem('webtoapk_saved_build_aab', JSON.stringify({ fileName: aab.fileName }));
        }
      } catch (e) {
        console.warn('Failed to cache build result in localStorage:', e);
      }

      onToast('🎉 App build successful! Direct download & share links are ready.');
    } catch (err: any) {
      console.error('App compilation error:', err);
      setErrorMessage(err?.message || 'Failed to complete app build. Please try again.');
      setStage('error');
      try {
        localStorage.setItem('webtoapk_build_locked', 'true');
        localStorage.setItem('webtoapk_active_view', 'build');
      } catch (_) {}
      onToast('❌ ' + (err?.message || 'Build error. Check inputs and retry.'));
    } finally {
      isBuildingRef.current = false;
    }
  };

  useEffect(() => {
    // Check if there is already a completed build saved in localStorage
    try {
      const savedResultStr = localStorage.getItem('webtoapk_saved_build_result');
      if (savedResultStr) {
        const parsedResult = JSON.parse(savedResultStr) as DualBuildUploadResult;
        if (parsedResult && parsedResult.success && parsedResult.apk?.downloadUrl) {
          const savedApkMeta = localStorage.getItem('webtoapk_saved_build_apk');
          const savedAabMeta = localStorage.getItem('webtoapk_saved_build_aab');
          const apkName = savedApkMeta ? JSON.parse(savedApkMeta).fileName : parsedResult.apk.fileName;
          const aabName = savedAabMeta && parsedResult.aab ? JSON.parse(savedAabMeta).fileName : (parsedResult.aab?.fileName || '');

          setBuildResult(parsedResult);
          setApkPackage({ blob: new Blob([]), fileName: apkName || parsedResult.apk.fileName });
          if (parsedResult.aab) {
            setAabPackage({ blob: new Blob([]), fileName: aabName || parsedResult.aab.fileName });
          }
          setStage('completed');
          setProgressPercent(100);
          setProgressStatus('App ready for installation & distribution!');
          localStorage.setItem('webtoapk_build_locked', 'true');
          localStorage.setItem('webtoapk_active_view', 'build');
          return;
        }
      }
    } catch (e) {
      console.warn('Could not restore saved build:', e);
    }

    startBuild();
    // Scroll to top on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle uploading or re-uploading to AppCreator05 Cloud
  const handleUploadCloudNow = async () => {
    const configCreds = getSavedGitHubConfig();
    const rawToken = typeof cloudToken === 'string' ? cloudToken.trim() : '';
    let rawRepo = typeof cloudRepo === 'string' ? cloudRepo.trim() : '';
    if (rawRepo.includes('tra105') || rawRepo.includes('my-android-app')) {
      rawRepo = 'https://github.com/appcreator05/25';
    }
    const activeToken = rawToken || configCreds.token || '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';
    const activeRepo = rawRepo || configCreds.repo || 'https://github.com/appcreator05/25';

    if (!activeToken) {
      onToast('Please provide your AppCreator05 Cloud Access Token');
      return;
    }
    if (!apkPackage) return;
    setIsUploadingToCloud(true);
    try {
      saveGitHubConfig({ token: activeToken, repo: activeRepo });
      if (!cloudToken) setCloudToken(activeToken);
      if (!cloudRepo) setCloudRepo(activeRepo);
      onToast('🚀 Uploading binary packages to AppCreator05 Cloud...');
      const result = await uploadBothPackages(
        apkPackage,
        aabPackage,
        { token: activeToken, repo: activeRepo },
        (status) => {
          onToast(status);
        }
      );
      setBuildResult(result);
      setShowCloudInput(false);
      onToast('🎉 AppCreator05 Cloud online link generated successfully!');
    } catch (err: any) {
      console.error('AppCreator05 Cloud upload failed:', err);
      onToast('AppCreator05 Cloud upload failed: ' + (err?.message || 'Error'));
    } finally {
      setIsUploadingToCloud(false);
    }
  };

  // Safe file downloader
  const downloadBlobOrFile = (blob: Blob | null, filename: string, directUrl?: string) => {
    if (directUrl && directUrl.startsWith('http')) {
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onToast(`📥 Starting download for ${filename}...`);
      return;
    }

    if (!blob) {
      onToast('❌ Package data not ready');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    onToast(`📥 Downloading ${filename}...`);
  };

  const openInChromeCustomTabs = (url: string) => {
    if (!url) return;
    try {
      if (/Android/i.test(navigator.userAgent)) {
        const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = intentUrl;
        setTimeout(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 1200);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const saveFileToDeviceFolder = async (blob: Blob | null, defaultName: string) => {
    if (!blob) {
      onToast('Package data not ready');
      return;
    }

    if ('showSaveFilePicker' in window) {
      try {
        const ext = defaultName.endsWith('.aab') ? '.aab' : defaultName.endsWith('.jks') ? '.jks' : '.apk';
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description: 'Android Package File',
              accept: { 'application/octet-stream': [ext] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        onToast(`✅ Saved directly to ${defaultName}!`);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Save file picker fallback:', err);
      }
    }

    downloadBlobOrFile(blob, defaultName);
  };

  const shareToWhatsApp = (downloadUrl: string, appName: string) => {
    const text = `🚀 Test my new Android App: *${appName}*!\n\nDownload the APK directly here:\n${downloadUrl}\n\nBuilt with AppCreator05`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    onToast('💬 Opening WhatsApp Share...');
  };

  const saveToGoogleDrive = (url: string) => {
    const driveUrl = 'https://drive.google.com/drive/my-drive';
    window.open(driveUrl, '_blank');
    onToast('☁️ Opened Google Drive. Upload your downloaded APK there!');
  };

  const shareFileOnMobile = async (blob: Blob | null, fileName: string, fallbackUrl: string) => {
    if (navigator.share) {
      try {
        if (blob && navigator.canShare) {
          const file = new File([blob], fileName, { type: 'application/vnd.android.package-archive' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${config.appName} Android App`,
              text: `Download and test ${config.appName} on your phone!`,
              files: [file],
            });
            onToast('✅ Shared successfully!');
            return;
          }
        }
        await navigator.share({
          title: `${config.appName} Android App`,
          text: `Download and install ${config.appName} APK on Android:\n${fallbackUrl}`,
          url: fallbackUrl,
        });
        onToast('✅ Link shared!');
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          copyUrl(fallbackUrl, 'Download Link');
        }
      }
    } else {
      copyUrl(fallbackUrl, 'Download Link');
    }
  };

  const downloadKeystore = () => {
    try {
      // 1. If user uploaded a custom keystore file, download it directly:
      if (config.keystore?.useCustomKeystore && config.keystore.keystoreBase64) {
        const base64Content = config.keystore.keystoreBase64.includes(',')
          ? config.keystore.keystoreBase64.split(',')[1]
          : config.keystore.keystoreBase64;
        const byteCharacters = atob(base64Content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/x-java-keystore' });
        const fileName =
          config.keystore.keystoreFileName ||
          `${(config.appName || 'app').toLowerCase().replace(/[^a-z0-9]/g, '_')}_release.keystore`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        downloadBlobOrFile(blob, fileName, 'application/x-java-keystore');
        onToast('🔑 Custom Keystore downloaded successfully!');
        return;
      }

      // 2. Standard release keystore
      const alias = config.keystore?.keyAlias?.trim() || 'androidkey';
      const storePass = config.keystore?.storePassword?.trim() || 'android';
      const keyPass = config.keystore?.keyPassword?.trim() || storePass || 'android';
      const certName = config.keystore?.certificateName?.trim() || 'installapkapps@gmail.com';
      const org = config.keystore?.organization?.trim() || 'AppInventor for Android';
      const years = config.keystore?.validityYears || 25;

      const buffer = generateStandardJksBuffer(alias, storePass, keyPass, certName, org, years);
      const blob = new Blob([buffer], { type: 'application/x-java-keystore' });
      const filename = `${(config.appName || 'app').toLowerCase().replace(/[^a-z0-9]/g, '_')}_release.keystore`;

      // Direct download trigger
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      downloadBlobOrFile(blob, filename, 'application/x-pkcs12');
      onToast('🔑 Keystore certificate (.keystore) downloaded!');
    } catch (e: any) {
      onToast('Error downloading keystore: ' + (e?.message || e));
    }
  };

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onToast(`✅ ${label} link copied to clipboard!`);
  };

  const getActiveTabInfo = () => {
    if (activeTab === 'apk') {
      const url =
        buildResult?.apk?.downloadUrl ||
        (buildResult as any)?.apkUrl ||
        '';
      const isOnline = Boolean(url && url.startsWith('http'));
      const fileName =
        buildResult?.apk?.fileName ||
        apkPackage?.fileName ||
        `${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v${config.versionName}.apk`;
      return {
        downloadUrl: url,
        fileName,
        isOnlineUrl: isOnline,
        blob: apkPackage?.blob || null,
        title: 'APK File (Direct Android Installation)',
        description: 'Install directly on any Android smartphone, tablet, or emulator with 1 click.',
        badge: 'Recommended for Testing & Sharing',
      };
    }
    if (activeTab === 'aab') {
      const url =
        buildResult?.aab?.downloadUrl ||
        (buildResult as any)?.aabUrl ||
        '';
      const isOnline = Boolean(url && url.startsWith('http'));
      const fileName =
        buildResult?.aab?.fileName ||
        aabPackage?.fileName ||
        `${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v${config.versionName}.aab`;
      return {
        downloadUrl: url,
        fileName,
        isOnlineUrl: isOnline,
        blob: aabPackage?.blob || null,
        title: 'AAB Bundle (Google Play Console)',
        description: 'Official Android App Bundle required by Google for publishing to Google Play Store.',
        badge: 'Production Play Store Format',
      };
    }
    return {
      downloadUrl: '',
      fileName: 'release.keystore',
      isOnlineUrl: false,
      blob: null,
      title: 'App Signing Keystore',
      description: 'Your cryptographically secured RSA-2048 signing certificate and credentials.',
      badge: 'Security Certificate',
    };
  };

  const info = getActiveTabInfo();
  const qrCodeUrl = info.downloadUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(info.downloadUrl)}`
    : '';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={handleBackRequest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 transition cursor-pointer shrink-0"
            title="Return to App Settings"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Settings</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0 shadow">
              {config.appLogoUrl ? (
                <img
                  src={config.appLogoUrl}
                  alt={config.appName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Smartphone className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  {config.appName}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  v{config.versionName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xs sm:max-w-md">
                {config.packageName}
              </p>
            </div>
          </div>
        </div>

        {/* Right Status Badges */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm"
            title="Screen is locked to Build Section until 'Back to Settings' is clicked"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Build Section Locked</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40">
            <Cloud className="w-3.5 h-3.5 text-purple-400" />
            <span>AppCreator05 Cloud Powered</span>
          </span>
        </div>
      </div>

      {/* ================= STAGE 1: IN-PAGE COMPILATION & PROGRESS ================= */}
      {stage === 'loading' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-14 shadow-2xl flex flex-col items-center justify-center text-center space-y-8">
          {/* Animated Glowing Spring Rings */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-emerald-500/20 via-purple-500/20 to-teal-500/20 animate-ping opacity-60" />
            <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 blur-md animate-pulse" />

            {/* Outer Spinning Ring */}
            <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-emerald-400 border-r-teal-400 animate-spin flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <div className="w-16 h-16 rounded-full border-2 border-slate-800 border-b-purple-400 animate-spin" />
            </div>

            {/* App Icon Centerpiece */}
            <div className="absolute w-12 h-12 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner border border-slate-700">
              {config.appLogoUrl ? (
                <img
                  src={config.appLogoUrl}
                  alt="App Icon"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Smartphone className="w-6 h-6 text-emerald-400" />
              )}
            </div>
          </div>

          {/* Status and Progress Bar */}
          <div className="w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between text-xs px-1 font-semibold">
              <span className="text-emerald-400 animate-pulse flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{progressStatus}</span>
              </span>
              <span className="font-mono text-white text-sm">{progressPercent}%</span>
            </div>

            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-purple-500 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Please wait — your Android APK and AAB binary files are automatically compiling and preparing AppCreator05 Cloud distribution...
            </p>
          </div>

          {/* Visual 3-Step Milestone Checklist */}
          <div className="w-full max-w-md grid grid-cols-3 gap-3 text-xs pt-2">
            <div
              className={`p-3 rounded-xl border text-center transition ${
                progressPercent >= 40
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-xs">1. APK File</div>
              <div className="text-[11px] mt-0.5">{progressPercent >= 40 ? '✓ Ready' : 'Building...'}</div>
            </div>

            <div
              className={`p-3 rounded-xl border text-center transition ${
                progressPercent >= 75
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-xs">2. AAB Bundle</div>
              <div className="text-[11px] mt-0.5">{progressPercent >= 75 ? '✓ Ready' : 'Building...'}</div>
            </div>

            <div
              className={`p-3 rounded-xl border text-center transition ${
                progressPercent >= 100
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-xs">3. AppCreator05 Cloud</div>
              <div className="text-[11px] mt-0.5">{progressPercent >= 100 ? '✓ Ready' : 'Connecting...'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ================= STAGE 2: BUILD COMPLETE & DISTRIBUTION HUB ================= */}
      {stage === 'completed' && buildResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Success Banner */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-purple-950/70 border border-emerald-500/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-xl text-white flex items-center gap-2">
                  <span>🎉 Your App Build is Complete & Ready!</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Save directly to your phone, share via <strong>WhatsApp</strong>, or store in <strong>Google Drive</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Build Ready</span>
              </span>
            </div>
          </div>

          {/* Main Workspace Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6">
            {/* Format Tab Selector */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('apk')}
                className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  activeTab === 'apk'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>.APK (Direct Install)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('aab')}
                className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  activeTab === 'aab'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>.AAB (Play Store)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('keystore')}
                className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  activeTab === 'keystore'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="w-4 h-4 shrink-0" />
                <span>Keystore &amp; Keys</span>
              </button>
            </div>

            {/* TAB CONTENT: APK OR AAB */}
            {activeTab !== 'keystore' && (
              <div className="space-y-6">
                {/* Information Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {info.title}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {info.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{info.description}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
                    {info.fileName}
                  </span>
                </div>

                {/* PRIMARY ACTION BUTTON */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (info.isOnlineUrl) {
                        openInChromeCustomTabs(info.downloadUrl);
                      }
                      downloadBlobOrFile(info.blob, info.fileName, info.downloadUrl);
                    }}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition cursor-pointer border border-emerald-400/50"
                  >
                    <Download className="w-5 h-5 shrink-0" />
                    <span>🚀 Install / Download {activeTab.toUpperCase()} Directly</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => saveFileToDeviceFolder(info.blob, info.fileName)}
                    className="w-full py-4 px-5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 border border-slate-700 shadow-md active:scale-[0.98] transition cursor-pointer"
                  >
                    <FolderDown className="w-5 h-5 text-teal-400 shrink-0" />
                    <span>Save to Device Downloads</span>
                  </button>
                </div>

                {/* SECONDARY QUICK ACTIONS: WHATSAPP, GOOGLE DRIVE, MOBILE SHARE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => shareToWhatsApp(info.downloadUrl, config.appName)}
                    className="py-3 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Share on WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => saveToGoogleDrive(info.downloadUrl)}
                    className="py-3 px-4 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-500/30 text-blue-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow"
                  >
                    <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Save to Google Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => shareFileOnMobile(info.blob, info.fileName, info.downloadUrl)}
                    className="py-3 px-4 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/30 text-purple-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow"
                  >
                    <Share2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Send / Share File</span>
                  </button>
                </div>

                {/* DOWNLOAD LINK & QR CODE SECTION */}
                <div className="p-4 sm:p-5 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      <span>Direct Download URL &amp; Mobile QR Code:</span>
                    </span>

                    {qrCodeUrl && (
                      <button
                        type="button"
                        onClick={() => setShowQr(!showQr)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{showQr ? 'Hide QR Code' : 'Show Phone QR Code'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        info.downloadUrl
                          ? info.downloadUrl
                          : isUploadingToCloud
                          ? 'Creating direct download link on AppCreator05 Cloud...'
                          : 'Preparing direct download link...'
                      }
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono select-all outline-none"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyUrl(info.downloadUrl, `${activeTab.toUpperCase()} Link`)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-emerald-400" />
                        <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                      </button>

                      {info.isOnlineUrl && (
                        <a
                          href={info.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => openInChromeCustomTabs(info.downloadUrl)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer no-underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* QR Code display */}
                  {showQr && qrCodeUrl && (
                    <div className="p-4 bg-white rounded-2xl flex flex-col items-center justify-center max-w-xs mx-auto text-slate-900 space-y-2 mt-3 animate-in fade-in zoom-in-95 duration-200">
                      <img
                        src={qrCodeUrl}
                        alt="Scan to Download APK"
                        className="w-48 h-48 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <p className="text-xs text-slate-700 text-center font-medium">
                        Scan with your phone camera to download directly on mobile!
                      </p>
                    </div>
                  )}

                  {/* Inline AppCreator05 Cloud Token Configuration */}
                  <div className="pt-3 mt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                        <Cloud className="w-3.5 h-3.5" />
                        <span>AppCreator05 Cloud Distribution Settings</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCloudInput((p) => !p)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showCloudInput ? 'Hide Settings' : 'Configure Token / Custom Project'}
                      </button>
                    </div>

                    {showCloudInput && (
                      <div className="space-y-3 bg-slate-900/95 p-4 rounded-xl border border-purple-500/20 mt-2">
                        <p className="text-xs text-slate-400 leading-normal">
                          Configuring an AppCreator05 Cloud Access Token publishes your packages directly to your repository with high-speed CDN download links:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">AppCreator05 Cloud Project Path</label>
                            <input
                              type="text"
                              value={cloudRepo}
                              onChange={(e) => setCloudRepo(e.target.value)}
                              placeholder="https://github.com/appcreator05/25"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">AppCreator05 Cloud Access Token</label>
                            <input
                              type="password"
                              value={cloudToken}
                              onChange={(e) => setCloudToken(e.target.value)}
                              placeholder="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"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isUploadingToCloud || !(typeof cloudToken === 'string' && cloudToken.trim())}
                          onClick={handleUploadCloudNow}
                          className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow"
                        >
                          <Cloud className="w-4 h-4" />
                          <span>
                            {isUploadingToCloud
                              ? 'Uploading to AppCreator05 Cloud...'
                              : 'Upload to AppCreator05 Cloud & Create Online Link'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: KEYSTORE & SIGNING */}
            {activeTab === 'keystore' && (
              <div className="space-y-5">
                <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                  <Key className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-200">
                      Standard Android Keystore Certificate
                    </h4>
                    <p className="text-xs text-amber-300/80 mt-1">
                      Both your APK and AAB packages have been signed with this release keystore. Keep a backup of this file to publish updates on Google Play.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">Key Alias:</span>
                    <div className="flex items-center justify-between font-mono text-xs text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 select-all">
                      <span className="truncate">{config.keystore?.keyAlias || 'androidkey'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(config.keystore?.keyAlias || 'androidkey');
                          setCopiedAlias(true);
                          setTimeout(() => setCopiedAlias(false), 2000);
                          onToast('Key alias copied!');
                        }}
                        className="text-slate-400 hover:text-white shrink-0 ml-2"
                        title="Copy Key Alias"
                      >
                        {copiedAlias ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">Keystore Password:</span>
                    <div className="flex items-center justify-between font-mono text-xs text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 select-all">
                      <span className="truncate">{config.keystore?.storePassword || 'android'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(config.keystore?.storePassword || 'android');
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                          onToast('Keystore password copied!');
                        }}
                        className="text-slate-400 hover:text-white shrink-0 ml-2"
                        title="Copy Keystore Password"
                      >
                        {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">Key Password:</span>
                    <div className="flex items-center justify-between font-mono text-xs text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 select-all">
                      <span className="truncate">{config.keystore?.keyPassword || config.keystore?.storePassword || 'android'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const pass = config.keystore?.keyPassword || config.keystore?.storePassword || 'android';
                          navigator.clipboard.writeText(pass);
                          setCopiedKeyPass(true);
                          setTimeout(() => setCopiedKeyPass(false), 2000);
                          onToast('Key password copied!');
                        }}
                        className="text-slate-400 hover:text-white shrink-0 ml-2"
                        title="Copy Key Password"
                      >
                        {copiedKeyPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={downloadKeystore}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {config.keystore?.useCustomKeystore && config.keystore.keystoreFileName
                      ? `Download Custom Keystore (${config.keystore.keystoreFileName})`
                      : 'Download release.keystore Certificate (.keystore)'}
                  </span>
                </button>
              </div>
            )}

            {/* Bottom Navigation */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={handleBackRequest}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to App Settings Form</span>
              </button>

              <span className="text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Signed &amp; Verified by AppCreator05 Cloud</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= STAGE 3: BUILD ERROR STATE ================= */}
      {stage === 'error' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-bold text-white">Build could not be completed</h3>
            <p className="text-xs text-red-300 leading-relaxed">{errorMessage}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {isWalletError ? (
              <>
                <button
                  type="button"
                  onClick={openWalletModal}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg active:scale-95"
                >
                  <Wallet className="w-4 h-4" />
                  <span>{isLoggedIn ? 'Recharge Wallet (₹50 Required)' : 'Login to Wallet'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRebuild}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer border border-slate-700 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-Build</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleRebuild}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-Build</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBackRequest}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700/80"
            >
              <span>Back to Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 1. POPUP: WARNING BEFORE EXIT ================= */}
      {showExitWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Ambient amber glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Warning: Download Your Files First
                  </h3>
                  <p className="text-[11px] text-amber-400/90 font-medium mt-0.5">
                    Save APK, AAB &amp; Keystore before leaving
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExitWarningModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Message Box */}
            <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl space-y-2.5 text-xs text-amber-200/90 mb-5 leading-relaxed">
              <p className="font-semibold text-amber-300 text-[13px]">
                ⚠️ Have you downloaded your APK, AAB, and Keystore files?
              </p>
              <p className="text-slate-300">
                Please make sure to download your generated <strong className="text-white">APK</strong>, <strong className="text-white">AAB</strong>, and <strong className="text-white">Keystore certificate</strong> first.
              </p>
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-lg text-rose-300 font-medium">
                🚨 <strong className="text-rose-200">Important Notice:</strong> If you exit to settings and want to build again later, another <strong className="text-white underline">₹50 fee</strong> will be deducted from your wallet!
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {/* Button: Already downloaded (Proceeds to Confirm popup) */}
              <button
                type="button"
                onClick={handleProceedToConfirmExit}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>I'm already all files downloaded</span>
              </button>

              {/* Button: Stay and download files */}
              <button
                type="button"
                onClick={() => setShowExitWarningModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer border border-slate-700/80"
              >
                Stay Here &amp; Download Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. POPUP: FINAL CONFIRMATION (YES / NO) ================= */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">
              Confirm Exit?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Are you sure you want to return to the Settings page? (A ₹50 fee will apply if you start a new build).
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* No Button: Stay on build page */}
              <button
                type="button"
                onClick={handleFinalConfirmNo}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer active:scale-95"
              >
                No, Stay
              </button>

              {/* Yes Button: Confirm back */}
              <button
                type="button"
                onClick={handleFinalConfirmYes}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-md shadow-rose-950/40 transition cursor-pointer active:scale-95"
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
