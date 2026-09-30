import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Copy,
  ExternalLink,
  X,
  Sparkles,
  ArrowRight,
  FolderOpen,
  FolderDown,
  Cloud,
  Download,
  ShieldCheck,
  RefreshCw,
  MessageCircle,
  HardDrive,
  Share2,
  Check,
  Key,
  Wallet,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { AppConfig } from '../types';
import { buildDirectApkFile, buildDirectAabFile } from '../utils/apkBuilder';
import { generateStandardJksBuffer } from '../utils/keystoreGenerator';
import {
  uploadBothPackages,
  DualBuildUploadResult,
  getSavedGitHubConfig,
  saveGitHubConfig,
  checkServerGitHubConfig,
  getActiveCloudToken,
  DB_USER_REPO,
} from '../utils/githubUploader';
import {
  openInChromeCustomTabs,
  downloadBlobOrFile,
  saveFileToDeviceFolder,
  shareToWhatsApp,
  saveToGoogleDrive,
  shareFileOnMobile,
  createDownloadUrl,
  openDeviceDownloadsFolder,
  isPublicHttpUrl,
  blobToBase64,
} from '../utils/fileDownloader';
import { isAppAssetsOrHashUrl } from '../utils/apiConfig';

interface OkSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onToast: (msg: string) => void;
}

