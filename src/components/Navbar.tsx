import React from 'react';
import { Smartphone, HelpCircle, Sparkles, Globe } from 'lucide-react';
import { AppConfig } from '../types';
import { WalletBalanceButton } from './WalletBalanceButton';

interface NavbarProps {
  config: AppConfig;
  onOpenApkModal: (format?: 'apk' | 'aab') => void;
  onDownloadZip: () => void;
  isDownloading: boolean;
  onOpenCodeModal?: () => void;
  onOpenGuideModal: () => void;
  onOpenGitHubModal?: () => void;
  onOpenTranslateModal: () => void;
  currentLang?: string;
  onLoadPreset: (presetName: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  onOpenApkModal,
  onDownloadZip,
  isDownloading,
  onOpenCodeModal,
  onOpenGuideModal,
  onOpenGitHubModal,
  onOpenTranslateModal,
  currentLang = 'en',
  onLoadPreset,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-slate-950 border border-cyan-500/30 shadow-lg shadow-cyan-500/20 shrink-0 flex items-center justify-center p-0.5">
            <img
              src="/logo.png"
              alt="AppCreator05 Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white truncate">
                AppCreator05
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> Fullscreen
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate">
              Direct .APK &amp; .AAB Download • AdMob &amp; Start.io Ads Integrated
            </p>
          </div>
        </div>

        {/* Center: Wallet Balance Display (as positioned in user image) */}
        <div className="flex items-center shrink-0">
          <WalletBalanceButton />
        </div>

        {/* Center: Presets */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs text-slate-400">Sample Demos:</span>
          <button
            type="button"
            onClick={() => onLoadPreset('store')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
          >
            E-Commerce
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset('news')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
          >
            News Portal
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset('game')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
          >
            Web Game
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Translate Button - text stays "Translate" and never changes when language changes */}
          <button
            type="button"
            onClick={onOpenTranslateModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-950/70 hover:bg-purple-900/90 border border-purple-600/50 rounded-lg shadow-sm transition cursor-pointer notranslate"
            title="Translate Language / ভাষা পরিবর্তন করুন"
            translate="no"
          >
            <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0 notranslate" />
            <span className="notranslate" translate="no">Translate</span>
            {currentLang && currentLang !== 'en' && (
              <span className="px-1 py-0.2 bg-purple-500/30 text-purple-300 rounded text-[10px] uppercase font-bold notranslate" translate="no">
                {currentLang}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenGuideModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition"
            title="How to build APK"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
};
