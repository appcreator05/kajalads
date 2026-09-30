import React, { useState } from 'react';
import { X, Key, ShieldCheck, Download, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { generateRealForgeKeystore, GeneratedKeystoreResult } from '../utils/keystoreGenerator';
import { downloadBlobOrFile } from '../utils/fileDownloader';

interface KeystoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeystoreReady?: (result: GeneratedKeystoreResult) => void;
  onToast?: (msg: string) => void;
}

export const KeystoreModal: React.FC<KeystoreModalProps> = ({
  isOpen,
  onClose,
  onKeystoreReady,
  onToast,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await generateRealForgeKeystore({
        alias: 'appcreator05',
        password: 'appcreator',
        name: 'appcreator05 Developer',
        org: 'appcreator05',
        country: 'US',
        validityYears: 25,
        fileName: 'AppCreator05.keystore',
      });

      await downloadBlobOrFile(result.blob, result.fileName, 'application/x-pkcs12', true);

      if (onKeystoreReady) {
        onKeystoreReady(result);
      }
      if (onToast) {
        onToast(`🔑 Generated & Downloaded ${result.fileName}!`);
      }
      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to generate keystore:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-sm">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>Download Signing Keystore</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  PKCS#12
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                100% Valid RSA 2048-bit Android Keystore for Play Store &amp; Release APK
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold text-emerald-300 mb-0.5">
                Authentic Android Keystore File
              </p>
              <p className="text-[11px] text-emerald-300/80">
                This tool creates an authentic PKCS#12 keystore file (<strong className="text-white">AppCreator05.keystore</strong>) with a 2048-bit RSA private key and a 25-year self-signed certificate, compatible with Android Studio, Gradle, and Google Play Store.
              </p>
            </div>
          </div>

          {/* Direct Download Action Button */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-center space-y-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 active:scale-98 transition cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating &amp; Downloading Keystore...</span>
                </>
              ) : isDone ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Downloaded &amp; Added!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate &amp; Download AppCreator05.keystore</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Keystore Specifications:</span>
            </p>
            <p>• <strong>Format:</strong> PKCS#12 (.keystore)</p>
            <p>• <strong>Alias:</strong> <code className="text-amber-300 font-mono">appcreator05</code></p>
            <p>• <strong>Password:</strong> <code className="text-amber-300 font-mono">appcreator</code></p>
            <p>• <strong>Validity:</strong> 25 Years (Production Release Ready)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
