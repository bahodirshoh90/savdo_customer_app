/**
 * Authentication Context for Customer App
 * Supports: access + refresh tokens, PIN unlock, session expired modal, logout with push unregister.
 */
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isLoggedIn,
  getCurrentUser,
  logout as authLogout,
  verifyToken,
  refreshAuth,
} from '../services/auth';
import { setSessionExpiredCallback } from '../services/api';
import { getStoredPushToken, unregisterDeviceToken, saveWebSocketNotification } from '../services/notifications';
import * as pinService from '../services/pin';
import websocketService from '../services/websocket';

const LAST_BACKGROUND_AT_KEY = 'customer_last_background_at';
const PIN_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 daqiqa

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  /** Bir marta login qilgandan keyin Profil tabini ochish uchun; clearJustLoggedIn() chaqirilgach tozalanadi */
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    setSessionExpiredCallback(() => setSessionExpired(true));
    return () => setSessionExpiredCallback(null);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasPin(false);
      setIsUnlocked(false);
      setShowPinSetup(false);
      return;
    }

    let appStateSubscription;

    const init = async () => {
      const exists = await pinService.hasPin();
      setHasPin(exists);
      // PIN mavjud bo'lsa, bu yerda isUnlocked holatini o'zgartirmaymiz.
      // Faqat PIN yo'q bo'lsa, birinchi marta sozlash oynasini ko'rsatamiz.
      if (!exists) {
        setShowPinSetup(true);
      } else {
        setShowPinSetup(false);
      }
    };

    init();

    const handleAppStateChange = async (nextState) => {
      try {
        if (nextState === 'background' || nextState === 'inactive') {
          // Ilova orqa foniga ketganda vaqtni eslab qolamiz
          const now = Date.now();
          await AsyncStorage.setItem(LAST_BACKGROUND_AT_KEY, String(now));
        } else if (nextState === 'active') {
          // Faqat PIN mavjud bo'lsa va foydalanuvchi uzoq vaqt (5+ daqiqa) qaytmasa, PIN so'raymiz
          if (!hasPin) {
            return;
          }
          const raw = await AsyncStorage.getItem(LAST_BACKGROUND_AT_KEY);
          const lastTs = raw ? parseInt(raw, 10) : null;
          if (lastTs && Date.now() - lastTs > PIN_LOCK_TIMEOUT_MS) {
            setIsUnlocked(false);
          }
        }
      } catch (e) {
        console.warn('[AUTH CONTEXT] AppState handler error:', e);
      }
    };

    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription?.remove();
    };
  }, [isAuthenticated, hasPin]);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        try {
          const refreshResult = await refreshAuth();
          if (refreshResult?.success && refreshResult?.accessToken) {
            const tokenResult = await verifyToken();
            if (tokenResult?.success && tokenResult?.user) {
              const normalizedUser = {
                ...tokenResult.user,
                customer_id: tokenResult.user?.customer_id || tokenResult.user?.id,
                customer_type: tokenResult.user?.customer_type || 'regular',
              };
              setUser(normalizedUser);
              setIsAuthenticated(true);
              const pinExists = await pinService.hasPin();
              setHasPin(pinExists);
              // Bu yerda faqat PIN yo'q bo'lsa, uni sozlashni so'raymiz.
              if (!pinExists) {
                setShowPinSetup(true);
              } else {
                setShowPinSetup(false);
              }
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Refresh on init error:', e);
        }
        try {
          const tokenResult = await verifyToken();
          if (tokenResult?.success && tokenResult?.user) {
            const normalizedUser = {
              ...tokenResult.user,
              customer_id: tokenResult.user?.customer_id || tokenResult.user?.id,
              customer_type: tokenResult.user?.customer_type || 'regular',
            };
            setUser(normalizedUser);
            setIsAuthenticated(true);
            const pinExists = await pinService.hasPin();
            setHasPin(pinExists);
            if (!pinExists) {
              setShowPinSetup(true);
            } else {
              setShowPinSetup(false);
            }
            setIsLoading(false);
            return;
          }
          if (tokenResult?.statusCode === 401) {
            const refreshResult = await refreshAuth();
            if (refreshResult?.success) {
              const retry = await verifyToken();
              if (retry?.success && retry?.user) {
                const normalizedUser = {
                  ...retry.user,
                  customer_id: retry.user?.customer_id || retry.user?.id,
                  customer_type: retry.user?.customer_type || 'regular',
                };
                setUser(normalizedUser);
                setIsAuthenticated(true);
                setIsLoading(false);
                return;
              }
            }
            await authLogout();
            setIsAuthenticated(false);
            setUser(null);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Token verification error:', error);
        }
        try {
          const userData = await getCurrentUser();
          if (userData) {
            const normalizedUser = {
              ...userData,
              customer_id: userData?.customer_id || userData?.id,
              customer_type: userData?.customer_type || 'regular',
            };
            setUser(normalizedUser);
            setIsAuthenticated(true);
            const pinExists = await pinService.hasPin();
            setHasPin(pinExists);
            if (!pinExists) {
              setShowPinSetup(true);
            } else {
              setShowPinSetup(false);
            }
          } else {
            setIsAuthenticated(false);
          }
        } catch (cacheError) {
          console.warn('Could not get cached user data:', cacheError);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      try {
        const userData = await getCurrentUser();
        if (userData) {
          const normalizedUser = {
            ...userData,
            customer_id: userData?.customer_id || userData?.id,
            customer_type: userData?.customer_type || 'regular',
          };
          setUser(normalizedUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (cacheError) {
        setIsAuthenticated(false);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (userData) => {
    const normalizedUser = {
      customer_id: userData?.customer_id || userData?.id,
      name: userData?.name || userData?.customer_name,
      phone: userData?.phone,
      customer_type: userData?.customer_type || 'regular',
      ...userData,
    };
    setUser(normalizedUser);
    setIsAuthenticated(true);

    // Har bir yangi login'da eski PINni tozalaymiz, shunda eski/sinxronlashmagan PIN
    // qaytadan so'ralmaydi. Foydalanuvchi har safar yangi login qilganda PINni qayta o'rnatadi.
    try {
      await pinService.clearPin();
    } catch (e) {
      console.warn('[AUTH CONTEXT] Failed to clear PIN on login:', e);
    }

    setHasPin(false);
    setIsUnlocked(true);
    setShowPinSetup(true);
    setJustLoggedIn(true);
  }, []);

  const clearJustLoggedIn = useCallback(() => {
    setJustLoggedIn(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    websocketService.connect();

    // Save order_status_update to local notifications so they appear on Notifications screen
    const unsubOrderStatus = websocketService.on('order_status_update', async (message) => {
      const data = message?.data;
      if (data?.order_id == null) return;
      const storedCustomerId = await AsyncStorage.getItem('customer_id');
      const messageCustomerId = data.customer_id != null ? String(data.customer_id) : null;
      if (messageCustomerId != null && storedCustomerId != null && messageCustomerId !== storedCustomerId) return;
      const statusName = data.status_name || data.status || 'Yangilandi';
      await saveWebSocketNotification({
        type: 'order_status',
        title: 'Buyurtma holati',
        body: `Buyurtma #${data.order_id}: ${statusName}`,
        data: { type: 'order_status', order_id: data.order_id, status: data.status, status_name: data.status_name },
      });
    });

    const unsubscribe = websocketService.on('customer_type_changed', async (message) => {
      const newType = message?.new_type || message?.data?.new_type;
      if (!newType) {
        return;
      }
      setUser((prev) => {
        if (!prev) {
          return prev;
        }
        return { ...prev, customer_type: newType };
      });
      try {
        const existing = await getCurrentUser();
        if (existing) {
          const updated = { ...existing, customer_type: newType };
          await AsyncStorage.setItem('customer_data', JSON.stringify(updated));
        }
      } catch (error) {
        console.warn('[AUTH CONTEXT] Failed to update stored customer type:', error);
      }
    });

    return () => {
      if (unsubOrderStatus) unsubOrderStatus();
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  const logout = useCallback(async () => {
    setSessionExpired(false);
    setShowPinSetup(false);
    setHasPin(false);
    setIsUnlocked(false);
    try {
      await pinService.clearPin();
      await authLogout(async () => {
        const token = await getStoredPushToken();
        if (token) await unregisterDeviceToken(token);
      });
    } catch (e) {
      console.warn('[AUTH CONTEXT] Logout error:', e);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      websocketService.disconnect();
    }
  }, []);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
    setUser(null);
    setIsAuthenticated(false);
    websocketService.disconnect();
  }, []);

  const unlock = useCallback(() => {
    setIsUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    if (hasPin) {
      setIsUnlocked(false);
    }
  }, [hasPin]);

  const finishPinSetup = useCallback(() => {
    setShowPinSetup(false);
    setHasPin(true);
    setIsUnlocked(true);
  }, []);

  const pinLockout = useCallback(async () => {
    await pinService.clearPin();
    setShowPinSetup(false);
    setHasPin(false);
    setIsUnlocked(false);
    try {
      await authLogout(async () => {
        const token = await getStoredPushToken();
        if (token) await unregisterDeviceToken(token);
      });
    } catch (e) {
      console.warn('[AUTH CONTEXT] Pin lockout logout error:', e);
    }
    setUser(null);
    setIsAuthenticated(false);
    websocketService.disconnect();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        sessionExpired,
        hasPin,
        isUnlocked,
        showPinSetup,
        dismissSessionExpired,
        login,
        logout,
        unlock,
        lock,
        finishPinSetup,
        pinLockout,
        setShowPinSetup,
        checkAuth,
        justLoggedIn,
        clearJustLoggedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
