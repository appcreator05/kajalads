import React, { useState, useRef, useMemo } from 'react';
import {
  Flame,
  Upload,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileJson,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { parseGoogleServicesJson, getFirebaseWebConfig } from '../utils/googleServicesParser';

interface GoogleServicesSectionProps {
  googleServicesJson?: string;
  googleServicesFileName?: string;
  currentPackageName: string;
  onUpdate: (data: { googleServicesJson: string; googleServicesFileName: string }) => void;
  onSyncPackageName: (newPackageName: string) => void;
}

export const GoogleServicesSection: React.FC<GoogleServicesSectionProps> = ({
  googleServicesJson = '',
  googleServicesFileName = '',
  currentPackageName,
  onUpdate,
  onSyncPackageName,
}) => {
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState(googleServicesJson);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    return parseGoogleServicesJson(googleServicesJson);
  }, [googleServicesJson]);

  const webConfig = useMemo(() => {
    return getFirebaseWebConfig(parsed);
  }, [parsed]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileProcess = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      onUpdate({
        googleServicesJson: content.trim(),
        googleServicesFileName: file.name || 'google-services.json',
      });
      setPastedText(content.trim());
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handlePasteApply = () => {
    onUpdate({
      googleServicesJson: pastedText.trim(),
      googleServicesFileName: 'google-services.json',
    });
  };

  const handleRemove = () => {
    onUpdate({
      googleServicesJson: '',
      googleServicesFileName: '',
    });
    setPastedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasConfig = Boolean(googleServicesJson && googleServicesJson.trim());
  const packageMismatch =
    parsed.isValid &&
    parsed.packageName &&
    currentPackageName &&
    parsed.packageName.toLowerCase() !== currentPackageName.toLowerCase();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              Google Services & Firebase
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                google-services.json
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Firebase Cloud Messaging (FCM), push notifications, analytics, and Google services configuration
            </p>
          </div>
        </div>

        {hasConfig && parsed.isValid && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active
          </span>
        )}
      </div>

      {!hasConfig ? (
        /* Empty State: Upload or Paste */
        <div className="space-y-4">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition ${
                inputMode === 'upload'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload File (.json)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition ${
                inputMode === 'paste'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Paste JSON
            </button>
          </div>

          {inputMode === 'upload' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-slate-700 hover:border-amber-500/50 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <FileJson className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Click to browse or Drag & Drop <span className="text-amber-400 font-mono">google-services.json</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Select the <code className="text-slate-400 font-mono">google-services.json</code> downloaded from Firebase Console
                </p>
              </div>
              <span className="text-[11px] px-3 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                Browse .json File
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`{\n  "project_info": {\n    "project_number": "123456789",\n    "project_id": "your-firebase-app",\n    ...\n  }\n}`}
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/70"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handlePasteApply}
                  disabled={!pastedText.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition shadow-sm"
                >
                  Apply google-services.json (Save)
                </button>
              </div>
            </div>
          )}

          {/* Quick Help Guide */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <span>Where to find google-services.json?</span>
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-1 ml-auto"
              >
                Firebase Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400">
              Go to Firebase Console &gt; Project Settings &gt; General &gt; Your apps (Android) &gt; click <strong className="text-slate-300 font-mono">Download google-services.json</strong> to get the file.
            </p>
          </div>
        </div>
      ) : (
        /* Config Loaded State: Parsed Details & Actions */
        <div className="space-y-4">
          {parsed.isValid ? (
            <>
              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-emerald-300 block truncate">
                      {googleServicesFileName || 'google-services.json'}
                    </span>
                    <span className="text-[11px] text-emerald-400/80">
                      Firebase configuration validated &amp; ready for APK / AAB builds
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition flex items-center gap-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>

              {/* Package Mismatch Warning */}
              {packageMismatch && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-amber-300 block">
                        Package Name Mismatch Detected!
                      </span>
                      <p className="text-[11px] text-amber-400/90 mt-0.5">
                        Firebase file specifies package <code className="bg-amber-900/50 px-1 py-0.5 rounded font-mono font-bold text-amber-200">{parsed.packageName}</code>, but current app package is <code className="bg-amber-900/50 px-1 py-0.5 rounded font-mono text-amber-200">{currentPackageName}</code>.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSyncPackageName(parsed.packageName!)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shrink-0 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sync Package Name
                  </button>
                </div>
              )}

              {/* Parsed Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Project ID */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Project ID</span>
                    {parsed.projectId && (
                      <button
                        type="button"
                        onClick={() => handleCopy(parsed.projectId!, 'projectId')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'projectId' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-mono font-medium text-slate-200 truncate">
                    {parsed.projectId || 'N/A'}
                  </div>
                </div>

                {/* Project Number / Sender ID */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Project Number (FCM Sender ID)</span>
                    {parsed.projectNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopy(parsed.projectNumber!, 'projectNumber')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'projectNumber' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-mono font-medium text-slate-200 truncate">
                    {parsed.projectNumber || 'N/A'}
                  </div>
                </div>

                {/* Package Name */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Client Package Name</span>
                    {parsed.packageName && (
                      <button
                        type="button"
                        onClick={() => handleCopy(parsed.packageName!, 'packageName')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'packageName' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-mono font-medium text-amber-300 truncate">
                    {parsed.packageName || 'N/A'}
                  </div>
                </div>

                {/* Mobile SDK App ID */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Firebase App ID</span>
                    {parsed.appId && (
                      <button
                        type="button"
                        onClick={() => handleCopy(parsed.appId!, 'appId')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'appId' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-mono font-medium text-slate-200 truncate">
                    {parsed.appId || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Build Inclusion Guarantee Badge */}
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>
                  <strong>Build Pipeline:</strong> When generating APK and AAB packages, this file will automatically inject into <code className="text-amber-300 font-mono">assets/google-services.json</code> and source paths.
                </span>
              </div>

              {/* Raw JSON Accordion */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full flex items-center justify-between p-3 bg-slate-950/60 text-xs font-medium text-slate-300 hover:bg-slate-950 transition"
                >
                  <span className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    View Raw google-services.json Content
                  </span>
                  {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showRawJson && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopy(googleServicesJson, 'rawJson')}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedKey === 'rawJson' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy JSON
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 p-2 rounded bg-slate-900/80 border border-slate-800">
                      {googleServicesJson}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Invalid JSON Warning */
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Invalid google-services.json Format
                </span>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-rose-300 hover:underline"
                >
                  Reset / Remove
                </button>
              </div>
              <p className="text-xs text-rose-400/90">{parsed.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
