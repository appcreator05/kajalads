import React from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Wallet,
  X,
  Globe,
  Smartphone,
  ShieldCheck,
  Radio,
  Sun,
} from 'lucide-react';
import { AppConfig } from '../types';
import { useWallet } from '../context/WalletContext';

interface PreBuildCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfirmProceed: () => void;
}

export const PreBuildCheckModal: React.FC<PreBuildCheckModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfirmProceed,
}) => {
  const { balance } = useWallet();

  if (!isOpen) return null;

  const remainingBalance = Math.max(0, balance - 50);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-150 my-auto">
        {/* Amber Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                Please Recheck Your Details
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review your configuration before proceeding to build
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 border border-slate-700/60"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Important Fee Deduction Alert Box */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200/90 text-xs space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
              <span>⚠️ Notice: ₹50 Build Fee</span>
            </div>
            <p className="text-slate-300">
              Please recheck all the details you have filled. Once the build page opens,{' '}
              <strong className="text-white underline decoration-amber-400 font-bold">
                ₹50 will be deducted
              </strong>{' '}
              from your wallet balance.
            </p>
          </div>

          {/* Wallet Balance Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Current Balance</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{Number(balance || 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">After Deduction (-₹50)</span>
              <span className="font-bold text-slate-200 text-sm">
                ₹{Number(remainingBalance).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Filled Details Quick Summary Card */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Your App Configuration Summary
            </span>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  App Name:
                </span>
                <span className="font-bold text-white truncate text-right">
                  {config.appName || 'Untitled App'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  Website URL:
                </span>
                <span className="font-mono text-[11px] text-cyan-300 truncate max-w-[220px] text-right" title={config.websiteUrl}>
                  {config.websiteUrl || 'Not set'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Package Name:
                </span>
                <span className="font-mono text-[11px] text-indigo-300 truncate max-w-[220px] text-right">
                  {config.packageName || 'Not set'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  Screen Display:
                </span>
                <span className="text-emerald-300 font-semibold">
                  {config.keepScreenOn !== false ? 'Always On (No Sleep)' : 'System Default'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  Ad Network:
                </span>
                <span className="text-slate-300 font-semibold capitalize">
                  {config.adNetwork === 'none'
                    ? 'No Ads'
                    : config.adNetwork === 'admob'
                    ? 'Google AdMob'
                    : 'Start.io'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-5 sm:p-6 pt-3 border-t border-slate-800/80 bg-slate-900/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Button 1: Recheck (Stays on settings page to review/edit) */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95 order-2 sm:order-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Recheck</span>
            </button>

            {/* Button 2: I'm already checked (Proceeds to build section & deducts ₹50) */}
            <button
              type="button"
              onClick={onConfirmProceed}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95 order-1 sm:order-2"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>I'm already checked</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-2.5">
            Clicking &quot;I&apos;m already checked&quot; will open the Build Section and deduct ₹50.
          </p>
        </div>
      </div>
    </div>
  );
};
