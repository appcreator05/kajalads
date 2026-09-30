import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Layers,
  ShieldCheck,
  Sparkles,
  FileCheck,
  AlertTriangle,
  Play,
  Globe,
  ExternalLink,
  Share2,
  RefreshCw,
  FolderOpen,
  Cloud,
  Cpu,
  FileArchive,
  CheckCircle,
  UploadCloud,
  Key,
  Settings,
  Loader2,
  Check,
  AlertCircle,
  Copy,
  Link,
  MessageCircle,
  Wallet,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { AppConfig } from '../types';
import { buildDirectApkFile, buildDirectAabFile } from '../utils/apkBuilder';
import {
  downloadBlobOrFile,
  openInChromeCustomTabs,
  isInsideAndroidApp,
  shareFileOnMobile,
  canWebShareFiles,
  openDeviceDownloadsFolder,
  installApkIfSupported,
  createDownloadUrl,
  downloadViaCustomTabs,
  shareToWhatsApp,
  isPublicHttpUrl,
  blobToBase64,
} from '../utils/fileDownloader';
import { isAppAssetsOrHashUrl, getBackendBaseUrl } from '../utils/apiConfig';
import {
  getSavedGitHubConfig,
  saveGitHubConfig,
  uploadApkToGitHubRelease,
  uploadToFreeCloud,
  checkServerGitHubConfig,
  GitHubUploadResult,
  GitHubCredentials,
} from '../utils/githubUploader';

