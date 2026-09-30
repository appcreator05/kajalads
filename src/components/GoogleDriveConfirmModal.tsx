import React from 'react';
import { HardDrive, X, Check, ShieldCheck, Globe, AlertCircle } from 'lucide-react';

interface GoogleDriveConfirmModalProps {
  isOpen: boolean;
  fileName: string;
  appName: string;
  fileSizeMb?: number;
  onConfirm: () => void;
  onCancel: () => void;
  isUploading: boolean;
  uploadStatus?: string;
}

export const GoogleDriveConfirmModal: React.FC<GoogleDriveConfirmModalProps> = ({
  isOpen,
  fileName,
  appName,
  fileSizeMb,
  onConfirm,
  onCancel,
  isUploading,
  uploadStatus,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-blue-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-100 relative">
        {/* Close Button */}
        {!isUploading && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Google Drive 1-Click Upload
            </h3>
            <p className="text-xs text-blue-300">
              গুগল ড্রাইভে সরাসরি আপলোড ও পাবলিক ডাউনলোড লিংক
            </p>
          </div>
        </div>

        {/* Action Description */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400">Target File:</span>
            <span className="font-mono font-bold text-white truncate max-w-[240px]">
              {fileName}
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400">Application:</span>
            <span className="font-semibold text-emerald-400">{appName}</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400">Destination:</span>
            <span className="font-semibold text-blue-400">Google Drive &gt; My Drive (আমার ড্রাইভ)</span>
          </div>
          {fileSizeMb !== undefined && fileSizeMb > 0 && (
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Approx Size:</span>
              <span className="font-mono text-slate-200">~{fileSizeMb.toFixed(1)} MB</span>
            </div>
          )}

          <p className="pt-1 text-slate-300">
            This will upload <strong>{fileName}</strong> directly to your personal Google Drive and set the sharing permission so that anyone with the link can download and install the app with 1 click.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-1.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Direct 1-click download link created automatically</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Fast Google Drive CDN downloads for your users</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Stored securely inside your own Google Drive</span>
          </div>
        </div>

        {/* Upload Status / Progress */}
        {isUploading && (
          <div className="p-3.5 rounded-xl bg-blue-950/60 border border-blue-500/40 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
            <span className="text-xs text-blue-200 animate-pulse font-medium">
              {uploadStatus || 'Connecting and uploading to Google Drive...'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUploading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 hover:from-blue-300 hover:to-emerald-300 flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>{isUploading ? 'Uploading...' : 'Confirm & Upload to Google Drive'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
