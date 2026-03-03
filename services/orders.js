/**
 * Orders Service for Customer App
 */
import api, { apiCall } from './api';
import { API_ENDPOINTS } from '../config/api';
import API_CONFIG from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_ORDERS_KEY = 'offline_orders_queue';

const loadOfflineOrders = async () => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[OFFLINE] Error loading offline orders:', e);
    return [];
  }
};

const saveOfflineOrders = async (orders) => {
  try {
    await AsyncStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('[OFFLINE] Error saving offline orders:', e);
  }
};

export const syncOfflineOrders = async () => {
  try {
    const offlineOrders = await loadOfflineOrders();
    if (!offlineOrders.length) {
      console.log('[OFFLINE] No offline orders to sync');
      return { synced: 0 };
    }

    console.log('[OFFLINE] Syncing offline orders:', offlineOrders.length);
    const payload = offlineOrders.map((order) => ({
      ...order,
      is_offline: true,
    }));

    const response = await api.post(API_ENDPOINTS.OFFLINE.SYNC_ORDERS, payload);
    console.log('[OFFLINE] Sync response:', response);

    // Clear queue only on success
    await saveOfflineOrders([]);

    return { synced: offlineOrders.length, response };
  } catch (error) {
    console.error('[OFFLINE] Error syncing offline orders:', error);
    // Keep queue on error
    return { synced: 0, error };
  }
};

/**
 * Get customer's orders
 */
export const getOrders = async (status = null, skip = 0, limit = 100) => {
  try {
    const customerId = await AsyncStorage.getItem('customer_id');
    if (!customerId) {
      return [];
    }

    let url = `${API_ENDPOINTS.ORDERS.LIST}?customer_id=${customerId}&skip=${skip}&limit=${limit}`;
    if (status && status !== 'all' && status !== null && status !== '') {
      url += `&status=${status}`;
    }

    const response = await api.get(url);
    const orders = Array.isArray(response) ? response : (response?.orders || []);
    return orders;
  } catch (error) {
    console.error('[ORDERS] Error getting orders:', error.message);
    return [];
  }
};

/**
 * Get order by ID
 */
export const getOrder = async (orderId) => {
  try {
    const response = await api.get(API_ENDPOINTS.ORDERS.GET(orderId));
    return response;
  } catch (error) {
    console.error('Error getting order:', error);
    throw error;
  }
};

/**
 * Create order
 */
export const createOrder = async (orderData) => {
  try {
    const customerId =
      orderData.customer_id != null && orderData.customer_id !== ''
        ? String(orderData.customer_id)
        : (() => {
            const { getCurrentUser } = require('./auth');
            return getCurrentUser().then((user) =>
              user?.customer_id != null ? String(user.customer_id) : AsyncStorage.getItem('customer_id')
            );
          })();
    const resolvedCustomerId = typeof customerId === 'string' ? customerId : await customerId;
    if (!resolvedCustomerId) {
      throw new Error('Customer ID not found. Please login again.');
    }
    
    const sellerId = await AsyncStorage.getItem('default_seller_id') || '1'; // Default seller ID

    // Ensure items are properly formatted
    const items = (orderData.items || []).map(item => ({
      product_id: parseInt(item.product_id, 10),
      requested_quantity: parseInt(item.requested_quantity, 10),
    })).filter(item => item.product_id > 0 && item.requested_quantity > 0);

    if (items.length === 0) {
      throw new Error('Buyurtma uchun mahsulot topilmadi.');
    }

    const orderPayload = {
      customer_id: parseInt(resolvedCustomerId, 10),
      seller_id: parseInt(sellerId, 10),
      items: items,
      is_offline: false,
      payment_method: orderData.payment_method || 'cash', // cash, card, debt
      delivery_address: orderData.delivery_address || null,
      delivery_latitude: orderData.delivery_latitude || null,
      delivery_longitude: orderData.delivery_longitude || null,
      bonus_points_used: orderData.bonus_points_used || 0, // Bonus points used for discount
    };

    try {
      const response = await api.post(API_ENDPOINTS.ORDERS.CREATE, orderPayload);
      return response;
    } catch (apiError) {
      // If there is no response object, treat as network/offline error and queue order
      if (!apiError.response) {
        const offlineOrders = await loadOfflineOrders();
        offlineOrders.push(orderPayload);
        await saveOfflineOrders(offlineOrders);

        return {
          offline: true,
          message: "Internet yo'q. Buyurtma offline saqlandi, keyinroq yuboriladi.",
        };
      }

      // For server-side errors, rethrow
      throw apiError;
    }
  } catch (error) {
    console.error('[ORDERS] Error creating order:', error.message);
    throw error;
  }
};