interface DownloadApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  initialFormat?: 'apk' | 'aab';
  onToast: (msg: string) => void;
  onOpenGitHubModal?: () => void;
  onDownloadZip?: () => void;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({
  isOpen,
  onClose,
  config,
  initialFormat = 'apk',
  onToast,
  onOpenGitHubModal,
  onDownloadZip,
}) => {
  const { isLoggedIn, balance, deductBuildFee, openWalletModal } = useWallet();
  const [selectedFormat, setSelectedFormat] = useState<'apk' | 'aab'>(initialFormat);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStatusText, setBuildStatusText] = useState('');
  const [buildError, setBuildError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [builtFile, setBuiltFile] = useState<{
    blob: Blob;
    fileName: string;
    url: string;
    format: 'apk' | 'aab';
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const format: 'apk' | 'aab' = initialFormat === 'aab' ? 'aab' : 'apk';
      setSelectedFormat(format);
      handleStartBuild(format);
    } else {
      if (builtFile?.url) {
        URL.revokeObjectURL(builtFile.url);
      }
      setBuiltFile(null);
      setIsBuilding(false);
      setBuildProgress(0);
      setBuildError(null);
    }
  }, [isOpen, initialFormat]);

  const handleStartBuild = async (format: 'apk' | 'aab') => {
    setIsBuilding(true);
    setBuildError(null);
    setBuildProgress(5);
    setBuildStatusText('Checking wallet balance (₹50 required)...');
    setSelectedFormat(format);

    try {
      if (!isLoggedIn) {
        throw new Error('Please login to your Wallet first. Each app build requires ₹50 balance.');
      }

      setBuildProgress(10);
      setBuildStatusText('Deducting ₹50 build fee from Firebase wallet...');
      const deductResult = await deductBuildFee(config.appName || 'Android App');
      if (!deductResult.success) {
        throw new Error(deductResult.error || 'Insufficient balance! You need ₹50 to build this app.');
      }

      onToast(`⚡ ₹50 deducted for build! Remaining balance: ₹${(deductResult.remainingBalance ?? (balance - 50)).toFixed(2)}`);

      let result: { blob: Blob; fileName: string };

      if (format === 'apk') {
        result = await buildDirectApkFile(config, (pct, msg) => {
          setBuildProgress(pct);
          setBuildStatusText(msg);
        });
      } else {
        result = await buildDirectAabFile(config, (pct, msg) => {
          setBuildProgress(pct);
          setBuildStatusText(msg);
        });
      }

      const fileUrl = URL.createObjectURL(result.blob);
      const built = {
        blob: result.blob,
        fileName: result.fileName,
        url: fileUrl,
        format,
      };
      setBuiltFile(built);
      setIsBuilding(false);

      // ⚡ AUTO 1-CLICK INSTANT DOWNLOAD ON COMPLETION!
      try {
        const mimeType =
          format === 'apk'
            ? 'application/vnd.android.package-archive'
            : 'application/octet-stream';
        await downloadBlobOrFile(result.blob, result.fileName, mimeType);
        onToast(
          format === 'apk'
            ? '✅ 1-Click APK download started! Check your phone Downloads folder.'
            : '✅ AAB file downloaded!'
        );
      } catch (dlErr) {
        console.warn('Auto download error, user can tap button:', dlErr);
      }
    } catch (error: any) {
      console.error('Build error:', error);
      setIsBuilding(false);
      setBuildError(error?.message || 'Failed to compile file. Please verify settings.');
      onToast('Failed to compile file. Please verify settings.');
    }
  };

  const [downloading, setDownloading] = useState(false);
  const [serverDownloadUrl, setServerDownloadUrl] = useState<string | null>(null);
  const [preparingUrl, setPreparingUrl] = useState(false);

  // GitHub Release and Cloud Uploader States
  const [githubCreds, setGithubCreds] = useState<GitHubCredentials>(() => getSavedGitHubConfig());
  const [showGitHubConfig, setShowGitHubConfig] = useState(false);
  const [isUploadingGitHub, setIsUploadingGitHub] = useState(false);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [gitHubResult, setGitHubResult] = useState<GitHubUploadResult | null>(null);
  const [cloudResultUrl, setCloudResultUrl] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [serverRepo, setServerRepo] = useState('');

  // Check if GitHub is pre-configured on server
  useEffect(() => {
    checkServerGitHubConfig().then((res) => {
      setServerConfigured(res.configuredOnServer);
      if (res.serverRepo) {
        setServerRepo(res.serverRepo);
        if (!githubCreds.repo || githubCreds.repo.includes('tra105')) {
          setGithubCreds((prev) => ({ ...prev, repo: res.serverRepo }));
        }
      }
    });
  }, []);

  // Automatically prepare the real HTTPS server download URL in the background
  useEffect(() => {
    if (!builtFile) {
      setServerDownloadUrl(null);
      setGitHubResult(null);
      setCloudResultUrl(null);
      return;
    }
    let isSubscribed = true;
    setPreparingUrl(true);
    const mime =
      builtFile.format === 'apk'
        ? 'application/vnd.android.package-archive'
        : 'application/octet-stream';

    createDownloadUrl(builtFile.blob, builtFile.fileName, mime)
      .then((url) => {
        if (isSubscribed) {
          setServerDownloadUrl(url);
        }
      })
      .catch((err) => {
        console.warn('Failed to prepare server download URL:', err);
      })
      .finally(() => {
        if (isSubscribed) setPreparingUrl(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [builtFile]);

  const handleSaveGitHubConfig = () => {
    saveGitHubConfig(githubCreds);
    setShowGitHubConfig(false);
    onToast('✅ AppCreator05 Cloud configuration saved successfully!');
  };

  const handleUploadToGitHubAndDownload = async () => {
    if (!builtFile) return;
    if (!serverConfigured && (!githubCreds.token || !githubCreds.repo)) {
      setShowGitHubConfig(true);
      onToast('Please enter your AppCreator05 Cloud Token and Project ID.');
      return;
    }

    setIsUploadingGitHub(true);
    try {
      onToast('🚀 Uploading package to AppCreator05 Cloud...');
      const res = await uploadApkToGitHubRelease(
        builtFile.blob,
        builtFile.fileName,
        githubCreds
      );
      setGitHubResult(res);
      onToast('✅ Package uploaded to AppCreator05 Cloud! Starting Custom Tab download...');
      openInChromeCustomTabs(res.downloadUrl);
    } catch (err: any) {
      console.error('AppCreator05 Cloud Upload Failed:', err);
      onToast('AppCreator05 Cloud upload failed: ' + (err?.message || 'Error'));
      setShowGitHubConfig(true);
    } finally {
      setIsUploadingGitHub(false);
    }
  };

  const handleFreeCloudUploadAndDownload = async () => {
    if (!builtFile) return;
    setIsUploadingCloud(true);
    try {
      onToast('⚡ Uploading to free cloud host...');
      const res = await uploadToFreeCloud(builtFile.blob, builtFile.fileName);
      setCloudResultUrl(res.downloadUrl);
      onToast('✅ Cloud upload complete! Starting Custom Tab download...');
      openInChromeCustomTabs(res.downloadUrl);
    } catch (err: any) {
      console.error('Free cloud upload error:', err);
      onToast('Cloud upload failed: ' + (err?.message || 'Error'));
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const handleTriggerDownload = async (e?: React.MouseEvent) => {
    if (e && isInsideAndroidApp()) {
      e.preventDefault();
    }
    if (!builtFile) return;
    setDownloading(true);
    try {
      const mimeType =
        builtFile.format === 'apk'
          ? 'application/vnd.android.package-archive'
          : 'application/octet-stream';

      const ok = await downloadBlobOrFile(builtFile.blob, builtFile.fileName, mimeType);
      if (ok) {
        onToast(
          builtFile.format === 'apk'
            ? '✅ APK download started! Check notifications and Downloads folder.'
            : '✅ AAB download complete!'
        );
      }
    } catch (err) {
      console.error(err);
      if (serverDownloadUrl) {
        openInChromeCustomTabs(serverDownloadUrl);
        onToast('🚀 Download opened in Custom Tabs.');
      } else {
        onToast('Tap "Custom Tab URL Download" to start downloading.');
      }
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  };

  const handleCustomTabDownload = async () => {
    if (!builtFile) return;
    setDownloading(true);

    // If running inside Android App, directly save to Downloads storage
    const androidBridge =
      typeof window !== 'undefined'
        ? (window as any).AndroidDownloader ||
          (window as any).AndroidApp ||
          (window as any).Android ||
          (window as any).JSBridge
        : null;

    if (androidBridge && typeof androidBridge.saveBase64File === 'function') {
      try {
        onToast('💾 Saving file directly to device...');
        const base64Data = await blobToBase64(builtFile.blob);
        const mimeType =
          builtFile.format === 'apk'
            ? 'application/vnd.android.package-archive'
            : 'application/octet-stream';
        androidBridge.saveBase64File(base64Data, builtFile.fileName, mimeType);
        onToast('✅ File saved to your phone Downloads folder!');
        setTimeout(() => setDownloading(false), 800);
        return;
      } catch (err) {
        console.warn('Native save failed, continuing to custom tab download:', err);
      }
    }

    try {
      const mimeType =
        builtFile.format === 'apk'
          ? 'application/vnd.android.package-archive'
          : 'application/octet-stream';
      let url = serverDownloadUrl;
      if (!url || isAppAssetsOrHashUrl(url)) {
        url = await createDownloadUrl(builtFile.blob, builtFile.fileName, mimeType);
        if (!isAppAssetsOrHashUrl(url)) {
          setServerDownloadUrl(url);
        }
      }
      if (url && !isAppAssetsOrHashUrl(url)) {
        openInChromeCustomTabs(url);
        onToast('🚀 Download started via Custom Tab! Check notifications & Downloads folder.');
      } else {
        await downloadBlobOrFile(builtFile.blob, builtFile.fileName, mimeType, true);
      }
    } catch (err: any) {
      console.error('Custom tab download error:', err);
      onToast('Failed to prepare download: ' + (err?.message || 'Error'));
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  };

  const handleMobileShare = async () => {
    if (!builtFile) return;
    setSharing(true);
    try {
      const mimeType =
        builtFile.format === 'apk'
          ? 'application/vnd.android.package-archive'
          : 'application/octet-stream';
      const shared = await shareFileOnMobile(builtFile.blob, builtFile.fileName, mimeType);
      if (shared) {
        onToast('✅ File successfully shared / saved!');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setSharing(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!builtFile) return;
    setSharing(true);
    try {
      const mimeType =
        builtFile.format === 'apk'
          ? 'application/vnd.android.package-archive'
          : 'application/octet-stream';
      const knownValidUrl =
        (isPublicHttpUrl(gitHubResult?.downloadUrl) && gitHubResult?.downloadUrl) ||
        (isPublicHttpUrl(serverDownloadUrl) && serverDownloadUrl) ||
        (isPublicHttpUrl(cloudResultUrl) && cloudResultUrl) ||
        undefined;

      const res = await shareToWhatsApp(
        builtFile.blob,
        builtFile.fileName,
        config.appName,
        mimeType,
        knownValidUrl
      );
      onToast(res.message);
    } catch (e: any) {
      console.warn('WhatsApp share error:', e);
      onToast('WhatsApp share failed');
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/90 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-lg font-bold text-white truncate">Direct Android App Download</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full shrink-0">
                  Direct File
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Download .apk file directly and install on mobile device
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 sm:p-2 gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={isBuilding}
            onClick={() => handleStartBuild('apk')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition ${
              selectedFormat === 'apk'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            } disabled:opacity-50`}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Direct APK (.apk)</span>
            <span className="hidden xs:inline-block text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">
              Mobile Install
            </span>
          </button>

          <button
            type="button"
            disabled={isBuilding}
            onClick={() => handleStartBuild('aab')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition ${
              selectedFormat === 'aab'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            } disabled:opacity-50`}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>App Bundle (.aab)</span>
            <span className="hidden xs:inline-block text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">
              Play Store
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {isBuilding ? (
            /* Build in Progress Animation */
            <div className="py-6 sm:py-8 px-2 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
                  <Smartphone className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="absolute -inset-1 rounded-2xl border-2 border-emerald-500 border-t-transparent animate-spin" />
              </div>

              <div>
                <h4 className="text-sm sm:text-base font-semibold text-white">
                  Building {selectedFormat.toUpperCase()} File...
                </h4>
                <p className="text-xs text-slate-400 mt-1">{buildStatusText}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${buildProgress}%` }}
                />
              </div>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {buildProgress}% Complete
              </span>
            </div>
          ) : buildError ? (
            /* Build Error Card */
            <div className="p-4 sm:p-5 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-3">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Build Error Encountered</span>
              </div>
              <p className="text-xs text-rose-200 bg-black/30 p-2.5 rounded-lg font-mono break-all">
                {buildError}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {buildError.includes('Wallet') || buildError.includes('balance') || buildError.includes('login') ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openWalletModal();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{isLoggedIn ? 'Recharge Wallet (₹50 Needed)' : 'Login to Wallet'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartBuild(selectedFormat)}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Build</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openInChromeCustomTabs(getBackendBaseUrl())}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open in Chrome</span>
                </button>
              </div>
            </div>
          ) : builtFile ? (
            /* Build Finished Card */
            <div className="space-y-4 sm:space-y-5">
              {/* Ready Banner */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">{builtFile.fileName}</h4>
                      <span className="text-[9px] sm:text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
                        SIGNED
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                      Ready for direct download • Standalone {builtFile.format.toUpperCase()} binary
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                  {/* Primary Download Button (uses Custom Tab URL download on Android app) */}
                  <button
                    type="button"
                    onClick={handleTriggerDownload}
                    disabled={downloading}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg active:scale-95 transition ${
                      downloading
                        ? 'opacity-80 bg-emerald-700'
                        : isInsideAndroidApp()
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                        : builtFile.format === 'apk'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                        : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/25'
                    }`}
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>
                      {downloading
                        ? 'Downloading...'
                        : isInsideAndroidApp()
                        ? 'Download via Custom Tab'
                        : 'Download Now'}
                    </span>
                  </button>

                  {/* Dedicated Custom Tab URL Download Button */}
                  <button
                    type="button"
                    onClick={handleCustomTabDownload}
                    disabled={downloading}
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-cyan-200 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 active:scale-95 transition shadow-md"
                    title="Download directly through Chrome Custom Tabs via Real HTTPS URL"
                  >
                    <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Custom Tab Download</span>
                  </button>

                  {/* Open Device Downloads Folder */}
                  <button
                    type="button"
                    onClick={() => {
                      const opened = openDeviceDownloadsFolder();
                      if (!opened) {
                        onToast('Check your device File Manager > Downloads folder');
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/40 active:scale-95 transition shadow-md"
                    title="Open your device Downloads folder"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-400" />
                    <span>Downloads Folder</span>
                  </button>

                  {/* In-App Direct Install if inside Native Android App */}
                  {isInsideAndroidApp() && builtFile.format === 'apk' && (
                    <button
                      type="button"
                      onClick={() => {
                        const initiated = installApkIfSupported(builtFile.fileName);
                        if (!initiated) {
                          onToast('Open and install the file from your Downloads folder');
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-amber-200 bg-amber-950/70 hover:bg-amber-900 border border-amber-600/40 active:scale-95 transition shadow-md"
                      title="Direct Install via Package Installer"
                    >
                      <Play className="w-4 h-4 text-amber-400" />
                      <span>Direct Install</span>
                    </button>
                  )}

                  {/* Web Share API on supported Mobile phones */}
                  {canWebShareFiles() && (
                    <button
                      type="button"
                      onClick={handleMobileShare}
                      disabled={sharing}
                      className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-purple-200 bg-purple-950/70 hover:bg-purple-900 border border-purple-600/40 active:scale-95 transition shadow-md"
                      title="Share file or install directly"
                    >
                      <Share2 className="w-4 h-4 text-purple-400" />
                      <span>{sharing ? 'Sharing...' : 'Save on Mobile'}</span>
                    </button>
                  )}

                  {/* WhatsApp Direct Share Button */}
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    disabled={sharing}
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-emerald-100 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-600/50 active:scale-95 transition shadow-md"
                    title="Send file or link via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-300" />
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Exact Storage Location Guide Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-950/90 rounded-xl border border-emerald-500/20 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    File Location on Device:{' '}
                    <strong className="text-white font-mono bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                      Internal Storage &gt; Download &gt; {builtFile.fileName}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openDeviceDownloadsFolder()}
                  className="text-emerald-400 hover:text-emerald-300 font-medium underline text-[11px] self-start sm:self-auto"
                >
                  Go to folder &rarr;
                </button>
              </div>

              {/* ⭐ AppCreator05 Cloud Release & Custom Tabs Direct Download Engine ⭐ */}
              <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/50 rounded-2xl border border-purple-500/40 shadow-xl space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>AppCreator05 Cloud &amp; Custom Tabs Download</span>
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                          ✓ 100% Guaranteed Download
                        </span>
                        {serverConfigured && (
                          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                            ✓ Ready ({serverRepo})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        File will be uploaded to AppCreator05 Cloud for official high-speed CDN delivery and Chrome Custom Tabs will initiate download directly on mobile.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGitHubConfig(!showGitHubConfig)}
                    className="p-1.5 text-slate-400 hover:text-purple-300 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition shrink-0"
                    title="AppCreator05 Cloud Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* Upload Action Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleUploadToGitHubAndDownload}
                    disabled={isUploadingGitHub}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/25 active:scale-95 transition disabled:opacity-60"
                  >
                    {isUploadingGitHub ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Uploading to AppCreator05 Cloud...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 shrink-0" />
                        <span>🚀 Upload to AppCreator05 Cloud &amp; Custom Tab Download</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleFreeCloudUploadAndDownload}
                    disabled={isUploadingCloud}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/30 rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-60 shrink-0"
                    title="1-Click Cloud Upload & Download without Token"
                  >
                    {isUploadingCloud ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>⚡ 1-Click Cloud Download</span>
                      </>
                    )}
                  </button>
                </div>

                {/* AppCreator05 Cloud Config Drawer / Form */}
                {showGitHubConfig && (
                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-purple-500/30 space-y-3 mt-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs text-purple-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-400" />
                        <span>AppCreator05 Cloud Server Setup</span>
                      </span>
                      <span className="text-cyan-400 flex items-center gap-1 text-[11px]">
                        <span>Cloud Storage CDN ⚡</span>
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-400 text-[11px] mb-1">
                          AppCreator05 Cloud Access Token:
                        </label>
                        <input
                          type="password"
                          value={githubCreds.token}
                          onChange={(e) => setGithubCreds({ ...githubCreds, token: e.target.value })}
                          placeholder="apkc25_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-purple-500"
                        />
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Tip: Security authorization token for high-speed cloud distribution.
                        </span>
                      </div>

                      <div>
                        <label className="block text-slate-400 text-[11px] mb-1">
                          AppCreator05 Cloud Project Path:
                        </label>
                        <input
                          type="text"
                          value={githubCreds.repo}
                          onChange={(e) => setGithubCreds({ ...githubCreds, repo: e.target.value })}
                          placeholder="https://github.com/appcreator05/25"
                          className="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowGitHubConfig(false)}
                          className="px-3 py-1.5 text-slate-400 hover:text-white rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveGitHubConfig}
                          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow active:scale-95 transition"
                        >
                          Save Settings
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Successful AppCreator05 Cloud Upload Result Display */}
                {gitHubResult && (
                  <div className="p-3 bg-purple-950/50 border border-purple-500/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>AppCreator05 Cloud Release Ready ({gitHubResult.tagName})</span>
                      </div>
                      <a
                        href={gitHubResult.releaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-300 hover:text-purple-200 underline text-[11px] flex items-center gap-1"
                      >
                        <span>View AppCreator05 Cloud Package ↗</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={gitHubResult.downloadUrl}
                        className="w-full bg-slate-900 text-purple-200 font-mono text-[11px] px-3 py-2 rounded-lg border border-purple-500/30 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(gitHubResult.downloadUrl);
                          onToast('✅ AppCreator05 Cloud download link copied!');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap active:scale-95 transition"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => openInChromeCustomTabs(gitHubResult.downloadUrl)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-md active:scale-95 transition flex items-center gap-1.5"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Open in Custom Tab</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      🎉 This link is hosted on AppCreator05 High-Speed Cloud CDN. Tapping the Custom Tab button opens Google Chrome to download the file directly to your phone.
                    </p>
                  </div>
                )}

                {/* Free Cloud Upload Result Display */}
                {cloudResultUrl && !gitHubResult && (
                  <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-cyan-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span>Cloud Download Ready:</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-normal">Direct Link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={cloudResultUrl}
                        className="w-full bg-slate-900 text-cyan-200 font-mono text-[11px] px-3 py-2 rounded-lg border border-cyan-500/30 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(cloudResultUrl);
                          onToast('✅ Cloud download link copied!');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap active:scale-95 transition"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => openInChromeCustomTabs(cloudResultUrl)}
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-md active:scale-95 transition flex items-center gap-1.5"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Open in Custom Tab</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Real HTTPS Download URL Bar (Custom Tab & Browser Download) */}
              {serverDownloadUrl && (
                <div className="p-3 bg-slate-950/90 rounded-xl border border-cyan-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>Direct Download URL (Custom Tab / Chrome):</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                      ✓ Android Download Manager Supported
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={serverDownloadUrl}
                      className="w-full bg-slate-900 text-slate-300 font-mono text-[11px] px-3 py-2 rounded-lg border border-slate-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(serverDownloadUrl);
                        onToast('✅ Download link copied!');
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap active:scale-95 transition"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => openInChromeCustomTabs(serverDownloadUrl)}
                      className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold whitespace-nowrap active:scale-95 transition shadow-sm"
                    >
                      Open in Custom Tab
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    💡 Clicking this opens Google Chrome / Custom Tabs and Android's native system download engine saves the file directly into the <strong className="text-slate-200">Downloads folder</strong>.
                  </p>
                </div>
              )}

              {/* Instant Direct Download Link Fallback */}
              <div className="flex items-center justify-between px-2 text-xs">
                <span className="text-slate-400 text-[11px]">Alternative Download Method:</span>
                <a
                  href={serverDownloadUrl || builtFile.url}
                  download={builtFile.fileName}
                  className="text-emerald-400 hover:text-emerald-300 font-medium underline text-[11px] flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Direct Browser Download Link</span>
                </a>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 sm:p-3 bg-slate-950/60 rounded-xl border border-slate-800 min-w-0 overflow-hidden">
                  <span className="text-slate-400 block text-[10px] sm:text-[11px]">App Name</span>
                  <span className="font-semibold text-white truncate block mt-0.5">
                    {config.appName}
                  </span>
                </div>

                <div className="p-2.5 sm:p-3 bg-slate-950/60 rounded-xl border border-slate-800 min-w-0 overflow-hidden">
                  <span className="text-slate-400 block text-[10px] sm:text-[11px]">Package</span>
                  <span className="font-semibold text-emerald-400 truncate block mt-0.5 font-mono">
                    {config.packageName}
                  </span>
                </div>

                <div className="p-2.5 sm:p-3 bg-slate-950/60 rounded-xl border border-slate-800 min-w-0 overflow-hidden">
                  <span className="text-slate-400 block text-[10px] sm:text-[11px]">Screen Mode</span>
                  <span className="font-semibold text-cyan-400 block mt-0.5 truncate">
                    100% Fullscreen
                  </span>
                </div>

                <div className="p-2.5 sm:p-3 bg-slate-950/60 rounded-xl border border-slate-800 min-w-0 overflow-hidden">
                  <span className="text-slate-400 block text-[10px] sm:text-[11px]">Live Ads</span>
                  <span className="font-semibold text-amber-400 block mt-0.5 uppercase truncate">
                    {config.adNetwork === 'none' ? 'Disabled' : `${config.adNetwork} (Real)`}
                  </span>
                </div>

                <div className="p-2.5 sm:p-3 bg-slate-950/60 rounded-xl border border-slate-800 col-span-2 sm:col-span-1 min-w-0 overflow-hidden">
                  <span className="text-slate-400 block text-[10px] sm:text-[11px]">Signing Key</span>
                  <span className="font-semibold text-purple-400 truncate block mt-0.5">
                    {config.keystore?.useCustomKeystore
                      ? (config.keystore.keystoreFileName || 'Custom .JKS')
                      : 'Auto Release'}
                  </span>
                </div>
              </div>

              {/* Bengali & English Installation Guide & Parse Error Explanation */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>How to Install on Mobile:</span>
                </div>
                <ul className="space-y-1.5 text-slate-300 pl-5 list-disc marker:text-emerald-500">
                  <li>
                    <strong>Download:</strong> Clicking the green{' '}
                    <strong className="text-white font-mono">"Download Now"</strong> button above downloads
                    the <span className="text-emerald-400 font-mono">.apk</span> file directly to your phone's{' '}
                    <code className="bg-slate-800 px-1 rounded text-cyan-300">Downloads</code> folder.
                  </li>
                  <li>
                    <strong>Open:</strong> Once the download finishes, tap the file in your phone Notification Bar or File
                    Manager Downloads folder.
                  </li>
                  <li>
                    <strong>Permission:</strong> If prompted{' '}
                    <span className="text-amber-400">"Install unknown apps"</span>, allow your browser or
                    file manager by selecting <span className="text-emerald-400">"Allow"</span> and tap{' '}
                    <strong>Install</strong>.
                  </li>
                  <li>
                    <strong>Real Ads &amp; Fullscreen:</strong> The app will run in pure fullscreen mode with real ad configurations enabled!
                  </li>
                </ul>

                {/* Important Notice for "There was a problem while parsing the package" */}
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-[12px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Understanding &amp; Resolving "There was a problem while parsing the package":</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    1. <strong>Automatic redirect removed:</strong> Previously, downloads auto-redirected immediately to package installer, which has been removed to avoid package corruption.<br />
                    2. <strong>.AAB cannot be installed directly:</strong> <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-300 font-mono">.aab</code> (App Bundle) files are strictly for Google Play Store console upload, not direct phone installation.<br />
                    3. <strong>Official Standalone APK (100% Guaranteed):</strong> To compile native APK bytecodes for physical phones, use our official build options:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onOpenGitHubModal && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenGitHubModal();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold shadow transition active:scale-95"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>⚡ AppCreator05 Cloud Automated Build (Official APK)</span>
                      </button>
                    )}
                    {onDownloadZip && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onDownloadZip();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold transition"
                      >
                        <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
                        <span>📦 Project Source Code ZIP (Android Studio)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Initial Ready to Build Card */
            <div className="py-6 px-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  Ready to Build {selectedFormat.toUpperCase()} File
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Click the button below to generate and download your standalone {selectedFormat.toUpperCase()} package in 1 click.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartBuild(selectedFormat)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>⚡ 1-Click Build &amp; Download {selectedFormat.toUpperCase()}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Pure Fullscreen Immersive Mode is automatically enabled</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Close
            </button>
            {builtFile && (
              <a
                href={builtFile.url}
                download={builtFile.fileName}
                onClick={handleTriggerDownload}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition ${
                  builtFile.format === 'apk'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save {builtFile.fileName}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
