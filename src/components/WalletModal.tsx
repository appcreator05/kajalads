import React, { useState } from 'react';
import { useWallet, REDIRECT_URL } from '../context/WalletContext';
import { openInChromeCustomTabs } from '../utils/fileDownloader';
import {
  Wallet,
  X,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  LogOut,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  UserPlus,
  LogIn
} from 'lucide-react';

export const WalletModal: React.FC = () => {
  const {
    user,
    balance,
    isLoggedIn,
    isWalletModalOpen,
    closeWalletModal,
    login,
    logout,
    refreshBalance,
  } = useWallet();

  const [loginType, setLoginType] = useState<'email' | 'mobile'>('email');
  const [userId, setUserId] = useState('');
  const [userPin, setUserPin] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isWalletModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    setAuthLoading(true);

    const res = await login(loginType, userId, userPin);
    setAuthLoading(false);

    if (!res.success) {
      setAuthMsg({ text: res.error || 'Authentication failed', type: 'error' });
    } else {
      setAuthMsg({ text: 'Login successful!', type: 'success' });
      setUserPin('');
    }
  };

  const handleOpenAddMoneyLink = () => {
    openInChromeCustomTabs(REDIRECT_URL);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalance();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {isLoggedIn ? 'My Wallet' : 'User Wallet Login'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isLoggedIn ? 'Live Balance & Recharge' : 'Login to Wallet with PIN'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeWalletModal}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {!isLoggedIn ? (
            /* 1. AUTH / LOGIN VIEW */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Enter your registered Email or Mobile with your 4-digit PIN to login. New user? Click <strong>Register</strong> below.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Login Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('email');
                      setUserId('');
                      setAuthMsg(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      loginType === 'email'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Gmail / Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('mobile');
                      setUserId('');
                      setAuthMsg(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      loginType === 'mobile'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Mobile Number</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {loginType === 'email' ? 'Enter Email Address' : 'Enter 10-Digit Mobile Number'}
                </label>
                <div className="relative">
                  {loginType === 'email' ? (
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  ) : (
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  )}
                  <input
                    type={loginType === 'email' ? 'email' : 'tel'}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder={loginType === 'email' ? 'example@gmail.com' : '9876543210'}
                    maxLength={loginType === 'mobile' ? 10 : undefined}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  4-Digit Security PIN
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={userPin}
                    onChange={(e) => setUserPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm tracking-widest text-white placeholder-slate-500 outline-none transition"
                    required
                  />
                </div>
              </div>

              {authMsg && (
                <div
                  className={`p-2.5 rounded-lg flex items-center gap-2 text-xs ${
                    authMsg.type === 'error'
                      ? 'bg-rose-950/50 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {authMsg.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span>{authMsg.text}</span>
                </div>
              )}

              {/* Action Buttons: Login on top, Register below */}
              <div className="space-y-2 pt-1">
                {/* 1. Login Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  {authLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Login</span>
                      <ArrowRight className="w-4 h-4 ml-0.5" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2 my-2">
                  <div className="h-px bg-slate-800 flex-1" />
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                    New User?
                  </span>
                  <div className="h-px bg-slate-800 flex-1" />
                </div>

                {/* 2. Register Button - opens link in Google Chrome app */}
                <button
                  type="button"
                  onClick={() => openInChromeCustomTabs(REDIRECT_URL)}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 font-semibold rounded-lg text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Register</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                </button>
              </div>
            </form>
          ) : (
            /* 2. DASHBOARD VIEW */
            <div className="space-y-4">
              {/* User Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                <div className="truncate pr-2">
                  <span className="text-slate-400">Account: </span>
                  <span className="font-semibold text-emerald-400">{user}</span>
                </div>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                  title="Refresh Balance"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>

              {/* Main Balance Display */}
              <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 border border-slate-800 text-center shadow-inner">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Available Wallet Balance
                </span>
                <div className="mt-2 text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 font-mono">
                  ₹{Number(balance || 0).toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  ⚡ ₹50 is deducted per APK/AAB build &bull; Synced with Firebase RTDB
                </p>
              </div>

              {/* Recharge Action */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-dashed border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Add Wallet Balance</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-medium">
                    Fast & Secure
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddMoneyLink}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Money</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                </button>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => openInChromeCustomTabs(REDIRECT_URL)}
                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                >
                  <span>App Creator Blog</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-600/30 text-rose-300 hover:text-rose-200 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
