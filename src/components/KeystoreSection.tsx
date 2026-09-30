import React, { useEffect, useRef, useState } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  Upload,
  CheckCircle2,
  FileKey,
  Trash2,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import forge from 'node-forge';
import { KeystoreConfig } from '../types';
import { createRealForgeKeystoreSync } from '../utils/keystoreGenerator';

interface KeystoreSectionProps {
  keystore: KeystoreConfig;
  appName: string;
  onChange: (updated: Partial<KeystoreConfig>) => void;
}

export const KeystoreSection: React.FC<KeystoreSectionProps> = ({
  keystore,
  appName,
  onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'auto' (user doesn't have keystore -> generate) vs 'custom' (user has keystore -> input)
  const [activeTab, setActiveTab] = useState<'auto' | 'custom'>(() => {
    if (
      keystore.keystoreFileName &&
      keystore.keystoreFileName !== 'AppCreator05.keystore' &&
      !keystore.keystoreFileName.startsWith('AppCreator')
    ) {
      return 'custom';
    }
    return 'auto';
  });

  // Loading / processing states for automatic keystore generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);

  // Auto mode credentials toggle
  const [showAutoCredentials, setShowAutoCredentials] = useState(false);
  const [showAutoStorePass, setShowAutoStorePass] = useState(false);
  const [showAutoKeyPass, setShowAutoKeyPass] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Custom mode password visibilities
  const [showCustomStorePass, setShowCustomStorePass] = useState(false);
  const [showCustomKeyPass, setShowCustomKeyPass] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Helper to generate AppCreator05 auto keystore with realistic async processing
  const applyAutoKeystore = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      // Realistic cryptographic generation feedback delay (~1.1s)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const u8Array = createRealForgeKeystoreSync(
        'appcreator05',
        'appcreator',
        'appcreator05 Developer',
        'appcreator05',
        'US',
        25
      );
      let binary = '';
      for (let i = 0; i < u8Array.length; i++) {
        binary += String.fromCharCode(u8Array[i]);
      }
      const b64 = forge.util.encode64(binary);

      onChange({
        useCustomKeystore: true,
        keystoreFileName: 'AppCreator05.keystore',
        keystoreBase64: `data:application/x-pkcs12;base64,${b64}`,
        keyAlias: 'appcreator05',
        storePassword: 'appcreator',
        keyPassword: 'appcreator',
        organization: 'appcreator05',
        certificateName: 'appcreator05 Developer',
      });

      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 5000);
    } catch (err) {
      console.warn('Auto Keystore Generation Notice:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Automatically initialize auto-keystore if needed on mount
  useEffect(() => {
    const currentName = keystore.keystoreFileName || '';
    const needsGeneration =
      !keystore.keystoreBase64 ||
      currentName === 'android.keystore' ||
      !currentName.endsWith('.keystore');

    if (activeTab === 'auto' && needsGeneration) {
      applyAutoKeystore();
    }
  }, []);

  const handleTabChange = async (tab: 'auto' | 'custom') => {
    if (isGenerating) return;
    setActiveTab(tab);
    if (tab === 'auto') {
      await applyAutoKeystore();
    } else {
      // If switching to custom and no custom file yet, allow user to input
      if (keystore.keystoreFileName === 'AppCreator05.keystore') {
        onChange({
          useCustomKeystore: true,
          keystoreFileName: '',
          keystoreBase64: '',
          keyAlias: '',
          storePassword: '',
          keyPassword: '',
        });
      }
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onChange({
        useCustomKeystore: true,
        keystoreFileName: file.name,
        keystoreBase64: base64,
        keyAlias: keystore.keyAlias || file.name.replace(/\.[^/.]+$/, '').toLowerCase(),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleRemoveCustomFile = () => {
    onChange({
      keystoreFileName: '',
      keystoreBase64: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      {/* Section Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
            5
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2 flex-wrap">
              <span>Keystore Signing Credentials</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                APK &amp; AAB Signing
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Choose whether to automatically generate a new keystore or input your own existing keystore.
            </p>
          </div>
        </div>
      </div>

      {/* 2 Separate Section Switcher / Choice Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Section 1: Don't have keystore? -> Auto Generate & Add */}
        <button
          type="button"
          disabled={isGenerating}
          onClick={() => {
            if (isGenerating) return;
            if (activeTab !== 'auto') {
              handleTabChange('auto');
            } else {
              applyAutoKeystore();
            }
          }}
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition select-none cursor-pointer ${
            activeTab === 'auto'
              ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-100 ring-1 ring-emerald-500/30 shadow-sm'
              : 'border-slate-800/90 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:bg-slate-900/50'
          } ${isGenerating ? 'opacity-90 cursor-wait' : ''}`}
        >
          <div className="pt-0.5">
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                activeTab === 'auto'
                  ? 'border-emerald-400 bg-emerald-500'
                  : 'border-slate-600 bg-slate-800'
              }`}
            >
              {isGenerating ? (
                <Loader2 className="w-2.5 h-2.5 text-slate-950 animate-spin" />
              ) : activeTab === 'auto' ? (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              ) : null}
            </div>
          </div>
          <div className="flex-1 text-xs">
            <span className="font-semibold text-white block text-xs sm:text-sm mb-0.5 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>
                  {isGenerating ? 'Generating & Adding Keystore...' : 'Generate Keystore (Automatic)'}
                </span>
              </span>
              {isGenerating && (
                <span className="text-[10px] text-emerald-300 font-mono animate-pulse">Processing...</span>
              )}
            </span>
            <span className="text-[11px] text-slate-400 leading-relaxed block">
              {isGenerating
                ? 'Creating RSA 2048-bit certificate & auto-attaching to app...'
                : "Don't have a keystore? Automatically generate and auto-add a valid release key."}
            </span>
          </div>
        </button>

        {/* Section 2: Have keystore? -> Input Keystore File & Passwords */}
        <button
          type="button"
          disabled={isGenerating}
          onClick={() => handleTabChange('custom')}
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition select-none cursor-pointer ${
            activeTab === 'custom'
              ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-100 ring-1 ring-emerald-500/30 shadow-sm'
              : 'border-slate-800/90 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:bg-slate-900/50'
          }`}
        >
          <div className="pt-0.5">
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                activeTab === 'custom'
                  ? 'border-emerald-400 bg-emerald-500'
                  : 'border-slate-600 bg-slate-800'
              }`}
            >
              {activeTab === 'custom' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
            </div>
          </div>
          <div className="flex-1 text-xs">
            <span className="font-semibold text-white block text-xs sm:text-sm mb-0.5 flex items-center gap-1.5">
              <FileKey className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Use My Own Keystore (Input)</span>
            </span>
            <span className="text-[11px] text-slate-400 leading-relaxed block">
              Already have a keystore? Upload your file and enter password &amp; alias details.
            </span>
          </div>
        </button>
      </div>

      {/* ========================================================
          VIEW 1: USER DOES NOT HAVE KEYSTORE (AUTO-GENERATE & ADD)
          ======================================================== */}
      {activeTab === 'auto' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* While generating: Processing / Loading UI */}
          {isGenerating ? (
            <div className="p-6 rounded-xl bg-slate-950/90 border border-emerald-500/40 text-center space-y-3.5 animate-in fade-in duration-200 shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <span>Generating &amp; Adding Keystore...</span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    PKCS#12 RSA 2048-bit
                  </span>
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Creating cryptographic keypair, self-signing 25-year certificate, and auto-adding{' '}
                  <span className="text-emerald-300 font-mono font-medium">AppCreator05.keystore</span> to your app configuration...
                </p>
              </div>
              <div className="w-full max-w-xs mx-auto bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          ) : (
            <>
              {/* Just generated notification badge */}
              {justGenerated && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-[11px]">
                    <span className="font-semibold text-white">Keystore Successfully Generated &amp; Added!</span>
                    <span className="block text-emerald-300/90 mt-0.5">
                      <code className="text-white font-mono font-bold">AppCreator05.keystore</code> is attached and ready for production APK &amp; Play Store signing.
                    </span>
                  </div>
                </div>
              )}

              {/* Active Auto Keystore Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/40 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          AppCreator05.keystore
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Auto-Generated &amp; Added
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Authentic RSA 2048-bit PKCS#12 Keystore • Ready for Play Store &amp; Release APK signing
                      </p>
                    </div>
                  </div>
                </div>

                {/* "Show password" link requested by user */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => setShowAutoCredentials(!showAutoCredentials)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer underline underline-offset-4 decoration-emerald-500/50 hover:decoration-emerald-400"
                  >
                    {showAutoCredentials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAutoCredentials ? 'Hide password' : 'Show password'}</span>
                  </button>

                  <span className="text-[10px] text-slate-500 font-mono">
                    {showAutoCredentials ? 'Credentials Visible' : 'Click to view password & alias'}
                  </span>
                </div>
              </div>

              {/* Expanded Box when user clicks "Show password" */}
              {showAutoCredentials && (
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Keystore Credentials</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Keystore Password: appcreator */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-200">Keystore Password</label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('appcreator', 'storePass')}
                          className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
                        >
                          {copiedField === 'storePass' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showAutoStorePass ? 'text' : 'password'}
                          value={keystore.storePassword || 'appcreator'}
                          onChange={(e) => onChange({ storePassword: e.target.value })}
                          placeholder="appcreator"
                          className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white pr-10 outline-none transition font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAutoStorePass(!showAutoStorePass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                          aria-label="Toggle password visibility"
                        >
                          {showAutoStorePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Key Alias: appcreator05 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-200">Key Alias</label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('appcreator05', 'alias')}
                          className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
                        >
                          {copiedField === 'alias' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={keystore.keyAlias || 'appcreator05'}
                        onChange={(e) => onChange({ keyAlias: e.target.value })}
                        placeholder="appcreator05"
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white outline-none transition font-mono"
                      />
                    </div>

                    {/* Key Password: appcreator */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-200">Key Password</label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('appcreator', 'keyPass')}
                          className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
                        >
                          {copiedField === 'keyPass' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showAutoKeyPass ? 'text' : 'password'}
                          value={keystore.keyPassword || 'appcreator'}
                          onChange={(e) => onChange({ keyPassword: e.target.value })}
                          placeholder="appcreator"
                          className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white pr-10 outline-none transition font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAutoKeyPass(!showAutoKeyPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                          aria-label="Toggle key password visibility"
                        >
                          {showAutoKeyPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Organization / Developer Name: appcreator05 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-200">Organization / Developer Name</label>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">appcreator05</span>
                      </div>
                      <input
                        type="text"
                        value={keystore.organization || 'appcreator05'}
                        onChange={(e) => onChange({ organization: e.target.value })}
                        placeholder="appcreator05"
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white outline-none transition font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 2: USER HAS EXISTING KEYSTORE (INPUT FILE & PASSWORDS)
          ======================================================== */}
      {activeTab === 'custom' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* File Upload Box */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <FileKey className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload Keystore File (.keystore / .jks)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Your Existing Key</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".keystore,.jks"
              onChange={handleFileChange}
              className="hidden"
            />

            {keystore.keystoreFileName && keystore.keystoreBase64 && keystore.keystoreFileName !== 'AppCreator05.keystore' ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">
                      {keystore.keystoreFileName}
                    </p>
                    <p className="text-[11px] text-emerald-400/90 font-medium">
                      Keystore File Loaded
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer border border-slate-700"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCustomFile}
                    className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 transition cursor-pointer border border-red-900/40"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                  isDragOver
                    ? 'border-emerald-400 bg-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                }`}
              >
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-200">
                  Click or drag &amp; drop your <span className="text-emerald-400 font-semibold">.keystore</span> or <span className="text-emerald-400 font-semibold">.jks</span> file here
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard Android Keystore file
                </p>
              </div>
            )}
          </div>

          {/* Input Fields: Keystore Password, Key Alias, Key Password, Organization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Keystore Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-200">Keystore Password</label>
                <span className="text-[10px] text-slate-500 font-mono">storePassword</span>
              </div>
              <div className="relative">
                <input
                  type={showCustomStorePass ? 'text' : 'password'}
                  value={keystore.storePassword || ''}
                  onChange={(e) => onChange({ storePassword: e.target.value })}
                  placeholder="Enter keystore password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white pr-10 outline-none transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomStorePass(!showCustomStorePass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showCustomStorePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Key Alias */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-200">Key Alias</label>
                <span className="text-[10px] text-slate-500 font-mono">keyAlias</span>
              </div>
              <input
                type="text"
                value={keystore.keyAlias || ''}
                onChange={(e) => onChange({ keyAlias: e.target.value })}
                placeholder="e.g. mykey, upload, release"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none transition font-mono"
              />
            </div>

            {/* Key Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-200">Key Password</label>
                <span className="text-[10px] text-slate-500 font-mono">keyPassword</span>
              </div>
              <div className="relative">
                <input
                  type={showCustomKeyPass ? 'text' : 'password'}
                  value={keystore.keyPassword || ''}
                  onChange={(e) => onChange({ keyPassword: e.target.value })}
                  placeholder="Enter key password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white pr-10 outline-none transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomKeyPass(!showCustomKeyPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  aria-label="Toggle key password visibility"
                >
                  {showCustomKeyPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Organization / Developer Name (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-200">Organization / Developer Name</label>
                <span className="text-[10px] text-slate-500">Optional</span>
              </div>
              <input
                type="text"
                value={keystore.organization || ''}
                onChange={(e) => onChange({ organization: e.target.value })}
                placeholder="Developer or Company Name"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none transition"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
