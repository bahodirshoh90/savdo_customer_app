/**
 * Push Notification Service for Customer App
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Warn if running on web (Expo push notifications not supported)
if (Platform.OS === 'web') {
  console.warn('[NOTIFICATIONS] Push notifications are not supported on web platform.');
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions() {
  try {
    console.log('[NOTIFICATIONS] 🔔 Checking notification permissions...');
    
    // Android channel setup MUST be before permission request
    if (Platform.OS === 'android') {
      console.log('[NOTIFICATIONS] 📱 Setting up Android notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4f46e5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      console.log('[NOTIFICATIONS] ✅ Android notification channel created');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[NOTIFICATIONS] Current permission status:', existingStatus);
    
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      console.log('[NOTIFICATIONS] 📱 Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[NOTIFICATIONS] Permission request result:', finalStatus);
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[NOTIFICATIONS] ⚠️ Notification permissions NOT granted. Status:', finalStatus);
      return false;
    }
    
    console.log('[NOTIFICATIONS] ✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error requesting notification permissions:', error);
    console.error('[NOTIFICATIONS] Error details:', error.message, error.stack);
    return false;
  }
}

/**
 * Get Expo push token
 */
export async function getExpoPushToken() {
  try {
    console.log('[NOTIFICATIONS] 🚀 Starting getExpoPushToken...');
    
    // Check platform
    if (Platform.OS === 'web') {
      console.warn('[NOTIFICATIONS] ⚠️ Cannot get push token on web platform');
      return null;
    }
    
    console.log('[NOTIFICATIONS] Platform:', Platform.OS);
    
    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[NOTIFICATIONS] ⚠️ Push permission not granted');
      return null;
    }

    // ✅ Hardcoded projectId
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || '4adf9f5a-a6a0-4a18-9777-0f3444942f92';
    console.log('[NOTIFICATIONS] Using projectId:', projectId);

    // Try to get token
    console.log('[NOTIFICATIONS] 🎫 Requesting Expo push token...');
    
    const tokenData = await Notifications.getExpoPushTokenAsync({ 
      projectId: projectId 
    });
    
    if (!tokenData || !tokenData.data) {
      console.error('[NOTIFICATIONS] ❌ No token data received');
      return null;
    }
    
    console.log('[NOTIFICATIONS] ✅ Expo push token obtained successfully!');
    console.log('[NOTIFICATIONS] Token:', tokenData.data);
    
    // Save token locally for debugging
    await AsyncStorage.setItem('expo_push_token', tokenData.data);
    
    return tokenData.data;
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error in getExpoPushToken:', error);
    console.error('[NOTIFICATIONS] Error message:', error.message);
    console.error('[NOTIFICATIONS] Error stack:', error.stack);
    return null;
  }
}

/**
 * Register device token with backend
 */
export async function registerDeviceToken(token, deviceId = null, platform = null) {
  try {
    const customerId = await AsyncStorage.getItem('customer_id');
    if (!customerId) {
      console.warn('[NOTIFICATIONS] ⚠️ Cannot register token: customer not logged in');
      return false;
    }

    // Device ID olish
    let finalDeviceId = deviceId;
    if (!finalDeviceId) {
      try {
        finalDeviceId = Constants.deviceId || 
                       Constants.sessionId || 
                       Constants.installationId ||
                       `device_${Date.now()}`;
      } catch (e) {
        finalDeviceId = `device_${Date.now()}`;
      }
    }
    
    const platformName = platform || Platform.OS;
    
    console.log('[NOTIFICATIONS] 📱 Registering token with backend:');
    console.log('[NOTIFICATIONS]   - Token:', token.substring(0, 30) + '...');
    console.log('[NOTIFICATIONS]   - Customer ID:', customerId);
    console.log('[NOTIFICATIONS]   - Device ID:', finalDeviceId);
    console.log('[NOTIFICATIONS]   - Platform:', platformName);

    try {
      const response = await api.post('/notifications/register-token', {
        token,
        device_id: finalDeviceId,
        platform: platformName,
      }, {
        headers: {
          'X-Customer-ID': customerId,
        },
      });
      
      console.log('[NOTIFICATIONS] ✅ Device token registered successfully!');
      console.log('[NOTIFICATIONS] Server response:', response);
      return true;
    } catch (error) {
      console.error('[NOTIFICATIONS] ❌ Error registering device token:');
      console.error('[NOTIFICATIONS] Error response:', error?.response?.data);
      console.error('[NOTIFICATIONS] Error message:', error.message);
      console.error('[NOTIFICATIONS] Error status:', error?.response?.status);
      return false;
    }
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error in registerDeviceToken:', error);
    console.error('[NOTIFICATIONS] Error message:', error.message);
    return false;
  }
}

