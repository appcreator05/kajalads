import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAPPdw4tLtXfkzaBAJk-DBC5KLyp8Jzu5w",
  authDomain: "update-2224e.firebaseapp.com",
  databaseURL: "https://update-2224e-default-rtdb.firebaseio.com",
  projectId: "update-2224e",
  storageBucket: "update-2224e.firebasestorage.app",
  messagingSenderId: "731168193501",
  appId: "1:731168193501:web:239c7be0fc864c7ca9d434"
};

export const RAZORPAY_KEY_ID = "rzp_live_T2PygvcB7moN7R";
export const REDIRECT_URL = "https://appcreator05.blogspot.com/p/add-wallet-apk-creator-app.html";

export function sanitizeIdentifier(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
}

interface WalletContextType {
  user: string | null;
  safeId: string | null;
  balance: number;
  isLoggedIn: boolean;
  isWalletModalOpen: boolean;
  openWalletModal: () => void;
  closeWalletModal: () => void;
  login: (type: 'email' | 'mobile', id: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  rechargeWithRazorpay: (
    amount: number,
    onStatus: (msg: string, type: 'error' | 'success') => void
  ) => void;
  refreshBalance: () => Promise<void>;
  deductBuildFee: (appName?: string) => Promise<{ success: boolean; error?: string; remainingBalance?: number }>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function getFirebaseDb() {
  if (typeof window !== 'undefined' && (window as any).firebase) {
    try {
      const firebase = (window as any).firebase;
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      return firebase.database();
    } catch (e) {
      console.warn('Firebase init warning:', e);
    }
  }
  return null;
}

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<string | null>(() => {
    try {
      return localStorage.getItem('wallet_user');
    } catch {
      return null;
    }
  });

  const [safeId, setSafeId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('wallet_safe_id');
    } catch {
      return null;
    }
  });

  const [balance, setBalance] = useState<number>(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const openWalletModal = () => setIsWalletModalOpen(true);
  const closeWalletModal = () => setIsWalletModalOpen(false);

  // Function to fetch balance via REST API fallback
  const fetchBalanceViaRest = useCallback(async (targetSafeId: string) => {
    try {
      const res = await fetch(
        `https://update-2224e-default-rtdb.firebaseio.com/users/${targetSafeId}/balance.json`
      );
      if (res.ok) {
        const val = await res.json();
        setBalance(typeof val === 'number' ? val : 0);
      }
    } catch (err) {
      console.warn('REST balance fetch warning:', err);
    }
  }, []);

  // Realtime balance listener when user is logged in
  useEffect(() => {
    if (!safeId) {
      setBalance(0);
      return;
    }

    let isSubscribed = true;
    const db = getFirebaseDb();

    // 1. Initial REST fetch for instant response
    fetchBalanceViaRest(safeId);

    // 2. Realtime listener if Firebase SDK is ready
    if (db) {
      try {
        const balanceRef = db.ref(`users/${safeId}/balance`);
        const onValueChange = (snapshot: any) => {
          if (!isSubscribed) return;
          const val = snapshot.val();
          setBalance(Number(val || 0));
        };

        balanceRef.on('value', onValueChange);

        return () => {
          isSubscribed = false;
          try {
            balanceRef.off('value', onValueChange);
          } catch {}
        };
      } catch (err) {
        console.warn('Firebase RTDB listener error, falling back to polling:', err);
      }
    }

    // 3. Fallback interval polling every 5 seconds
    const interval = setInterval(() => {
      if (isSubscribed && safeId) {
        fetchBalanceViaRest(safeId);
      }
    }, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [safeId, fetchBalanceViaRest]);

  const refreshBalance = useCallback(async () => {
    if (safeId) {
      await fetchBalanceViaRest(safeId);
    }
  }, [safeId, fetchBalanceViaRest]);

  const login = async (type: 'email' | 'mobile', id: string, pin: string) => {
    const rawId = id.trim();
    const cleanPin = pin.trim();

    if (!rawId) {
      return { success: false, error: type === 'email' ? 'Please enter your Email ID!' : 'Please enter your Mobile Number!' };
    }

    if (type === 'mobile' && (rawId.length !== 10 || isNaN(Number(rawId)))) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number!' };
    }

    if (cleanPin.length !== 4 || isNaN(Number(cleanPin))) {
      return { success: false, error: 'Please enter a valid 4-digit PIN!' };
    }

    const currentSafe = sanitizeIdentifier(rawId);
    const db = getFirebaseDb();

    try {
      if (db) {
        const userRef = db.ref(`users/${currentSafe}`);
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
          const userData = snapshot.val();
          if (String(userData.pin) === String(cleanPin)) {
            localStorage.setItem('wallet_user', rawId);
            localStorage.setItem('wallet_safe_id', currentSafe);
            setUser(rawId);
            setSafeId(currentSafe);
            setBalance(Number(userData.balance || 0));
            return { success: true };
          } else {
            return { success: false, error: 'Incorrect PIN! Please check and try again.' };
          }
        } else {
          return {
            success: false,
            error: 'User not found! Please click Register below to create your account.'
          };
        }
      } else {
        // Fallback using direct REST API
        const checkRes = await fetch(
          `https://update-2224e-default-rtdb.firebaseio.com/users/${currentSafe}.json`
        );
        const existingData = await checkRes.json();

        if (existingData && existingData.pin) {
          if (String(existingData.pin) === String(cleanPin)) {
            localStorage.setItem('wallet_user', rawId);
            localStorage.setItem('wallet_safe_id', currentSafe);
            setUser(rawId);
            setSafeId(currentSafe);
            setBalance(Number(existingData.balance || 0));
            return { success: true };
          } else {
            return { success: false, error: 'Incorrect PIN! Please check and try again.' };
          }
        } else {
          return {
            success: false,
            error: 'User not found! Please click Register below to create your account.'
          };
        }
      }
    } catch (err: any) {
      return { success: false, error: 'Connection Error: ' + (err?.message || 'Failed to connect') };
    }
  };

  const logout = () => {
    if (safeId) {
      const db = getFirebaseDb();
      if (db) {
        try {
          db.ref(`users/${safeId}/balance`).off();
        } catch {}
      }
    }
    localStorage.removeItem('wallet_user');
    localStorage.removeItem('wallet_safe_id');
    setUser(null);
    setSafeId(null);
    setBalance(0);
  };

  /**
   * Deducts ₹50 for building APK/AAB from current user's balance.
   * Decrements Firebase RTDB balance and logs a debit transaction.
   */
  const deductBuildFee = async (
    appName?: string
  ): Promise<{ success: boolean; error?: string; remainingBalance?: number }> => {
    const BUILD_COST = 50;

    if (!safeId || !user) {
      return {
        success: false,
        error: 'Please login to your Wallet first. Each app build requires ₹50 balance.'
      };
    }

    try {
      const db = getFirebaseDb();

      if (db) {
        // 1. Check current balance atomically or via once()
        const snapshot = await db.ref(`users/${safeId}/balance`).once('value');
        const currentBal = Number(snapshot.val() || 0);

        if (currentBal < BUILD_COST) {
          return {
            success: false,
            error: `Insufficient balance! Current balance is ₹${currentBal.toFixed(2)}. You need at least ₹${BUILD_COST} to build this app. Please recharge your wallet.`
          };
        }

        // 2. Perform atomic transaction to deduct ₹50
        const txnResult = await db.ref(`users/${safeId}/balance`).transaction((current: number | null) => {
          const val = Number(current || 0);
          if (val < BUILD_COST) {
            return; // abort transaction if balance became insufficient
          }
          return val - BUILD_COST;
        });

        if (!txnResult.committed) {
          return {
            success: false,
            error: `Transaction failed or insufficient balance! Balance must be at least ₹${BUILD_COST}.`
          };
        }

        const newBal = Number(txnResult.snapshot.val() || 0);

        // 3. Record debit transaction in Firebase
        try {
          await db.ref(`users/${safeId}/transactions`).push({
            amount: BUILD_COST,
            type: 'debit',
            purpose: 'APK / AAB App Build Fee',
            app_name: appName || 'Android App',
            date: new Date().toISOString()
          });
        } catch (txnLogErr) {
          console.warn('Transaction log warning:', txnLogErr);
        }

        setBalance(newBal);
        return { success: true, remainingBalance: newBal };
      } else {
        // Fallback using direct REST API
        const currRes = await fetch(
          `https://update-2224e-default-rtdb.firebaseio.com/users/${safeId}/balance.json`
        );
        const currVal = await currRes.json();
        const currentBal = Number(currVal || 0);

        if (currentBal < BUILD_COST) {
          return {
            success: false,
            error: `Insufficient balance! Current balance is ₹${currentBal.toFixed(2)}. You need at least ₹${BUILD_COST} to build this app. Please recharge your wallet.`
          };
        }

        const newBal = currentBal - BUILD_COST;
        const putRes = await fetch(
          `https://update-2224e-default-rtdb.firebaseio.com/users/${safeId}/balance.json`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBal)
          }
        );

        if (!putRes.ok) {
          return {
            success: false,
            error: 'Failed to update wallet balance in Firebase database.'
          };
        }

        // Record debit transaction in Firebase REST
        try {
          await fetch(
            `https://update-2224e-default-rtdb.firebaseio.com/users/${safeId}/transactions.json`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: BUILD_COST,
                type: 'debit',
                purpose: 'APK / AAB App Build Fee',
                app_name: appName || 'Android App',
                date: new Date().toISOString()
              })
            }
          );
        } catch {}

        setBalance(newBal);
        return { success: true, remainingBalance: newBal };
      }
    } catch (err: any) {
      console.error('Deduct build fee error:', err);
      return {
        success: false,
        error: 'Wallet deduction error: ' + (err?.message || 'Database connection error')
      };
    }
  };

  const rechargeWithRazorpay = (
    amount: number,
    onStatus: (msg: string, type: 'error' | 'success') => void
  ) => {
    if (!amount || amount < 1) {
      onStatus('Please enter an amount of ₹1 or more!', 'error');
      return;
    }

    if (!safeId || !user) {
      onStatus('Please log in first to recharge your wallet!', 'error');
      return;
    }

    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      onStatus('Razorpay payment gateway is loading. Please try in a moment.', 'error');
      return;
    }

    const isEmail = user.includes('@');
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: Math.round(amount * 100), // in paise
      currency: 'INR',
      name: 'Wallet Recharge',
      description: 'Add Balance to Wallet (App Creator)',
      prefill: {
        email: isEmail ? user : '',
        contact: !isEmail ? user : ''
      },
      handler: async (response: any) => {
        onStatus('Payment verified! Updating balance...', 'success');

        try {
          const db = getFirebaseDb();
          if (db) {
            await db.ref(`users/${safeId}/balance`).transaction((current: number | null) => {
              return (current || 0) + amount;
            });

            await db.ref(`users/${safeId}/transactions`).push({
              amount,
              payment_id: response.razorpay_payment_id,
              type: 'credit',
              date: new Date().toISOString()
            });
          } else {
            // REST update fallback
            const currRes = await fetch(`https://update-2224e-default-rtdb.firebaseio.com/users/${safeId}/balance.json`);
            const currVal = await currRes.json();
            const newBal = (Number(currVal) || 0) + amount;
            await fetch(`https://update-2224e-default-rtdb.firebaseio.com/users/${safeId}/balance.json`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newBal)
            });

            await fetch(`https://update-2224e-default-rtdb.firebaseio.com/users/${safeId}/transactions.json`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount,
                payment_id: response.razorpay_payment_id,
                type: 'credit',
                date: new Date().toISOString()
              })
            });
          }

          setBalance((prev) => prev + amount);
          onStatus(`₹${amount} added successfully!`, 'success');

          // Offer redirect after 1.5s
          setTimeout(() => {
            if (REDIRECT_URL) {
              window.location.href = REDIRECT_URL;
            }
          }, 1800);
        } catch (err: any) {
          onStatus('Failed to update balance: ' + (err?.message || 'Database error'), 'error');
        }
      },
      theme: { color: '#2563eb' }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', (response: any) => {
      onStatus('Payment Failed: ' + (response.error?.description || 'Transaction cancelled'), 'error');
    });
    rzp.open();
  };

  return (
    <WalletContext.Provider
      value={{
        user,
        safeId,
        balance,
        isLoggedIn: Boolean(user && safeId),
        isWalletModalOpen,
        openWalletModal,
        closeWalletModal,
        login,
        logout,
        rechargeWithRazorpay,
        refreshBalance,
        deductBuildFee,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
