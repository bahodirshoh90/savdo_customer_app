/**
 * API Service for Customer App
 * Request: Bearer access token. On 401: refresh token, retry once or signal session expired.
 */
import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG, { API_ENDPOINTS } from '../config/api';

const isWeb = Platform.OS === 'web';
const REFRESH_TOKEN_KEY = 'customer_refresh_token';
const LOGIN_AT_KEY = 'customer_login_at';
const LOGIN_GRACE_MS = 5000;

// Platform-specific storage for tokens
let SecureStore = null;
if (!isWeb) {
  try {
    SecureStore = require('expo-secure-store').default;
  } catch (e) {
    console.warn('SecureStore not available');
  }
}

// Token storage
const tokenStorage = {
  getItem: async (key) => {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    if (SecureStore) {
      return await SecureStore.getItemAsync(key);
    }
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

let sessionExpiredCallback = null;
export const setSessionExpiredCallback = (cb) => { sessionExpiredCallback = cb; };
let refreshPromise = null;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT * 2, // Increase timeout for order creation (60 seconds)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token and customer ID
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }
      const token = await tokenStorage.getItem('customer_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      const customerId = await AsyncStorage.getItem('customer_id');
      if (customerId) {
        const customerIdInt = parseInt(customerId, 10);
        if (!isNaN(customerIdInt)) {
          config.headers['X-Customer-ID'] = customerIdInt.toString();
        }
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 try refresh once, then retry or signal session expired
const clearAuthStorage = async () => {
  try {
    await tokenStorage.removeItem('customer_token');
    await tokenStorage.removeItem(REFRESH_TOKEN_KEY);
    await tokenStorage.removeItem(LOGIN_AT_KEY);
    await AsyncStorage.multiRemove(['customer_id', 'customer_data']);
  } catch (e) {}
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const isRefresh = config?.url?.includes && config.url.includes('/auth/refresh');
    const isLogin = config?.url?.includes && config.url.includes('/auth/login');
    if (status !== 401) return Promise.reject(error);
    if (isRefresh || isLogin) {
      await clearAuthStorage();
      if (sessionExpiredCallback) sessionExpiredCallback();
      return Promise.reject(error);
    }
    if (config._retried) {
      await clearAuthStorage();
      if (sessionExpiredCallback) sessionExpiredCallback();
      return Promise.reject(error);
    }
    // Right after login, token might not be visible yet – wait a bit, then retry once with fresh token
    if (!config._retriedAfterLogin) {
      const loginAt = await tokenStorage.getItem(LOGIN_AT_KEY);
      if (loginAt) {
        const elapsed = Date.now() - Number(loginAt);
        if (elapsed < LOGIN_GRACE_MS) {
          config._retriedAfterLogin = true;
          await new Promise((r) => setTimeout(r, 150));
          const token = await tokenStorage.getItem('customer_token');
          if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
            return apiClient(config);
          }
        }
        await tokenStorage.removeItem(LOGIN_AT_KEY);
      }
    }
    const refreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      await clearAuthStorage();
      if (sessionExpiredCallback) sessionExpiredCallback();
      return Promise.reject(error);
    }
    config._retried = true;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const res = await axios.post(
            API_CONFIG.BASE_URL + API_ENDPOINTS.AUTH.REFRESH,
            { refreshToken },
            { timeout: 15000 }
          );
          const data = res.data || res;
          if (data.accessToken) await tokenStorage.setItem('customer_token', data.accessToken);
          if (data.refreshToken) await tokenStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
          return data.accessToken;
        } catch (e) {
          await clearAuthStorage();
          if (sessionExpiredCallback) sessionExpiredCallback();
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }
    const newToken = await refreshPromise;
    if (newToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(config);
    }
    return Promise.reject(error);
  }
);

/**
 * Generic API call
 */
export const apiCall = async (method, endpoint, data = null, options = {}) => {
  try {
    const requestConfig = {
      method,
      url: endpoint,
      data,
      ...options,
    };

    // For FormData, don't set Content-Type manually
    if (data instanceof FormData && options.headers) {
      const { 'Content-Type': _, ...otherHeaders } = options.headers;
      requestConfig.headers = otherHeaders;
    }

    const response = await apiClient(requestConfig);
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Export API methods
export default {
  get: (endpoint, options) => apiCall('GET', endpoint, null, options),
  post: (endpoint, data, options) => apiCall('POST', endpoint, data, options),
  put: (endpoint, data, options) => apiCall('PUT', endpoint, data, options),
  delete: (endpoint, options) => apiCall('DELETE', endpoint, null, options),
};
