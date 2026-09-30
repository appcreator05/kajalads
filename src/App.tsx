import React, { useState, useEffect } from 'react';
import { AppConfig, DEFAULT_APP_CONFIG } from './types';
import { Navbar } from './components/Navbar';
import { AppConfigForm } from './components/AppConfigForm';
import { MobileDevicePreview } from './components/MobileDevicePreview';
import { CodeInspectorModal } from './components/CodeInspectorModal';
import { BuildGuideModal } from './components/BuildGuideModal';
import { DownloadApkModal } from './components/DownloadApkModal';
import { GitHubBuildModal } from './components/GitHubBuildModal';
import { OkSaveModal } from './components/OkSaveModal';
import { AppBuildSection } from './components/AppBuildSection';
import { RequiredFieldsModal } from './components/RequiredFieldsModal';
import { PreBuildCheckModal } from './components/PreBuildCheckModal';
import { TranslateModal } from './components/TranslateModal';
import { WalletModal } from './components/WalletModal';
import { KeystoreModal } from './components/KeystoreModal';
import { GeneratedKeystoreResult } from './utils/keystoreGenerator';
import { useWallet } from './context/WalletContext';
import { exportAndroidProjectZip } from './utils/zipExporter';
import { downloadBlobOrFile, openInChromeCustomTabs } from './utils/fileDownloader';
import { getSavedLanguage } from './utils/translator';
import { persistAppConfig, restoreAppConfig } from './utils/persistentStorage';
import { enableScreenWakeLock } from './utils/wakeLock';
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Eye,
  Sliders,
  Code2,
  Layers,
  FileArchive,
  Cloud,
  Globe,
} from 'lucide-react';

