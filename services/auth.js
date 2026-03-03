/**
 * Authentication Service for Customer App
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from './api';
import { API_ENDPOINTS } from '../config/api';

const isWeb = Platform.OS === 'web';

let SecureStore = null;
if (!isWeb) {
  try {
    SecureStore = require('expo-secure-store').default;
  } catch (e) {
    console.warn('SecureStore not available');
  }
}

const tokenStorage = {
  getItem: async (key) => {
    if (isWeb) return localStorage.getItem(key);
    if (SecureStore) return await SecureStore.getItemAsync(key);
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (isWeb) {
      localStorage.setItem(key, value);
      return;
    }
    if (SecureStore) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    if (SecureStore) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

const normalizeUserData = (userData, customerIdOverride = null, customerNameOverride = null) => {
  const normalized = {
    customer_id: userData?.customer_id || userData?.id || customerIdOverride,
    name: userData?.name || userData?.customer_name || customerNameOverride,
    phone: userData?.phone,
    ...userData,
  };
  return normalized;
};

const REFRESH_TOKEN_KEY = 'customer_refresh_token';
const LOGIN_AT_KEY = 'customer_login_at';

export const storeAuthData = async ({ token, accessToken, refreshToken, expiresIn, user, customer_id, customer_name }) => {
  const normalizedUser = normalizeUserData(user, customer_id, customer_name);
  const normalizedCustomerId = normalizedUser?.customer_id;
  const authToken = accessToken || token;

  if (authToken) {
    await tokenStorage.setItem('customer_token', authToken);
    // Defensive: ensure token is visible (helps on web if storage was not yet committed)
    const readBack = await tokenStorage.getItem('customer_token');
    if (!readBack && authToken) {
      await tokenStorage.setItem('customer_token', authToken);
    }
    await tokenStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
    // Clear login grace flag after 5s so it doesn't linger
    setTimeout(() => tokenStorage.removeItem(LOGIN_AT_KEY), 5000);
  }
  if (refreshToken) {
    await tokenStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  if (normalizedCustomerId) {
    await AsyncStorage.setItem('customer_id', normalizedCustomerId.toString());
  }

  await AsyncStorage.setItem('customer_data', JSON.stringify(normalizedUser));
  return normalizedUser;
};

export const getRefreshToken = async () => {
  return await tokenStorage.getItem(REFRESH_TOKEN_KEY);
};

export const removeRefreshToken = async () => {
  await tokenStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const login = async (username, password, deviceId = null, deviceName = null) => {
  try {
    const payload = { username, password };
    if (deviceId) payload.device_id = deviceId;
    if (deviceName) payload.device_name = deviceName;
    const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, payload);

    console.log('[AUTH] Login response:', { 
      hasUserType: !!response.user_type, 
      userType: response.user_type,
      hasToken: !!response.token,
      hasAccessToken: !!response.accessToken 
    });

    // ONLY allow customer login - reject seller/admin logins
    if (response.user_type === 'customer') {
      const { accessToken, refreshToken, expiresIn, token, user, customer_id, customer_name } = response;
      const userData = await storeAuthData({
        accessToken: accessToken || token,
        refreshToken,
        expiresIn,
        token: token || accessToken,
        user,
        customer_id,
        customer_name,
      });

      return { 
        success: true, 
        user: userData,
        accessToken: accessToken || token,
        refreshToken,
        expiresIn,
        token: accessToken || token 
      };
    }

    // If user_type is not 'customer', it means it's a seller/admin login
    // Reject it with appropriate error message
    console.warn('[AUTH] Login attempt with non-customer account:', response.user_type || 'seller/admin');
    return { 
      success: false, 
      error: 'Bu login faqat mijozlar uchun. Siz sotuvchi yoki admin hisobidan foydalanmoqchisiz. Iltimos, mijozlar ro\'yxatida bo\'lgan login va parolni kiriting.' 
    };
  } catch (error) {
    console.error('Login error:', error);
    console.error('Login error response:', error.response?.data);
    console.error('Login error status:', error.response?.status);
    
    // Extract error message from response
    let errorMessage = 'Noto\'g\'ri login yoki parol';
    
    if (error.response?.data) {
      // Try different possible error message fields
      const data = error.response.data;
      
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data.detail) {
        errorMessage = data.detail;
      } else if (data.error) {
        errorMessage = data.error;
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.msg) {
        errorMessage = data.msg;
      }
    } else if (error.message) {
      // Check if it's a network error or other error
      if (error.message.includes('Network') || error.message.includes('timeout')) {
        errorMessage = 'Internetga ulanib bo\'lmadi. Internetni tekshiring.';
      } else {
        errorMessage = error.message;
      }
    }
    
    // Translate common error messages
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('noto\'g\'ri') || 
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('401') ||
        lowerMessage.includes('incorrect') ||
        lowerMessage.includes('wrong')) {
      errorMessage = 'Noto\'g\'ri login yoki parol';
    }
    
    console.log('Returning error message:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

export const refreshAuth = async () => {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return { success: false, error: 'No refresh token' };
    const response = await api.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken });
    const { accessToken, refreshToken: newRefresh, expiresIn } = response;
    const newAccess = accessToken || response.accessToken;
    if (newAccess) await tokenStorage.setItem('customer_token', newAccess);
    if (newRefresh) await tokenStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
    return { success: true, accessToken: newAccess, refreshToken: newRefresh, expiresIn };
  } catch (error) {
    return { success: false, error: error?.response?.data?.detail || error.message, statusCode: error?.response?.status };
  }
};

export const logout = async (callUnregisterPush = null) => {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await api.post(API_ENDPOINTS.AUTH.LOGOUT, { refreshToken });
      } catch (e) {
        console.warn('Logout API call failed:', e);
      }
    }
    if (typeof callUnregisterPush === 'function') {
      try {
        await callUnregisterPush();
      } catch (e) {
        console.warn('Unregister push on logout failed:', e);
      }
    }
    const customerId = await AsyncStorage.getItem('customer_id');
    await tokenStorage.removeItem('customer_token');
    await removeRefreshToken();
    await AsyncStorage.multiRemove(['customer_id', 'customer_data']);
    if (customerId) {
      try {
        await AsyncStorage.removeItem(`customer_cart_${customerId}`);
      } catch (cartError) {
        console.warn('Error clearing cart on logout:', cartError);
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
};

export const isLoggedIn = async () => {
  try {
    const token = await tokenStorage.getItem('customer_token');
    const customerId = await AsyncStorage.getItem('customer_id');
    return !!(token && customerId);
  } catch (error) {
    return false;
  }
};

export const getCurrentUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('customer_data');
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

export const verifyToken = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.AUTH.ME);
    return { success: true, user: response };
  } catch (error) {
    const statusCode = error.response?.status;
    return { success: false, error: error.message, statusCode };
  }
};

/**
 * Sign up (Register) a new customer
 */
export const signup = async (customerData) => {
  try {
    // Create customer with username and password
    const payload = {
      name: customerData.name,
      phone: customerData.phone,
      address: customerData.address || '',
      username: customerData.username,
      password: customerData.password,
      customer_type: 'regular', // Mijoz ilovasida yaratiladigan mijozlar oddiy mijoz bo'ladi
    };
    
    // Add referal code if provided
    if (customerData.referal_code && customerData.referal_code.trim()) {
      payload.referal_code = customerData.referal_code.trim().toUpperCase();
    }
    
    const customerResponse = await api.post(API_ENDPOINTS.CUSTOMERS.CREATE, payload);

    console.log('Customer created:', customerResponse);

    return {
      success: true,
      customer: customerResponse,
      message: 'Ro\'yxatdan o\'tdingiz!',
    };
  } catch (error) {
    console.error('Signup error:', error);
    const errorMessage = error.response?.data?.detail || error.message || 'Ro\'yxatdan o\'tishda xatolik';
    return { success: false, error: errorMessage };
  }
};