/**
 * Unregister device token
 */
export async function unregisterDeviceToken(token) {
  try {
    await api.delete('/notifications/unregister-token', {
      params: { token },
    });
    
    await AsyncStorage.removeItem('expo_push_token');
    console.log('[NOTIFICATIONS] ✅ Device token unregistered');
    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error unregistering device token:', error);
    return false;
  }
}

/**
 * Save notification to local storage
 */
async function saveNotificationToStorage(notification) {
  try {
    const notificationsJson = await AsyncStorage.getItem('local_notifications');
    const notifications = notificationsJson ? JSON.parse(notificationsJson) : [];
    
    const notificationData = {
      id: notification.request.identifier || Date.now().toString(),
      title: notification.request.content.title || 'Bildirishnoma',
      body: notification.request.content.body || '',
      data: notification.request.content.data || {},
      date: notification.date || new Date().toISOString(),
      read: false,
    };
    
    // Add to beginning of array (newest first)
    notifications.unshift(notificationData);
    
    // Keep only last 100 notifications
    const maxNotifications = 100;
    if (notifications.length > maxNotifications) {
      notifications.splice(maxNotifications);
    }
    
    await AsyncStorage.setItem('local_notifications', JSON.stringify(notifications));
    console.log('[NOTIFICATIONS] 💾 Notification saved to storage');
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error saving notification:', error);
  }
}

/**
 * Get all saved notifications from storage
 */
export async function getSavedNotifications() {
  try {
    const notificationsJson = await AsyncStorage.getItem('local_notifications');
    return notificationsJson ? JSON.parse(notificationsJson) : [];
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error getting saved notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const notificationsJson = await AsyncStorage.getItem('local_notifications');
    const notifications = notificationsJson ? JSON.parse(notificationsJson) : [];
    
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      await AsyncStorage.setItem('local_notifications', JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error marking notification as read:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications() {
  try {
    await AsyncStorage.removeItem('local_notifications');
    console.log('[NOTIFICATIONS] 🗑️ All notifications cleared');
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error clearing notifications:', error);
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(navigation) {
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      console.log('[NOTIFICATIONS] 📬 Notification received (foreground):', notification);
      // Save notification to local storage
      await saveNotificationToStorage(notification);
    }
  );
  
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      console.log('[NOTIFICATIONS] 👆 Notification tapped:', response);
      const notification = response.notification;
      const data = notification.request.content.data;
      
      // Save notification to local storage if not already saved
      await saveNotificationToStorage(notification);
      
      // Mark as read
      const notificationId = notification.request.identifier || Date.now().toString();
      await markNotificationAsRead(notificationId);
      
      // Navigate based on notification type
      if (data?.type === 'order_status' && data?.order_id) {
        navigation?.navigate('OrderDetail', { orderId: data.order_id });
      } else if (data?.type === 'new_product' && data?.product_id) {
        navigation?.navigate('ProductDetail', { productId: data.product_id });
      } else if (data?.type === 'price_alert' && data?.product_id) {
        navigation?.navigate('ProductDetail', { productId: data.product_id });
      } else {
        // Navigate to notifications screen
        navigation?.navigate('Notifications');
      }
    }
  );
  
  // Also listen for background notifications
  Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      console.log('[NOTIFICATIONS] 📱 Background notification tapped:', response);
      const notification = response.notification;
      await saveNotificationToStorage(notification);
      
      const notificationId = notification.request.identifier || Date.now().toString();
      await markNotificationAsRead(notificationId);
    }
  );
  
  console.log('[NOTIFICATIONS] ✅ Notification listeners setup complete');
  
  return {
    foregroundSubscription,
    responseSubscription,
  };
}

/**
 * Remove notification listeners
 */
export function removeNotificationListeners(subscriptions) {
  if (subscriptions?.foregroundSubscription) {
    Notifications.removeNotificationSubscription(subscriptions.foregroundSubscription);
  }
  if (subscriptions?.responseSubscription) {
    Notifications.removeNotificationSubscription(subscriptions.responseSubscription);
  }
  console.log('[NOTIFICATIONS] 🧹 Notification listeners removed');
}