export const OkSaveModal: React.FC<OkSaveModalProps> = ({
  isOpen,
  onClose,
  config,
  onToast,
}) => {
  const { isLoggedIn, balance, deductBuildFee, openWalletModal } = useWallet();
  const [stage, setStage] = useState<'loading' | 'completed' | 'error'>('loading');
  const [progressPercent, setProgressPercent] = useState(10);
  const [progressStatus, setProgressStatus] = useState('Preparing app build...');
  const [buildResult, setBuildResult] = useState<DualBuildUploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasServerGithub, setHasServerGithub] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  // Store compiled package blobs for 100% resilient offline / native download
  const [apkPackage, setApkPackage] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [aabPackage, setAabPackage] = useState<{ blob: Blob; fileName: string } | null>(null);

  // Sharing & Saving states
  const [activeTab, setActiveTab] = useState<'apk' | 'aab' | 'keystore'>('apk');
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // GitHub inline upload & config state
  const [showGitHubInput, setShowGitHubInput] = useState(false);
  const [githubToken, setGithubToken] = useState<string>(() => {
    const t = getSavedGitHubConfig().token;
    return typeof t === 'string' && t !== 'true' && t !== 'false' && t.length > 5
      ? t
      : getActiveCloudToken();
  });
  const [githubRepo, setGithubRepo] = useState<string>(() => {
    const r = getSavedGitHubConfig().repo;
    if (typeof r === 'string' && r !== 'true' && r !== 'false' && !r.includes('tra105') && !r.includes('my-android-app') && r) {
      return r;
    }
    return DB_USER_REPO;
  });
  const [isUploadingToGitHub, setIsUploadingToGitHub] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStage('loading');
      setProgressPercent(10);
      setProgressStatus('Preparing app build...');
      setBuildResult(null);
      setErrorMessage(null);
      setApkPackage(null);
      setAabPackage(null);
      return;
    }

    let isMounted = true;

    async function runBuildAndUpload() {
      try {
        setStage('loading');
        setErrorMessage(null);
        setProgressPercent(5);
        setProgressStatus('Checking wallet balance (₹50 required)...');

        if (!isLoggedIn) {
          throw new Error('Please login to your Wallet first. Each app build requires ₹50 balance.');
        }

        setProgressPercent(10);
        setProgressStatus('Deducting ₹50 build fee from Firebase wallet...');
        const deductResult = await deductBuildFee(config.appName || 'Android App');
        if (!deductResult.success) {
          throw new Error(deductResult.error || 'Insufficient balance! You need ₹50 to build this app.');
        }

        onToast(`⚡ ₹50 deducted for build! Remaining balance: ₹${(deductResult.remainingBalance ?? (balance - 50)).toFixed(2)}`);

        // Check server github config
        const serverConfig = await checkServerGitHubConfig();
        if (isMounted) setHasServerGithub(serverConfig.configuredOnServer);

        // 1. Build Direct APK
        if (!isMounted) return;
        setProgressPercent(20);
        setProgressStatus('1/3: Building standalone APK (.apk)...');
        const apk = await buildDirectApkFile(config, (percent, status) => {
          if (isMounted) {
            setProgressPercent(Math.min(45, Math.max(15, Math.round(percent * 0.45))));
            setProgressStatus(`1/3 APK build: ${status}`);
          }
        });
        if (isMounted) setApkPackage(apk);

        // 2. Build Direct AAB
        if (!isMounted) return;
        setProgressPercent(50);
        setProgressStatus('2/3: Building Google Play Store AAB (.aab)...');
        const aab = await buildDirectAabFile(config, (percent, status) => {
          if (isMounted) {
            setProgressPercent(Math.min(80, Math.max(50, Math.round(50 + percent * 0.3))));
            setProgressStatus(`2/3 AAB build: ${status}`);
          }
        });
        if (isMounted) setAabPackage(aab);

        // 3. Upload to GitHub Releases (or fast server/cloud fallback)
        if (!isMounted) return;
        setProgressPercent(85);
        setProgressStatus('3/3: Preparing packages and download links...');

        const configCreds = getSavedGitHubConfig();
        const rawToken = typeof githubToken === 'string' ? githubToken.trim() : '';
        let rawRepo = typeof githubRepo === 'string' ? githubRepo.trim() : '';
        if (rawRepo.includes('tra105') || rawRepo.includes('my-android-app')) {
          rawRepo = 'https://github.com/appcreator05/25';
        }
        const activeToken = rawToken || configCreds.token || getActiveCloudToken();
        const activeRepo = rawRepo || configCreds.repo || DB_USER_REPO;

        const result = await uploadBothPackages(
          apk,
          aab,
          { token: activeToken, repo: activeRepo },
          (status) => {
            if (isMounted) {
              setProgressStatus(`3/3: ${status}`);
            }
          }
        );

        if (!isMounted) return;
        setProgressPercent(100);
        setProgressStatus('Completed!');
        setBuildResult(result);
        setStage('completed');
        onToast('🎉 App generated and ready successfully!');
      } catch (err: any) {
        console.error('Build & Upload failed:', err);
        if (isMounted) {
          setErrorMessage(err?.message || 'Error occurred during app build or upload.');
          setStage('error');
        }
      }
    }

    runBuildAndUpload();

    return () => {
      isMounted = false;
    };
  }, [isOpen, attemptCount]);

  const handleUploadGitHubNow = async () => {
    const configCreds = getSavedGitHubConfig();
    const rawToken = typeof githubToken === 'string' ? githubToken.trim() : '';
    let rawRepo = typeof githubRepo === 'string' ? githubRepo.trim() : '';
    if (rawRepo.includes('tra105') || rawRepo.includes('my-android-app')) {
      rawRepo = 'https://github.com/appcreator05/25';
    }
    const activeToken = rawToken || configCreds.token || getActiveCloudToken();
    const activeRepo = rawRepo || configCreds.repo || DB_USER_REPO;

    if (!activeToken) {
      onToast('Please provide your AppCreator05 Cloud Access Token');
      return;
    }
    if (!apkPackage) return;
    setIsUploadingToGitHub(true);
    try {
      saveGitHubConfig({ token: activeToken, repo: activeRepo });
      if (!githubToken) setGithubToken(activeToken);
      if (!githubRepo) setGithubRepo(activeRepo);
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
      setShowGitHubInput(false);
      onToast('🎉 AppCreator05 Cloud online link generated successfully!');
    } catch (err: any) {
      console.error('AppCreator05 Cloud upload failed:', err);
      onToast('AppCreator05 Cloud upload failed: ' + (err?.message || 'Error'));
    } finally {
      setIsUploadingToGitHub(false);
    }
  };

  const autoUploadAttemptedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      autoUploadAttemptedRef.current = false;
    }
  }, [isOpen]);

  // Auto-upload to GitHub if build finished but public URL is not yet ready
  useEffect(() => {
    if (
      isOpen &&
      stage === 'completed' &&
      apkPackage &&
      buildResult &&
      !isPublicHttpUrl(buildResult.apk?.downloadUrl) &&
      !isUploadingToGitHub &&
      !autoUploadAttemptedRef.current
    ) {
      autoUploadAttemptedRef.current = true;
      handleUploadGitHubNow();
    }
  }, [isOpen, stage, apkPackage, buildResult, isUploadingToGitHub]);

  if (!isOpen) return null;

  const handleRetry = () => {
    setAttemptCount((prev) => prev + 1);
  };

  const getKeystorePackage = (): { blob: Blob; fileName: string } => {
    if (config.keystore?.useCustomKeystore && config.keystore.keystoreBase64) {
      try {
        const rawB64 = config.keystore.keystoreBase64.includes(',')
          ? config.keystore.keystoreBase64.split(',')[1]
          : config.keystore.keystoreBase64;
        const binStr = atob(rawB64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/x-java-keystore' });
        const fileName = config.keystore.keystoreFileName || 'release.keystore';
        return { blob, fileName };
      } catch (e) {
        console.error('Custom keystore blob parse error, fallback to auto:', e);
      }
    }

    const alias = config.keystore?.keyAlias?.trim() || 'appcreator05';
    const storePass = config.keystore?.storePassword || 'appcreator';
    const keyPass = config.keystore?.keyPassword || storePass || 'appcreator';
    const certName = config.keystore?.certificateName?.trim() || 'appcreator05 Developer';
    const org = config.keystore?.organization?.trim() || 'appcreator05';
    const years = config.keystore?.validityYears || 25;

    const buffer = generateStandardJksBuffer(alias, storePass, keyPass, certName, org, years);
    const fileName = 'AppCreator05.keystore';
    const blob = new Blob([buffer], { type: 'application/x-pkcs12' });
    return { blob, fileName };
  };

  const getActivePackageInfo = () => {
    if (activeTab === 'keystore') {
      const ks = getKeystorePackage();
      let effectiveUrl = '';
      try {
        effectiveUrl = URL.createObjectURL(ks.blob);
      } catch (_) {}
      return {
        pkg: ks,
        fileName: ks.fileName,
        downloadUrl: effectiveUrl,
        isOnlineUrl: false,
        mimeType: 'application/x-pkcs12',
        label: 'Keystore (.keystore)',
      };
    }

    if (activeTab === 'apk') {
      const rawUrl = buildResult?.apk.downloadUrl || '';
      let effectiveUrl = !isAppAssetsOrHashUrl(rawUrl) ? rawUrl : '';
      const isOnline = Boolean(effectiveUrl && isPublicHttpUrl(effectiveUrl));
      if (!effectiveUrl && apkPackage?.blob) {
        try {
          effectiveUrl = URL.createObjectURL(apkPackage.blob);
        } catch (_) {}
      }
      return {
        pkg: apkPackage,
        fileName: buildResult?.apk.fileName || apkPackage?.fileName || `${config.appName.toLowerCase()}.apk`,
        downloadUrl: effectiveUrl,
        isOnlineUrl: isOnline,
        mimeType: 'application/vnd.android.package-archive',
        label: 'APK (.apk)',
      };
    }
    const rawUrl = buildResult?.aab?.downloadUrl || '';
    let effectiveUrl = !isAppAssetsOrHashUrl(rawUrl) ? rawUrl : '';
    const isOnline = Boolean(effectiveUrl && isPublicHttpUrl(effectiveUrl));
    if (!effectiveUrl && aabPackage?.blob) {
      try {
        effectiveUrl = URL.createObjectURL(aabPackage.blob);
      } catch (_) {}
    }
    return {
      pkg: aabPackage,
      fileName: buildResult?.aab?.fileName || aabPackage?.fileName || `${config.appName.toLowerCase()}.aab`,
      downloadUrl: effectiveUrl,
      isOnlineUrl: isOnline,
      mimeType: 'application/octet-stream',
      label: 'AAB (.aab)',
    };
  };

  const handleDownloadKeystore = async () => {
    const ks = getKeystorePackage();
    try {
      await downloadBlobOrFile(ks.blob, ks.fileName, 'application/x-java-keystore', true);
      onToast(`🔑 Downloaded Keystore (${ks.fileName})!`);
    } catch (err) {
      console.error('Download keystore error:', err);
      onToast('Error downloading keystore');
    }
  };

  // WhatsApp Share Action
  const handleWhatsAppShare = async () => {
    const { pkg, fileName, downloadUrl, mimeType } = getActivePackageInfo();
    setIsSharing(true);
    try {
      if (pkg?.blob) {
        const res = await shareToWhatsApp(
          pkg.blob,
          fileName,
          config.appName,
          mimeType,
          isPublicHttpUrl(downloadUrl) ? downloadUrl : undefined
        );
        onToast(res.message);
      } else if (downloadUrl && isPublicHttpUrl(downloadUrl)) {
        const msg = `🚀 *${config.appName}* Android App Ready!\n\n📦 File: *${fileName}*\n📥 Direct Download Link:\n${downloadUrl}\n\n👆 Click to download and install on your phone!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        onToast('💬 WhatsApp opened!');
      } else {
        onToast('Please wait a moment while the file prepares...');
      }
    } catch (err: any) {
      console.error('WhatsApp share error:', err);
      onToast('Error sharing to WhatsApp');
    } finally {
      setIsSharing(false);
    }
  };

  // Save to Device Folder (File System Access) Action
  const handleSaveToFolder = async () => {
    const { pkg, fileName, mimeType } = getActivePackageInfo();
    if (!pkg?.blob) return;
    setIsSavingFolder(true);
    try {
      const res = await saveFileToDeviceFolder(pkg.blob, fileName, mimeType);
      if (res.success) {
        if (res.method === 'picker') {
          onToast('✅ File saved to folder successfully!');
        } else {
          onToast('✅ File download started!');
        }
      } else if (res.error !== 'User cancelled folder selection') {
        onToast('File save error: ' + (res.error || 'Error'));
      }
    } catch (err: any) {
      console.error('Save to folder error:', err);
      onToast('Save to folder failed: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingFolder(false);
    }
  };

  // Google Drive Save Action
  const handleGoogleDriveSave = async () => {
    const { pkg, fileName, downloadUrl, mimeType } = getActivePackageInfo();
    if (!pkg?.blob) {
      window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener,noreferrer');
      return;
    }
    setIsSavingDrive(true);
    try {
      const shared = await saveToGoogleDrive(pkg.blob, fileName, mimeType, downloadUrl || undefined);
      if (shared) {
        onToast('✅ Shared to Google Drive or app successfully!');
      } else {
        onToast('🌐 Google Drive opened. Upload the file to your Drive.');
      }
    } catch (err: any) {
      console.error('Drive save error:', err);
      onToast('Google Drive error: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingDrive(false);
    }
  };

  // Mobile System Share Sheet Action
  const handleMobileShare = async () => {
    const { pkg, fileName, downloadUrl, mimeType } = getActivePackageInfo();
    if (!pkg?.blob) return;
    setIsSharing(true);
    try {
      const shared = await shareFileOnMobile(pkg.blob, fileName, mimeType, downloadUrl || undefined);
      if (shared) {
        onToast('✅ File shared / saved successfully!');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSharing(false);
    }
  };

  // Direct Download Action
  const handleDirectDownload = async () => {
    const { pkg, fileName, downloadUrl, mimeType } = getActivePackageInfo();
    setDownloading(true);
    try {
      if (pkg?.blob) {
        await downloadBlobOrFile(pkg.blob, fileName, mimeType, true);
        onToast(`📥 Started downloading ${fileName}!`);
      } else if (downloadUrl) {
        openInChromeCustomTabs(downloadUrl);
        onToast(`📥 Started downloading ${fileName}!`);
      } else {
        onToast('Preparing download file...');
      }
    } catch (err) {
      console.error('Download error:', err);
      if (downloadUrl) {
        openInChromeCustomTabs(downloadUrl);
      }
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  };

  const handleDownloadApkInCustomTab = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!buildResult?.apk) return;

    // Check if running inside native Android App with direct file saver bridge:
    const androidBridge =
      typeof window !== 'undefined'
        ? (window as any).AndroidDownloader ||
          (window as any).AndroidApp ||
          (window as any).Android ||
          (window as any).JSBridge
        : null;

    if (androidBridge && typeof androidBridge.saveBase64File === 'function' && apkPackage?.blob) {
      try {
        onToast('💾 Saving APK directly to phone Downloads folder...');
        const base64Data = await blobToBase64(apkPackage.blob);
        androidBridge.saveBase64File(
          base64Data,
          buildResult.apk.fileName,
          'application/vnd.android.package-archive'
        );
        onToast('✅ APK saved to phone Download folder!');
        return;
      } catch (err) {
        console.warn('Native save failed, continuing to custom tabs/download:', err);
      }
    }

    onToast('🚀 Opening Custom Tab and starting APK download...');

    let url = buildResult.apk.downloadUrl;
    if (isAppAssetsOrHashUrl(url) && apkPackage?.blob) {
      try {
        url = await createDownloadUrl(apkPackage.blob, buildResult.apk.fileName, 'application/vnd.android.package-archive');
        if (!isAppAssetsOrHashUrl(url)) {
          setBuildResult(prev => prev ? { ...prev, apk: { ...prev.apk, downloadUrl: url } } : prev);
        }
      } catch (_) {}
    }

    if (url && !isAppAssetsOrHashUrl(url)) {
      openInChromeCustomTabs(url);
    } else if (apkPackage?.blob) {
      await downloadBlobOrFile(
        apkPackage.blob,
        buildResult.apk.fileName,
        'application/vnd.android.package-archive',
        true
      );
    }
  };

  const handleDownloadAabInCustomTab = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!buildResult?.aab) return;

    // Check if running inside native Android App with direct file saver bridge:
    const androidBridge =
      typeof window !== 'undefined'
        ? (window as any).AndroidDownloader ||
          (window as any).AndroidApp ||
          (window as any).Android ||
          (window as any).JSBridge
        : null;

    if (androidBridge && typeof androidBridge.saveBase64File === 'function' && aabPackage?.blob) {
      try {
        onToast('💾 Saving AAB directly to phone Downloads folder...');
        const base64Data = await blobToBase64(aabPackage.blob);
        androidBridge.saveBase64File(
          base64Data,
          buildResult.aab.fileName,
          'application/octet-stream'
        );
        onToast('✅ AAB saved to phone Download folder!');
        return;
      } catch (err) {
        console.warn('Native save failed, continuing to custom tabs/download:', err);
      }
    }

    onToast('📦 Opening Custom Tab and starting AAB download...');

    let url = buildResult.aab.downloadUrl;
    if (isAppAssetsOrHashUrl(url) && aabPackage?.blob) {
      try {
        url = await createDownloadUrl(aabPackage.blob, buildResult.aab.fileName, 'application/octet-stream');
        if (!isAppAssetsOrHashUrl(url)) {
          setBuildResult(prev => prev ? { ...prev, aab: prev.aab ? { ...prev.aab, downloadUrl: url } : null } : prev);
        }
      } catch (_) {}
    }

    if (url && !isAppAssetsOrHashUrl(url)) {
      openInChromeCustomTabs(url);
    } else if (aabPackage?.blob) {
      await downloadBlobOrFile(
        aabPackage.blob,
        buildResult.aab.fileName,
        'application/octet-stream',
        true
      );
    }
  };

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onToast(`✅ ${label} link copied!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                {stage === 'loading'
                  ? 'Building App & Connecting to AppCreator05 Cloud...'
                  : stage === 'completed'
                  ? '🎉 Your App is Ready!'
                  : 'Build Error'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {config.appName} ({config.packageName})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6">
          {/* ================= STAGE 1: LOADING SPRING / SPINNER ================= */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 space-y-6 text-center">
              {/* Centered Glowing Loading Spring */}
              <div className="relative flex items-center justify-center">
                {/* Pulsating outer aura */}
                <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500/20 via-purple-500/20 to-teal-500/20 animate-ping opacity-60" />
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 blur-md animate-pulse" />

                {/* Spinning dual spring rings */}
                <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-emerald-400 border-r-teal-400 animate-spin flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-b-purple-400 animate-spin" />
                </div>

                {/* Center App Icon */}
                <div className="absolute w-10 h-10 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner border border-slate-700">
                  {config.appLogoUrl ? (
                    <img
                      src={config.appLogoUrl}
                      alt="App Icon"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Smartphone className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
              </div>

              {/* Progress & Live Message */}
              <div className="w-full max-w-md space-y-3">
                <div className="flex items-center justify-between text-xs px-1 font-semibold">
                  <span className="text-emerald-400 animate-pulse flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{progressStatus}</span>
                  </span>
                  <span className="font-mono text-slate-300">{progressPercent}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-purple-500 rounded-full transition-all duration-300 shadow"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>

                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  Please wait — your application binary files are automatically compiling and preparing AppCreator05 Cloud CDN distribution...
                </p>
              </div>

              {/* Steps Checklist */}
              <div className="w-full max-w-sm grid grid-cols-3 gap-2 text-[11px] pt-2">
                <div
                  className={`p-2 rounded-lg border text-center transition ${
                    progressPercent >= 40
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="font-semibold">1. APK File</div>
                  <div className="text-[10px]">{progressPercent >= 40 ? '✓ Ready' : 'Building...'}</div>
                </div>

                <div
                  className={`p-2 rounded-lg border text-center transition ${
                    progressPercent >= 75
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="font-semibold">2. AAB Bundle</div>
                  <div className="text-[10px]">{progressPercent >= 75 ? '✓ Ready' : 'Building...'}</div>
                </div>

                <div
                  className={`p-2 rounded-lg border text-center transition ${
                    progressPercent >= 100
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="font-semibold">3. AppCreator05 Cloud</div>
                  <div className="text-[10px]">{progressPercent >= 100 ? '✓ Ready' : 'Connecting...'}</div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STAGE 2: DOWNLOAD APK & DOWNLOAD AAB + SHARE & SAVE SUITE ================= */}
          {stage === 'completed' && buildResult && (
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Success Badge Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-purple-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5">
                      <span>App Build & Cloud Sync Complete!</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Save directly to your phone, share via <strong>WhatsApp</strong>, or store in <strong>Google Drive</strong>.
                    </p>
                  </div>
                </div>

                {buildResult.source === 'github' && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-950/80 border border-purple-500/40 px-2.5 py-1 rounded-full shrink-0">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>AppCreator05 Cloud CDN</span>
                  </span>
                )}
              </div>

              {/* Format Tab Selector (APK vs AAB vs Keystore) */}
              <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('apk')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'apk'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>APK (.apk)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('aab')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'aab'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>AAB (.aab)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('keystore')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'keystore'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 shrink-0" />
                  <span>Keystore (.keystore)</span>
                </button>
              </div>

              {/* Active Package Details & Action Box */}
              {(() => {
                const info = getActivePackageInfo();
                return (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                          activeTab === 'apk'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : activeTab === 'aab'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {info.label}
                        </span>
                        <span className="text-xs text-slate-300 font-mono truncate max-w-[200px] sm:max-w-xs" title={info.fileName}>
                          {info.fileName}
                        </span>
                      </div>

                      {info.downloadUrl && isPublicHttpUrl(info.downloadUrl) && (
                        <button
                          type="button"
                          onClick={() => copyUrl(info.downloadUrl, `${info.label} Link`)}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
                          title="Copy download link"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                        </button>
                      )}
                    </div>

                    {/* ⭐ THE 4 PRIMARY SHARE & SAVE BUTTONS ⭐ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. WhatsApp Share */}
                      <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        disabled={isSharing}
                        className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/40 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-200" />
                        <span>Send to WhatsApp</span>
                      </button>

                      {/* 2. Save to Device Folder */}
                      <button
                        type="button"
                        onClick={handleSaveToFolder}
                        disabled={isSavingFolder}
                        className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <FolderDown className="w-4 h-4 text-teal-400" />
                        <span>{isSavingFolder ? 'Saving...' : 'Save to Folder'}</span>
                      </button>

                      {/* 3. Google Drive Save */}
                      <button
                        type="button"
                        onClick={handleGoogleDriveSave}
                        disabled={isSavingDrive}
                        className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-blue-900/60 hover:bg-blue-800/80 border border-blue-600/40 text-blue-100 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <HardDrive className="w-4 h-4 text-blue-300" />
                        <span>Save to Google Drive</span>
                      </button>

                      {/* 4. Native Mobile Share Sheet */}
                      <button
                        type="button"
                        onClick={handleMobileShare}
                        disabled={isSharing}
                        className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-600/40 text-purple-100 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <Share2 className="w-4 h-4 text-purple-300" />
                        <span>Mobile Share Sheet</span>
                      </button>
                    </div>

                    {/* KEYSTORE SPECIFIC VIEW */}
                    {activeTab === 'keystore' ? (
                      <div className="space-y-4 pt-1">
                        {/* Keystore Signing Credentials Box */}
                        <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5 text-amber-400" />
                              <span>Current Active Keystore Credentials</span>
                            </span>
                            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                              AppCreator05.keystore
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                            <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Key Alias</span>
                                <span className="text-white font-bold">{config.keystore?.keyAlias || 'appcreator05'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyUrl(config.keystore?.keyAlias || 'appcreator05', 'Key Alias')}
                                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                title="Copy Key Alias"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Keystore &amp; Key Password</span>
                                <span className="text-white font-bold">{config.keystore?.storePassword || 'appcreator'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyUrl(config.keystore?.storePassword || 'appcreator', 'Keystore Password')}
                                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                title="Copy Password"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            💡 Keep this <strong className="text-slate-200">AppCreator05.keystore</strong> file and password safe! You will need this exact Keystore to publish future updates to your app on Google Play Store.
                          </p>
                        </div>

                        {/* Direct Quick Download Action */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleDownloadKeystore}
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 active:scale-98 transition cursor-pointer text-center"
                          >
                            <Download className="w-4 h-4" />
                            <span>Quick Download AppCreator05.keystore</span>
                            <Key className="w-3.5 h-3.5 text-emerald-200" />
                          </button>

                          <button
                            type="button"
                            onClick={handleDirectDownload}
                            disabled={downloading}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                            title="Direct browser download"
                          >
                            <FolderDown className="w-3.5 h-3.5" />
                            <span>Direct Download</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Direct Uploaded Download URL Box with Copy & Open (ALWAYS SHOWN) */}
                        <div className="p-3 bg-slate-950/90 rounded-xl border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-emerald-400" />
                              <span>
                                {info.isOnlineUrl
                                  ? `Direct Download Link (${activeTab.toUpperCase()} Uploaded):`
                                  : `Direct Download Link (${activeTab.toUpperCase()} Ready):`}
                              </span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {info.isOnlineUrl ? (
                                <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                  Online Link Ready
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowGitHubInput((prev) => !prev)}
                                  className="text-[10px] text-emerald-300 hover:text-white font-medium bg-emerald-950/90 hover:bg-emerald-900 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Cloud className="w-3 h-3" />
                                  <span>{showGitHubInput ? 'Hide Form' : 'Create AppCreator05 Online Link ↗'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              readOnly
                              value={
                                info.isOnlineUrl
                                  ? info.downloadUrl
                                  : isUploadingToGitHub
                                  ? 'Creating AppCreator05 Cloud link...'
                                  : 'Preparing AppCreator05 Cloud link...'
                              }
                              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2 text-[11px] text-slate-200 font-mono select-all outline-none"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (info.isOnlineUrl) {
                                  copyUrl(info.downloadUrl, `${activeTab.toUpperCase()} Link`);
                                } else {
                                  handleUploadGitHubNow();
                                }
                              }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                              title="Copy link"
                            >
                              <Copy className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                            </button>
                            {info.isOnlineUrl ? (
                              <a
                                href={info.downloadUrl}
                                download={info.fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  openInChromeCustomTabs(info.downloadUrl);
                                }}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer no-underline"
                                title="Open in Chrome or browser"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={handleUploadGitHubNow}
                                disabled={isUploadingToGitHub}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer disabled:opacity-50"
                                title="Create AppCreator05 Cloud online link"
                              >
                                <Cloud className="w-3.5 h-3.5" />
                                <span>{isUploadingToGitHub ? 'Uploading...' : 'Online Link'}</span>
                              </button>
                            )}
                          </div>

                          {/* Inline AppCreator05 Cloud Token & Config for Online Releases */}
                          {(!info.isOnlineUrl || showGitHubInput) && (
                            <div className="pt-2 mt-2 border-t border-slate-800/80 space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-slate-300">
                                <span className="flex items-center gap-1 text-purple-300 font-semibold">
                                  <Cloud className="w-3.5 h-3.5" />
                                  <span>Enable AppCreator05 Cloud Online Links:</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowGitHubInput((p) => !p)}
                                  className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                                >
                                  {showGitHubInput ? 'Hide' : 'Open Settings'}
                                </button>
                              </div>
                              {showGitHubInput && (
                                <div className="space-y-2 bg-slate-900/90 p-2.5 rounded-lg border border-purple-500/20">
                                  <p className="text-[10px] text-slate-400 leading-normal">
                                    By configuring an AppCreator05 Cloud Access Token, releases will be uploaded directly to your repository with high-speed CDN links:
                                  </p>
                                  <div>
                                    <label className="text-[10px] text-slate-400 block mb-0.5">AppCreator05 Cloud Project Path</label>
                                    <input
                                      type="text"
                                      value={githubRepo}
                                      onChange={(e) => setGithubRepo(e.target.value)}
                                      placeholder="https://github.com/appcreator05/25"
                                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 block mb-0.5">
                                      AppCreator05 Cloud Access Token
                                    </label>
                                    <input
                                      type="password"
                                      value={githubToken}
                                      onChange={(e) => setGithubToken(e.target.value)}
                                      placeholder="GitHub Access Token (Optional)"
                                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isUploadingToGitHub || !(typeof githubToken === 'string' && githubToken.trim())}
                                    onClick={handleUploadGitHubNow}
                                    className="w-full mt-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
                                  >
                                    <Cloud className="w-3.5 h-3.5" />
                                    <span>
                                      {isUploadingToGitHub
                                        ? 'Uploading to AppCreator05 Cloud...'
                                        : 'Upload to AppCreator05 Cloud & Create Online Link'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Direct Download in Browser / Custom Tabs */}
                        <div className="pt-1 flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              if (activeTab === 'apk') {
                                handleDownloadApkInCustomTab(e);
                              } else {
                                handleDownloadAabInCustomTab(e);
                              }
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 active:scale-98 transition cursor-pointer text-center"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download with Custom Tab</span>
                            <Globe className="w-3.5 h-3.5 text-emerald-200" />
                          </button>

                          <button
                            type="button"
                            onClick={handleDirectDownload}
                            disabled={downloading}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                            title="Direct browser download"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{downloading ? 'Downloading...' : 'Direct Download'}</span>
                          </button>
                        </div>

                        {/* Quick Keystore Download Banner */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs gap-2 mt-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                              <Key className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <span>Release Keystore (.keystore)</span>
                                <span className="text-[10px] text-amber-300 font-mono bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/30">
                                  Ready
                                </span>
                              </span>
                              <span className="text-[11px] text-slate-400 block font-mono">
                                Alias: <strong className="text-white">{config.keystore?.keyAlias || 'androidkey'}</strong> &bull; Password: <strong className="text-white">{config.keystore?.storePassword || 'android'}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setActiveTab('keystore')}
                              className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer text-center"
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadKeystore}
                              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download Keystore</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* All 3 Packages Quick Access Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div
                  onClick={() => setActiveTab('apk')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    activeTab === 'apk'
                      ? 'bg-emerald-950/50 border-emerald-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>APK Package</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                    {buildResult.apk.fileName}
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('aab')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    activeTab === 'aab'
                      ? 'bg-purple-950/50 border-purple-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-purple-400">
                    <Layers className="w-3.5 h-3.5" />
                    <span>AAB Bundle</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                    {buildResult.aab?.fileName || `${config.appName.toLowerCase()}-release.aab`}
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('keystore')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    activeTab === 'keystore'
                      ? 'bg-amber-950/50 border-amber-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Key className="w-3.5 h-3.5" />
                    <span>Release Keystore</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                    {getKeystorePackage().fileName}
                  </div>
                </div>
              </div>

              {/* Instructions & Storage Location Box */}
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Location of downloaded files:{' '}
                    <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                      Internal Storage &gt; Download
                    </strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 Send to <strong>WhatsApp</strong> to instantly save the file and link with friends. Or use <strong>Save to Folder</strong> to pick any custom folder or SD card on your device.
                </p>
              </div>

              {/* Release links */}
              {buildResult.releaseUrl && (
                <div className="flex items-center justify-end text-xs pt-0.5">
                  <a
                    href={buildResult.releaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline flex items-center gap-1 text-[11px]"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>View AppCreator05 Cloud Release ↗</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ================= STAGE 3: ERROR ================= */}
          {stage === 'error' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-base">Build could not be completed</h4>
                <p className="text-xs text-red-300 max-w-md mx-auto">{errorMessage}</p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Back
                </button>
                {errorMessage && (errorMessage.includes('Wallet') || errorMessage.includes('balance') || errorMessage.includes('login')) ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openWalletModal();
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{isLoggedIn ? 'Recharge Wallet (₹50 Required)' : 'Login to Wallet'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
