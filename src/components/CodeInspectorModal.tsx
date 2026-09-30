import React, { useState } from 'react';
import { X, Copy, Check, FileCode, Layers, ShieldCheck } from 'lucide-react';
import { AppConfig } from '../types';
import {
  generateActivityMainXml,
  generateActivitySplashXml,
  generateBuildGradle,
  generateMainActivityKt,
  generateManifestXml,
  generateSplashActivityKt,
  generateThemesXml,
} from '../utils/codeGenerator';

interface CodeInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
}

type TabType = 'manifest' | 'main' | 'splash' | 'gradle' | 'themes' | 'google-services';

export const CodeInspectorModal: React.FC<CodeInspectorModalProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('manifest');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let codeContent = '';
  let fileName = '';

  switch (activeTab) {
    case 'manifest':
      codeContent = generateManifestXml(config);
      fileName = 'AndroidManifest.xml';
      break;
    case 'main':
      codeContent = generateMainActivityKt(config);
      fileName = 'MainActivity.kt';
      break;
    case 'splash':
      codeContent = generateSplashActivityKt(config);
      fileName = 'SplashActivity.kt';
      break;
    case 'gradle':
      codeContent = generateBuildGradle(config);
      fileName = 'app/build.gradle.kts';
      break;
    case 'themes':
      codeContent = generateThemesXml();
      fileName = 'res/values/themes.xml';
      break;
    case 'google-services':
      codeContent = config.googleServicesJson || '';
      fileName = 'google-services.json';
      break;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">
              Generated Android Studio Source Code
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'manifest'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            AndroidManifest.xml
          </button>
          <button
            onClick={() => setActiveTab('main')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'main'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            MainActivity.kt (Fullscreen + Ads)
          </button>
          <button
            onClick={() => setActiveTab('splash')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'splash'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            SplashActivity.kt
          </button>
          <button
            onClick={() => setActiveTab('gradle')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'gradle'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            build.gradle.kts
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'themes'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            themes.xml (No Title / Fullscreen)
          </button>
          {config.googleServicesJson && (
            <button
              onClick={() => setActiveTab('google-services')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'google-services'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              google-services.json
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-2 bg-slate-950 text-xs text-slate-400 border-b border-slate-800">
          <span className="font-mono text-emerald-400">{fileName}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code View */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed">
          <pre className="whitespace-pre overflow-x-auto">{codeContent}</pre>
        </div>
      </div>
    </div>
  );
};
