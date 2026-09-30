import React, { useState } from 'react';
import {
  X,
  Cloud,
  Smartphone,
  CheckCircle2,
  Copy,
  Download,
  Terminal,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Layers,
  Cpu,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface GitHubBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const GitHubBuildModal: React.FC<GitHubBuildModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'workflow' | 'pwa' | 'local'>('workflow');
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [copiedCommands, setCopiedCommands] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const WORKFLOW_YAML = `name: Build AppCreator05 Android App

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-android-apk:
    name: Build Android APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Dependencies
        run: npm install

      - name: Build Web Application
        run: npm run build

      - name: Setup Java JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.5'

      - name: Sync Web Assets to Android App
        run: |
          mkdir -p android/app/src/main/assets/web
          cp -r dist/* android/app/src/main/assets/web/

      - name: Build Android Release APK & AAB
        run: |
          cd android
          chmod +x ./gradlew || true
          ./gradlew assembleRelease bundleRelease --no-daemon --stacktrace || ./gradlew assembleRelease --no-daemon

      - name: Upload Release Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: android-release-builds
          path: |
            android/app/build/outputs/apk/release/*.apk
            android/app/build/outputs/bundle/release/*.aab
          retention-days: 30`;

  const GIT_COMMANDS = `# 1. Initialize git & commit all files
git init
git add .
git commit -m "Initial commit: AppCreator05 with Automated Cloud Build"

# 2. Add your AppCreator05 Cloud remote repository URL
git branch -M main
git remote add origin https://appcreator05.cloud/appcreator05/25.git

# 3. Push to AppCreator05 Cloud (Automated pipeline will compile the APK!)
git push -u origin main`;

  const handleCopyWorkflow = () => {
    navigator.clipboard.writeText(WORKFLOW_YAML);
    setCopiedWorkflow(true);
    onToast('AppCreator05 Cloud build pipeline copied to clipboard!');
    setTimeout(() => setCopiedWorkflow(false), 3000);
  };

  const handleCopyCommands = () => {
    navigator.clipboard.writeText(GIT_COMMANDS);
    setCopiedCommands(true);
    onToast('Cloud deploy commands copied to clipboard!');
    setTimeout(() => setCopiedCommands(false), 3000);
  };

  const handleInstallPWA = async () => {
    const success = await install();
    if (success) {
      onToast('AppCreator05 installed on your device!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Build APK via AppCreator05</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  AppCreator05 Cloud
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Build an installable APK for this entire app via AppCreator05 Cloud and run it on any phone
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-medium transition ${
              activeTab === 'workflow'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>1. AppCreator05 Cloud Build (Recommended)</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-medium transition ${
              activeTab === 'pwa'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>2. Instant Mobile Install (PWA)</span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-medium transition ${
              activeTab === 'local'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>3. Android Studio / CLI</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* TAB 1: AppCreator05 Cloud */}
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/30 rounded-xl p-4 text-xs">
                <div className="flex items-center gap-2 font-semibold text-purple-200 text-sm mb-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Deploy to AppCreator05 Cloud to automatically build the APK!</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  This repository already includes the automated cloud pipeline and the complete <code className="text-purple-300 bg-purple-950/70 px-1 py-0.5 rounded font-mono">android/</code> project ready to build.
                </p>
              </div>

              {/* Step by Step instructions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  3 Easy Steps to Get Your APK:
                </h3>

                <div className="space-y-2.5 text-xs">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Push the Code to AppCreator05 Cloud</h4>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        In project Settings click <strong>Export to Cloud</strong> or push from your terminal to AppCreator05 Cloud.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">AppCreator05 Cloud Automatically Builds the APK</h4>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Go to your <strong>AppCreator05 Cloud Dashboard</strong> to see the Android App Build running automatically.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-white">2 Easy Ways to Download the APK File:</h4>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        When the build succeeds, you can download the APK from two direct locations:
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
                          <strong className="block text-emerald-300 font-semibold mb-1">
                            Method 1: From Cloud Releases (Direct APK)
                          </strong>
                          <span>
                            Go to the <strong>Releases</strong> section on the right side of your repo main page. Click on <code className="bg-emerald-950 px-1 py-0.5 rounded font-mono text-emerald-300">apk-creator-app.apk</code> to download directly!
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30 text-purple-200">
                          <strong className="block text-purple-300 font-semibold mb-1">
                            Method 2: From Cloud Build Summary
                          </strong>
                          <span>
                            Click the <strong>"Summary"</strong> button on the left of the build dashboard. Scroll to the bottom to find <span className="underline font-semibold">apk-creator-app</span> under <strong>Artifacts</strong>.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Git Terminal Commands snippet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    Git Push Commands:
                  </span>
                  <button
                    onClick={handleCopyCommands}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    {copiedCommands ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCommands ? 'Copied!' : 'Copy Commands'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {GIT_COMMANDS}
                </pre>
              </div>

              {/* Workflow Code Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-slate-400" />
                    appcreator05-cloud-build.yml (Included in project)
                  </span>
                  <button
                    onClick={handleCopyWorkflow}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    {copiedWorkflow ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedWorkflow ? 'Copied!' : 'Copy Pipeline'}</span>
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10.5px] font-mono text-slate-400">
                  <pre>{WORKFLOW_YAML}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Instant Mobile Install (PWA) */}
          {activeTab === 'pwa' && (
            <div className="space-y-4 text-xs">
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 font-semibold text-emerald-300 text-sm mb-1">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Install directly on mobile phone without compiling!</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  This app has <strong>Progressive Web App (PWA)</strong> integrated. Opening this link from any Android mobile browser allows installing it directly to your home screen just like a native Android application.
                </p>
              </div>

              {isInstalled ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold block text-sm">App Already Installed!</span>
                    <span className="text-xs text-emerald-300/80">
                      AppCreator05 is already installed and running on this device.
                    </span>
                  </div>
                </div>
              ) : isInstallable ? (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="font-semibold text-white text-sm">
                    1-Tap Install on this Device
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Tapping the button below adds the <strong className="text-white">AppCreator05</strong> app icon to your home screen and launches in fullscreen app mode.
                  </p>
                  <button
                    type="button"
                    onClick={handleInstallPWA}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install AppCreator05 on this Phone</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="font-semibold text-white text-sm">
                    How to Install from Mobile Browser:
                  </h4>
                  <ul className="space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                      <span>Open this app URL in <strong>Google Chrome</strong> on your mobile phone.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                      <span>Tap the top-right <strong>3-Dots (⋮)</strong> menu.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                      <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>. The app will install instantly!</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Share link box */}
              <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Live App URL for Mobile:</span>
                  <span className="text-xs text-slate-300 font-mono truncate block">
                    {window.location.href}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    onToast('App link copied! Open on your mobile phone.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 shrink-0 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Local Android Studio / CLI */}
          {activeTab === 'local' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Build with Android Studio or Gradle on your computer:</span>
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Inside this repository, the <code className="text-cyan-300 font-mono">android/</code> directory is a complete standalone Android Studio project.
                </p>

                <div className="pt-2 space-y-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="text-slate-500 block"># 1. Build the web app:</span>
                    npm install && npm run build
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="text-slate-500 block"># 2. Copy web files into Android assets:</span>
                    mkdir -p android/app/src/main/assets/web<br />
                    cp -r dist/* android/app/src/main/assets/web/
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="text-slate-500 block"># 3. Compile Release APK &amp; AAB (for Real Ads):</span>
                    cd android<br />
                    ./gradlew assembleRelease<br />
                    <span className="text-slate-500 block mt-1"># For Google Play Store AAB Bundle:</span>
                    ./gradlew bundleRelease
                  </div>
                </div>

                <p className="text-[11px] text-emerald-400 pt-1">
                  ✓ Signed Release APK created at <code className="font-mono">android/app/build/outputs/apk/release/app-release.apk</code> with Real Live Ads enabled.
                </p>
                <p className="text-[11px] text-purple-400">
                  ✓ Google Play Store AAB bundle created at <code className="font-mono">android/app/build/outputs/bundle/release/app-release.aab</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>AppCreator05 Cloud &amp; PWA Ready</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
