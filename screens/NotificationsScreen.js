import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getSavedNotifications, markNotificationAsRead, clearAllNotifications } from '../services/notifications';
import Colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import websocketService from '../services/websocket';

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
    setSnackbar({ visible: true, message: 'Barcha bildirishnomalar o\'chirildi' });
  };

  useLayoutEffect(() => {
    const unreadCount = notifications.filter(n => !n.read).length;
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.surface,
      headerTitleStyle: { color: colors.surface, fontWeight: 'bold' },
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          {unreadCount > 0 && (
            <View style={[styles.badge, { marginRight: 8 }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity onPress={onRefresh} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="refresh" size={24} color={colors.surface} />
          </TouchableOpacity>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={24} color={colors.surface} />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, colors.primary, colors.surface, notifications.length, notifications]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  // When WebSocket receives order_status_update, AuthContext saves to storage; refresh list after a short delay so save finishes
  useEffect(() => {
    let timeoutId = null;
    const unsub = websocketService.on('order_status_update', () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(loadNotifications, 300);
    });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (snackbar.visible) {
      const timer = setTimeout(() => {
        setSnackbar({ ...snackbar, visible: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.visible]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const savedNotifications = await getSavedNotifications();
      setNotifications(savedNotifications);
    } catch (e) {
      setSnackbar({ visible: true, message: 'Bildirishnomalarni yuklashda xatolik' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read
    await markNotificationAsRead(notification.id);
    
    // Navigate based on notification data
    const data = notification.data || {};
    if (data.type === 'order_status' && data.order_id) {
      navigation.navigate('OrderDetail', { orderId: data.order_id });
    } else if (data.type === 'new_product' && data.product_id) {
      navigation.navigate('ProductDetail', { productId: data.product_id });
    } else if (data.type === 'price_alert' && data.product_id) {
      navigation.navigate('ProductDetail', { productId: data.product_id });
    }
    
    // Reload notifications to update read status
    loadNotifications();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Hozir';
    if (minutes < 60) return `${minutes} daqiqa oldin`;
    if (hours < 24) return `${hours} soat oldin`;
    if (days < 7) return `${days} kun oldin`;
    return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          style={{ backgroundColor: colors.background }}
          keyExtractor={item => item.id?.toString() || item.title}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleNotificationPress(item)}
              style={[
                styles.notificationItem,
                { backgroundColor: colors.surface },
                !item.read && { ...styles.unreadNotification, backgroundColor: (colors.primaryLight ? colors.primaryLight + '20' : '#f0f9ff'), borderLeftColor: colors.primary }
              ]}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationLeft}>
                  <Ionicons 
                    name={item.read ? "notifications-outline" : "notifications"} 
                    size={24} 
                    color={item.read ? colors.textLight : colors.primary}
                    style={styles.notificationIcon}
                  />
                </View>
                <View style={styles.notificationBody}>
                  <Text style={[styles.notificationTitle, { color: colors.textDark }, !item.read && styles.unreadTitle]}>
                    {item.title || 'Bildirishnoma'}
                  </Text>
                  <Text style={[styles.notificationDescription, { color: colors.textLight }]} numberOfLines={3}>
                    {item.body || ''}
                  </Text>
                </View>
                <View style={styles.rightContent}>
                  <Text style={[styles.dateText, { color: colors.textLight }]}>{formatDate(item.date)}</Text>
                  {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.empty, { color: colors.textLight }]}>Bildirishnomalar yo'q</Text>
              <Text style={[styles.emptySubtext, { color: colors.textLight }]}>
                Yangi bildirishnomalar shu yerda ko'rinadi
              </Text>
            </View>
          }
        />
      )}

      {snackbar.visible && (
        <View style={[styles.snackbar, { backgroundColor: colors.textDark }]}>
          <Text style={[styles.snackbarText, { color: colors.surface }]}>{snackbar.message}</Text>
          <TouchableOpacity
            onPress={() => setSnackbar({ ...snackbar, visible: false })}
            style={styles.snackbarClose}
          >
            <Ionicons name="close" size={20} color={colors.surface} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.background 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.surface,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  empty: { 
    textAlign: 'center', 
    marginTop: 32, 
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    marginTop: 8,
    color: Colors.textLight,
    fontSize: 14,
  },
  notificationItem: {
    backgroundColor: Colors.surface,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  unreadNotification: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-start',
  },
  notificationLeft: {
    marginRight: 12,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  notificationIcon: {
    // Icon styling handled inline
  },
  notificationBody: {
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  notificationDescription: {
    fontSize: 14,
    color: Colors.textLight,
    lineHeight: 20,
  },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginRight: 8,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  snackbar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  snackbarText: {
    flex: 1,
    color: Colors.surface,
    fontSize: 14,
  },
  snackbarClose: {
    marginLeft: 12,
    padding: 4,
  },
});
