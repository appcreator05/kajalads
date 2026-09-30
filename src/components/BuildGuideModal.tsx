import React from 'react';
import { X, Smartphone, CheckCircle, Terminal, HelpCircle, ExternalLink, ShieldCheck } from 'lucide-react';

interface BuildGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuildGuideModal: React.FC<BuildGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">
              How to Build & Export Your APK File
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-slate-300 text-sm">
          {/* Direct APK Download Guide */}
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 space-y-2">
            <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Direct .APK / .AAB Download (One-Click)
            </h4>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              To install directly on your phone without Android Studio or extracting ZIPs, click the{' '}
              <strong className="text-white font-mono">"Download Direct APK (.apk)"</strong> button on the main page.
            </p>
            <ul className="list-disc list-inside text-xs text-emerald-200/90 space-y-1 pl-2">
              <li>Downloads directly as a signed <code className="bg-emerald-900/60 px-1 py-0.5 rounded text-white font-mono">.apk</code> package.</li>
              <li>For Google Play Store submission, select <strong className="text-purple-300 font-mono">.AAB</strong> bundle format.</li>
              <li>After downloading on your device, tap the notification to install. If prompted for "Install unknown apps", tap Allow.</li>
            </ul>
          </div>

          {/* Developer Quick Guide */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              Developer Source Code (Android Studio Project ZIP)
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed">
              <li>To modify full native Kotlin code, click the <strong>"Source ZIP"</strong> button.</li>
              <li>Extract the ZIP archive and open the folder in <strong>Android Studio</strong>.</li>
              <li>Always build a <strong>Release APK / AAB</strong> so Google AdMob and Start.io display <strong>Real Production Ads</strong> instead of test ads.</li>
            </ol>
          </div>

          {/* Method 1: Android Studio */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center font-bold">
                1
              </span>
              Standard Method: Android Studio (GUI)
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p>
                <strong>Step 1:</strong> Download and extract your project ZIP file.
              </p>
              <p>
                <strong>Step 2:</strong> In Android Studio, select <em>File &gt; Open...</em> and select the extracted folder.
              </p>
              <p>
                <strong>Step 3:</strong> Click <em>Build &gt; Generate Signed Bundle / APK</em> (or <em>Build &gt; Build Bundle(s) / APK(s)</em>).
              </p>
              <p>
                <strong>Step 4:</strong> Select <strong>APK</strong> or <strong>Android App Bundle (.aab)</strong>, choose the <strong>release</strong> build variant, and use the included <code className="text-emerald-400">app/release.keystore</code>.
              </p>
              <p>
                <strong>Step 5:</strong> Android Studio compiles your signed Release APK/AAB with real live ads enabled!
              </p>
            </div>
          </div>

          {/* Method 2: Command Line */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center font-bold">
                2
              </span>
              Command Line (Terminal / Mac / Linux / Windows)
            </h4>
            <p className="text-xs text-slate-400">
              To build a signed Release package with <strong>Real Ads</strong>, run:
            </p>
            <div className="space-y-2">
              <div className="bg-black/80 rounded-lg p-3 font-mono text-xs text-emerald-400 border border-slate-800">
                <span className="text-slate-500 block"># 1. Build Signed Release APK (for Real Ads & Direct Install):</span>
                <code>./gradlew assembleRelease</code>
                <span className="text-slate-500 block text-[11px] mt-1">Output: app/build/outputs/apk/release/app-release.apk</span>
              </div>
              <div className="bg-black/80 rounded-lg p-3 font-mono text-xs text-purple-300 border border-slate-800">
                <span className="text-slate-500 block"># 2. Build Signed Release AAB (for Google Play Store):</span>
                <code>./gradlew bundleRelease</code>
                <span className="text-slate-500 block text-[11px] mt-1">Output: app/build/outputs/bundle/release/app-release.aab</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              <em>Note for Windows:</em> Use <code className="text-slate-200">gradlew.bat assembleRelease</code> or <code className="text-slate-200">gradlew.bat bundleRelease</code>.
            </p>
          </div>

          {/* AdMob & Start.io Notice */}
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200/95 space-y-2">
            <h5 className="font-semibold text-amber-300 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              Important: Real Ads vs Test Ads (AdMob & Start.io)
            </h5>
            <p>
              • <strong>Why Release Build is Required:</strong> Google Mobile Ads (AdMob) and Start.io automatically recognize <code>assembleDebug</code> as a test build, restricting impressions to test ads.
            </p>
            <p>
              • <strong>Real Ads Activation:</strong> Building with <code>./gradlew assembleRelease</code> or <code>./gradlew bundleRelease</code> marks the package as production-signed, activating <strong>Real Live Ads</strong> with your real Ad Unit IDs.
            </p>
            <p>
              • <strong>Google AdMob:</strong> Make sure your AdMob App ID and Ad Units are verified and active in the Google AdMob dashboard.
            </p>
            <p>
              • <strong>Start.io:</strong> Ensure your Start.io App ID is active in your Start.io developer console.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