/**
 * Initialize notifications (call on app start)
 */
export async function initializeNotifications(navigation) {
  try {
    console.log('[NOTIFICATIONS] 🚀 Initializing notifications...');
    console.log('[NOTIFICATIONS] Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      console.warn('[NOTIFICATIONS] ⚠️ Skipping initialization on web platform');
      return null;
    }

    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[NOTIFICATIONS] ⚠️ Notification permissions not granted');
      return null;
    }
    
    // Get push token
    const token = await getExpoPushToken();
    if (!token) {
      console.warn('[NOTIFICATIONS] ⚠️ Could not get Expo push token');
      return null;
    }
    
    // Check if customer is logged in before registering
    const customerId = await AsyncStorage.getItem('customer_id');
    if (customerId) {
      const registered = await registerDeviceToken(token);
      if (registered) {
        console.log('[NOTIFICATIONS] ✅ Token registered with backend');
      } else {
        console.warn('[NOTIFICATIONS] ⚠️ Failed to register token with backend');
      }
    } else {
      console.log('[NOTIFICATIONS] ℹ️ Customer not logged in, skipping token registration');
    }
    
    // Setup listeners
    const subscriptions = setupNotificationListeners(navigation);
    
    console.log('[NOTIFICATIONS] ✅ Notifications initialized successfully!');
    
    return {
      token,
      subscriptions,
    };
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error initializing notifications:', error);
    console.error('[NOTIFICATIONS] Error message:', error.message);
    console.error('[NOTIFICATIONS] Error stack:', error.stack);
    return null;
  }
}

/**
 * Test notification - for debugging
 */
export async function sendTestNotification() {
  try {
    console.log('[NOTIFICATIONS] 🧪 Sending test notification...');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification ✅",
        body: "Agar siz buni ko'rayotgan bo'lsangiz, notifications ishlayapti!",
        data: { test: true },
        sound: 'default',
      },
      trigger: { seconds: 2 },
    });
    
    console.log('[NOTIFICATIONS] ✅ Test notification scheduled');
    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error sending test notification:', error);
    return false;
  }
}

/**
 * Get stored push token from AsyncStorage
 */
export async function getStoredPushToken() {
  try {
    return await AsyncStorage.getItem('expo_push_token');
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ getStoredPushToken error:', error.message);
    return null;
  }
}

/**
 * Save WebSocket notification to local storage
 */
export async function saveWebSocketNotification({ type, title, body, data = {} }) {
  try {
    const notificationsJson = await AsyncStorage.getItem('local_notifications');
    const notifications = notificationsJson ? JSON.parse(notificationsJson) : [];

    const notificationData = {
      id: `ws_${Date.now()}`,
      title: title || 'Bildirishnoma',
      body: body || '',
      data: { type, ...data },
      date: new Date().toISOString(),
      read: false,
    };

    notifications.unshift(notificationData);
    if (notifications.length > 100) notifications.splice(100);

    await AsyncStorage.setItem('local_notifications', JSON.stringify(notifications));
    console.log('[NOTIFICATIONS] 💾 WebSocket notification saved to storage');
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ saveWebSocketNotification error:', error.message);
  }
}

/**
 * Get stored push token
 */
export async function getStoredPushToken() {
  try {
    return await AsyncStorage.getItem('expo_push_token');
  } catch {
    return null;
  }
}

/**
 * Save WebSocket notification to storage
 */
export async function saveWebSocketNotification({ type, title, body, data }) {
  try {
    const notificationsJson = await AsyncStorage.getItem('local_notifications');
    const notifications = notificationsJson ? JSON.parse(notificationsJson) : [];
    
    const notification = {
      id: Date.now().toString(),
      title,
      body,
      data: data || {},
      date: new Date().toISOString(),
      read: false,
      type,
    };
    
    notifications.unshift(notification);
    if (notifications.length > 100) notifications.splice(100);
    
    await AsyncStorage.setItem('local_notifications', JSON.stringify(notifications));
    console.log('[NOTIFICATIONS] 💾 WebSocket notification saved to storage');
  } catch (error) {
    console.error('[NOTIFICATIONS] ❌ Error saving WebSocket notification:', error);
  }
}