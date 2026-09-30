import React from 'react';
import { Wallet, Sparkles } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

export const WalletBalanceButton: React.FC = () => {
  const { balance, isLoggedIn, openWalletModal } = useWallet();

  return (
    <button
      type="button"
      onClick={openWalletModal}
      className="group relative flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:to-slate-700 border border-emerald-500/40 hover:border-emerald-400 shadow-sm hover:shadow-md hover:shadow-emerald-500/10 transition-all cursor-pointer notranslate"
      title={isLoggedIn ? 'Click to view Wallet & Recharge' : 'Click to Login to Wallet & View Balance'}
      translate="no"
    >
      {/* Wallet Icon with glow */}
      <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
        <Wallet className="w-3.5 h-3.5" />
        {isLoggedIn && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse" />
        )}
      </div>

      {/* Balance Text */}
      <div className="flex flex-col items-start leading-none min-w-0">
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:block">
          {isLoggedIn ? 'Balance' : 'Wallet'}
        </span>
        <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 group-hover:text-emerald-300 transition-colors">
          ₹{Number(balance || 0).toFixed(2)}
        </span>
      </div>

      {!isLoggedIn && (
        <span className="hidden md:inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
          Login
        </span>
      )}
    </button>
  );
};
