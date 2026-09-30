import React, { useState } from 'react';
import { Globe, Search, Check, X, RotateCcw, Sparkles } from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageOption, applyLanguage, getSavedLanguage } from '../utils/translator';

interface TranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: string;
  onLanguageChanged: (code: string) => void;
}

export const TranslateModal: React.FC<TranslateModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  onLanguageChanged,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredLanguages = SUPPORTED_LANGUAGES.filter((l) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  const popularLanguages = SUPPORTED_LANGUAGES.filter((l) => l.popular);

  const handleSelectLanguage = (lang: LanguageOption) => {
    onLanguageChanged(lang.code);
    applyLanguage(lang.code);
    onClose();
  };

  const handleResetToEnglish = () => {
    onLanguageChanged('en');
    applyLanguage('en');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Select Language</span>
                <span className="text-xs text-purple-400 font-normal">/ ভাষা নির্বাচন করুন</span>
              </h3>
              <p className="text-xs text-slate-400">
                Translate entire page to your preferred language
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search language (e.g. Bengali, বাংলা, Hindi, Spanish)..."
              className="w-full bg-slate-900 text-white pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-700/80 focus:outline-none focus:border-purple-500 placeholder:text-slate-500 transition"
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Language List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Popular Section (only when no search query) */}
          {!searchQuery && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Popular Languages / জনপ্রিয় ভাষা</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {popularLanguages.map((l) => {
                  const isSelected = currentLang === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleSelectLanguage(l)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-sm'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200'
                      }`}
                    >
                      <span className="text-xl shrink-0">{l.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate flex items-center justify-between">
                          <span>{l.nativeName}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-1" />}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{l.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Languages Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {searchQuery ? `Matching Languages (${filteredLanguages.length})` : 'All Languages'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filteredLanguages.map((l) => {
                const isSelected = currentLang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleSelectLanguage(l)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/70 border-purple-500/80 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{l.flag}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-white block truncate">
                          {l.nativeName}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {l.name} ({l.code})
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredLanguages.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                  No languages found matching "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetToEnglish}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to English</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