export default function App() {
  const { isLoggedIn, balance, openWalletModal } = useWallet();
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('webtoapk_saved_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_APP_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load saved config:', e);
    }
    return DEFAULT_APP_CONFIG;
  });

  const [currentView, setCurrentView] = useState<'config' | 'build'>(() => {
    try {
      const isLocked = localStorage.getItem('webtoapk_build_locked') === 'true';
      const activeView = localStorage.getItem('webtoapk_active_view');
      if (isLocked || activeView === 'build') {
        return 'build';
      }
    } catch (e) {
      console.warn('Failed to check build lock:', e);
    }
    return 'config';
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [showOkSaveModal, setShowOkSaveModal] = useState(false);
  const [showRequiredFieldsModal, setShowRequiredFieldsModal] = useState(false);
  const [showPreBuildCheckModal, setShowPreBuildCheckModal] = useState(false);
  const [missingFields, setMissingFields] = useState({
    websiteUrl: false,
    appName: false,
    packageName: false,
  });
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [showKeystoreModal, setShowKeystoreModal] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>(() => getSavedLanguage());
  const [apkModalFormat, setApkModalFormat] = useState<'apk' | 'aab'>('apk');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'config' | 'preview'>('config');

  const handleKeystoreGenerated = (result: GeneratedKeystoreResult) => {
    handleKeystoreChange({
      useCustomKeystore: true,
      keystoreFileName: result.fileName,
      keystoreBase64: result.base64,
      keyAlias: result.alias,
      storePassword: result.password,
      keyPassword: result.password,
    });
    showToast(`🔑 Saved Keystore: ${result.fileName}`);
  };

  useEffect(() => {
    enableScreenWakeLock();
    restoreAppConfig().then((restored) => {
      if (restored) {
        setConfig((prev) => ({ ...prev, ...restored }));
      }
    }).catch((err) => {
      console.warn('Could not restore config:', err);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenApkModal = (format: 'apk' | 'aab' = 'apk') => {
    setApkModalFormat(format);
    setShowApkModal(true);
  };

  const handleConfigChange = (updated: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updated };
      persistAppConfig(next);
      return next;
    });
    if (updated.websiteUrl !== undefined && updated.websiteUrl.trim()) {
      setMissingFields((prev) => ({ ...prev, websiteUrl: false }));
    }
    if (updated.appName !== undefined && updated.appName.trim()) {
      setMissingFields((prev) => ({ ...prev, appName: false }));
    }
    if (updated.packageName !== undefined && updated.packageName.trim()) {
      setMissingFields((prev) => ({ ...prev, packageName: false }));
    }
  };

  const handleOkAndSaveClick = () => {
    const isUrlMissing = !config.websiteUrl || !config.websiteUrl.trim();
    const isAppNameMissing = !config.appName || !config.appName.trim();
    const isPackageMissing = !config.packageName || !config.packageName.trim();

    if (isUrlMissing || isAppNameMissing || isPackageMissing) {
      setMissingFields({
        websiteUrl: isUrlMissing,
        appName: isAppNameMissing,
        packageName: isPackageMissing,
      });
      setShowRequiredFieldsModal(true);
      return;
    }

    // Check Wallet Authentication and minimum ₹50 balance
    if (!isLoggedIn) {
      showToast('⚠️ Please login to your Wallet first. Each app build requires ₹50 balance.');
      openWalletModal();
      return;
    }

    if (balance < 50) {
      showToast(`⚠️ Insufficient wallet balance (₹${Number(balance || 0).toFixed(2)}). Each build requires ₹50. Please recharge.`);
      openWalletModal();
      return;
    }

    // If all required fields are filled properly, open Pre-Build Check Modal to warn and recheck!
    setMissingFields({
      websiteUrl: false,
      appName: false,
      packageName: false,
    });
    setShowPreBuildCheckModal(true);
  };

  const handleProceedToBuild = () => {
    setShowPreBuildCheckModal(false);
    // Lock build view so reopening app or refreshing stays on build section
    try {
      localStorage.setItem('webtoapk_build_locked', 'true');
      localStorage.setItem('webtoapk_active_view', 'build');
      localStorage.setItem('webtoapk_saved_config', JSON.stringify(config));
    } catch (_) {}
    setCurrentView('build');
  };

  const handleBackToConfig = () => {
    // Unlock build view when user clicks Back to Settings
    try {
      localStorage.removeItem('webtoapk_build_locked');
      localStorage.removeItem('webtoapk_saved_build_result');
      localStorage.removeItem('webtoapk_saved_build_apk');
      localStorage.removeItem('webtoapk_saved_build_aab');
      localStorage.setItem('webtoapk_active_view', 'config');
    } catch (_) {}
    setCurrentView('config');
    showToast('🔓 Build section unlocked. Returned to Settings.');
  };

  const handleFocusMissingField = (fieldKey: 'websiteUrl' | 'appName' | 'packageName') => {
    setMobileTab('config');
    setTimeout(() => {
      let inputId = 'input-website-url';
      if (fieldKey === 'appName') inputId = 'input-app-name';
      if (fieldKey === 'packageName') inputId = 'input-package-name';
      const el = document.getElementById(inputId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 150);
  };

  const handleAdMobChange = (updated: Partial<AppConfig['admob']>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        admob: { ...prev.admob, ...updated },
      };
      try {
        localStorage.setItem('webtoapk_saved_config', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleStartIoChange = (updated: Partial<AppConfig['startio']>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        startio: { ...prev.startio, ...updated },
      };
      try {
        localStorage.setItem('webtoapk_saved_config', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleKeystoreChange = (updated: Partial<AppConfig['keystore']>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        keystore: { ...prev.keystore, ...updated },
      };
      try {
        localStorage.setItem('webtoapk_saved_config', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      const blob = await exportAndroidProjectZip(config);
      const safeName = config.appName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'android_app';
      const fileName = `${safeName}_fullscreen_apk_project.zip`;
      await downloadBlobOrFile(blob, fileName, 'application/zip');
      showToast('APK Project ZIP downloaded successfully!');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to create ZIP package. Please check inputs.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLoadPreset = (presetName: string) => {
    if (currentView === 'build') {
      showToast('⚠️ Build section is locked. Please click "Back to Settings" first to unlock.');
      return;
    }
    setCurrentView('config');
    if (presetName === 'store') {
      setConfig({
        ...DEFAULT_APP_CONFIG,
        appName: 'TrendStore App',
        packageName: 'com.trendstore.shop',
        websiteUrl: 'https://fakestoreapi.com',
        appLogoUrl:
          'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&auto=format&fit=crop&q=80',
        splashImageUrl:
          'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
        splashBgColor: '#0f172a',
        adNetwork: 'admob',
        admob: {
          appId: '',
          bannerId: '',
          interstitialId: '',
          rewardedId: '',
        },
      });
      showToast('Loaded E-Commerce Store template (Ready for your AdMob IDs)');
    } else if (presetName === 'news') {
      setConfig({
        ...DEFAULT_APP_CONFIG,
        appName: 'Daily News 24',
        packageName: 'com.dailynews.portal',
        websiteUrl: 'https://en.wikipedia.org/wiki/Portal:Current_events',
        appLogoUrl:
          'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&auto=format&fit=crop&q=80',
        splashImageUrl:
          'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=80',
        splashBgColor: '#18181b',
        adNetwork: 'admob',
        admob: {
          appId: '',
          bannerId: '',
          interstitialId: '',
          rewardedId: '',
        },
      });
      showToast('Loaded News Portal template (Ready for your AdMob IDs)');
    } else if (presetName === 'game') {
      setConfig({
        ...DEFAULT_APP_CONFIG,
        appName: 'Cyber Retro Game',
        packageName: 'com.cybergame.arcade',
        websiteUrl: 'https://play2048.co',
        appLogoUrl:
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=80',
        splashImageUrl:
          'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
        splashBgColor: '#0b0f19',
        adNetwork: 'startio',
        startio: {
          appId: '',
          showBanner: true,
          showInterstitial: true,
          showRewarded: true,
        },
      });
      showToast('Loaded Web Game template with Start.io (Ready for your App ID)');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black overflow-x-hidden w-full max-w-full">
      {/* Top Navbar */}
      <Navbar
        config={config}
        onOpenApkModal={handleOpenApkModal}
        onDownloadZip={handleDownloadZip}
        isDownloading={isDownloading}
        onOpenCodeModal={() => setShowCodeModal(true)}
        onOpenGuideModal={() => setShowGuideModal(true)}
        onOpenGitHubModal={() => setShowGitHubModal(true)}
        onOpenTranslateModal={() => setShowTranslateModal(true)}
        currentLang={currentLang}
        onLoadPreset={handleLoadPreset}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-10 lg:pb-8 overflow-hidden">
        {currentView === 'build' ? (
          <AppBuildSection
            config={config}
            onBackToConfig={handleBackToConfig}
            onToast={showToast}
          />
        ) : (
          <>
            {/* Mobile View Switcher (for small screens) */}
            <div className="lg:hidden flex items-center justify-center p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6 max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => setMobileTab('config')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                  mobileTab === 'config'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                  mobileTab === 'preview'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Preview</span>
              </button>
            </div>

            {/* 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left / Main Column: Settings Form */}
              <div
                className={`lg:col-span-7 xl:col-span-7 space-y-6 ${
                  mobileTab === 'preview' ? 'hidden lg:block' : 'block'
                }`}
              >
                <AppConfigForm
                  config={config}
                  onChange={handleConfigChange}
                  onAdMobChange={handleAdMobChange}
                  onStartIoChange={handleStartIoChange}
                  onKeystoreChange={handleKeystoreChange}
                  highlightMissing={missingFields}
                />

                {/* ONLY ONE BUTTON: OK & Save */}
                <div className="pt-4 pb-2">
                  <button
                    id="main-ok-and-save-button"
                    type="button"
                    onClick={handleOkAndSaveClick}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 font-extrabold text-lg sm:text-xl text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition flex items-center justify-center cursor-pointer border border-emerald-400/40"
                  >
                    OK &amp; Save
                  </button>
                </div>
              </div>

              {/* Right Column: Interactive Phone Simulator */}
              <div
                className={`lg:col-span-5 xl:col-span-5 lg:sticky lg:top-24 flex flex-col items-center ${
                  mobileTab === 'config' ? 'hidden lg:flex' : 'flex'
                }`}
              >
                <div className="w-full flex items-center justify-between px-2 mb-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    Live Mobile Simulator
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    100% Immersive
                  </span>
                </div>

                <MobileDevicePreview config={config} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-3 sm:right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-medium animate-in slide-in-from-bottom-5 duration-200 max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Required Fields Custom Popup */}
      <RequiredFieldsModal
        isOpen={showRequiredFieldsModal}
        onClose={() => setShowRequiredFieldsModal(false)}
        missingFields={missingFields}
        onFocusField={handleFocusMissingField}
      />

      {/* ⭐ Pre-Build Verification & Wallet Fee Warning Modal ⭐ */}
      <PreBuildCheckModal
        isOpen={showPreBuildCheckModal}
        onClose={() => setShowPreBuildCheckModal(false)}
        config={config}
        onConfirmProceed={handleProceedToBuild}
      />

      {/* ⭐ OK & Save Flow Modal (Loading Spring & Direct Download APK / AAB Hub) ⭐ */}
      <OkSaveModal
        isOpen={showOkSaveModal}
        onClose={() => setShowOkSaveModal(false)}
        config={config}
        onToast={showToast}
      />

      {/* Direct APK & AAB Download Modal */}
      <DownloadApkModal
        isOpen={showApkModal}
        onClose={() => setShowApkModal(false)}
        config={config}
        initialFormat={apkModalFormat}
        onToast={showToast}
        onOpenGitHubModal={() => {
          setShowApkModal(false);
          setShowGitHubModal(true);
        }}
        onDownloadZip={handleDownloadZip}
      />

      {/* Code Inspector Modal */}
      <CodeInspectorModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        config={config}
      />

      {/* Build Guide Modal */}
      <BuildGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

      {/* AppCreator05 Cloud Actions & Mobile Install Modal */}
      <GitHubBuildModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        onToast={showToast}
      />

      {/* Language Translate Modal */}
      <TranslateModal
        isOpen={showTranslateModal}
        onClose={() => setShowTranslateModal(false)}
        currentLang={currentLang}
        onLanguageChanged={(code) => {
          setCurrentLang(code);
          showToast(`Language switched to ${code.toUpperCase()}!`);
        }}
      />

      {/* Wallet & Balance Modal */}
      <WalletModal />

      {/* Real Android Keystore Modal */}
      <KeystoreModal
        isOpen={showKeystoreModal}
        onClose={() => setShowKeystoreModal(false)}
        onKeystoreReady={handleKeystoreGenerated}
        onToast={showToast}
      />
    </div>
  );
}
