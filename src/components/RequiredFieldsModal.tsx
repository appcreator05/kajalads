import React from 'react';
import { AlertTriangle, Globe, Smartphone, Box, ArrowRight, X } from 'lucide-react';

interface RequiredFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: {
    websiteUrl: boolean;
    appName: boolean;
    packageName: boolean;
  };
  onFocusField?: (fieldKey: 'websiteUrl' | 'appName' | 'packageName') => void;
}

export const RequiredFieldsModal: React.FC<RequiredFieldsModalProps> = ({
  isOpen,
  onClose,
  missingFields,
  onFocusField,
}) => {
  if (!isOpen) return null;

  const handleAction = () => {
    onClose();
    // Focus on first missing field
    if (missingFields.websiteUrl) {
      onFocusField?.('websiteUrl');
    } else if (missingFields.appName) {
      onFocusField?.('appName');
    } else if (missingFields.packageName) {
      onFocusField?.('packageName');
    }
  };

  return (
    <div
      id="required-fields-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="required-fields-modal-content"
        className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-6 text-white space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-required-fields-modal-button"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Message */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 id="required-fields-title" className="text-lg font-bold text-white tracking-tight">
              Please fill all tasks
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Website URL, App Name, and Package Name are required to configure and generate your APK.
            </p>
          </div>
        </div>

        {/* Checklist of Missing Tasks */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
          {/* Task 1: Website URL */}
          <div
            className={`flex items-center justify-between p-2 rounded-lg border transition ${
              missingFields.websiteUrl
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className={`w-4 h-4 shrink-0 ${missingFields.websiteUrl ? 'text-amber-400' : 'text-emerald-400'}`} />
              <div>
                <span className="font-semibold block">Website URL</span>
                <span className="text-[10px] text-slate-400">e.g. https://yourwebsite.com</span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                missingFields.websiteUrl
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {missingFields.websiteUrl ? 'Required' : 'Completed'}
            </span>
          </div>

          {/* Task 2: App Name */}
          <div
            className={`flex items-center justify-between p-2 rounded-lg border transition ${
              missingFields.appName
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Smartphone className={`w-4 h-4 shrink-0 ${missingFields.appName ? 'text-amber-400' : 'text-emerald-400'}`} />
              <div>
                <span className="font-semibold block">App Name</span>
                <span className="text-[10px] text-slate-400">e.g. AppCreator05</span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                missingFields.appName
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {missingFields.appName ? 'Required' : 'Completed'}
            </span>
          </div>

          {/* Task 3: Package Name */}
          <div
            className={`flex items-center justify-between p-2 rounded-lg border transition ${
              missingFields.packageName
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Box className={`w-4 h-4 shrink-0 ${missingFields.packageName ? 'text-amber-400' : 'text-emerald-400'}`} />
              <div>
                <span className="font-semibold block">Package Name</span>
                <span className="text-[10px] text-slate-400">e.g. com.appcreator05.app</span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                missingFields.packageName
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {missingFields.packageName ? 'Required' : 'Completed'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            id="fill-tasks-action-button"
            type="button"
            onClick={handleAction}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>Fill Missing Fields</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
