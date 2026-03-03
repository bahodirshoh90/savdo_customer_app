/**
 * Order Detail Screen for Customer App
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { getOrder } from '../services/orders';
import OrderTrackingStepper from '../components/OrderTrackingStepper';
import websocketService from '../services/websocket';
import Footer, { FooterAwareView } from '../components/Footer';

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return Colors.success;
    case 'processing': return Colors.primary;
    case 'pending': return Colors.warning;
    case 'cancelled': return Colors.danger;
    default: return Colors.textLight;
  }
};

const getStatusLabel = (status) => {
  const labels = {
    pending: 'Kutilmoqda',
    processing: 'Jarayonda',
    completed: 'Bajarildi',
    cancelled: 'Bekor qilindi',
  };
  return labels[status] || status;
};

export default function OrderDetailScreen({ route }) {
  const { orderId } = route.params;
  const { colors } = useTheme();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrder();
    
    // Subscribe to order status updates via WebSocket
    const handleStatusUpdate = (data) => {
      if (data.order_id === orderId) {
        setOrder(prev => prev ? { ...prev, status: data.status } : null);
      }
    };

    websocketService.on('order_status_update', handleStatusUpdate);

    return () => {
      websocketService.off('order_status_update', handleStatusUpdate);
    };
  }, [orderId]);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const result = await getOrder(orderId);
      setOrder(result);
    } catch (error) {
      console.error('Error loading order:', error);
      Alert.alert('Xatolik', 'Buyurtma ma\'lumotlarini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <FooterAwareView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary || Colors.primary} />
        <Footer currentScreen="orders" />
      </FooterAwareView>
    );
  }

  if (!order) {
    return (
      <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textLight }]}>Buyurtma topilmadi</Text>
        <Footer currentScreen="orders" />
      </FooterAwareView>
    );
  }

  const statusColor = getStatusColor(order.status);
  const statusLabel = getStatusLabel(order.status);
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  // Calculate estimated delivery (3 days from order date for processing orders)
  const estimatedDelivery = order.status === 'processing' && order.created_at
    ? new Date(new Date(order.created_at).getTime() + 3 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Order Tracking Stepper */}
      <OrderTrackingStepper
        currentStatus={order.status}
        orderDate={order.created_at}
        estimatedDelivery={estimatedDelivery}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.orderId, { color: colors.textDark }]}>Buyurtma #{order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textLight }]}>Sana:</Text>
          <Text style={[styles.infoValue, { color: colors.textDark }]}>{orderDate}</Text>
        </View>
        {order.customer_name && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textLight }]}>Mijoz:</Text>
            <Text style={[styles.infoValue, { color: colors.textDark }]}>{order.customer_name}</Text>
          </View>
        )}
      </View>

      {/* Items */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Mahsulotlar:</Text>
        {order.items?.map((item, index) => {
          const unitPrice = item.piece_price ?? item.unit_price ?? (item.subtotal && item.requested_quantity ? item.subtotal / item.requested_quantity : 0);
          return (
            <View key={index} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <View style={styles.itemLeft}>
                <Text style={[styles.itemName, { color: colors.textDark }]}>{item.product_name || 'Noma\'lum'}</Text>
                <Text style={[styles.itemDetails, { color: colors.textLight }]}>
                  {item.requested_quantity} x {(unitPrice || 0).toLocaleString('uz-UZ')} so'm
                </Text>
              </View>
              <Text style={[styles.itemTotal, { color: colors.textDark }]}>
                {item.subtotal?.toLocaleString('uz-UZ') || '0'} so'm
              </Text>
            </View>
          );
        })}
      </View>

      {/* Total */}
      <View style={[styles.totalSection, { backgroundColor: colors.surface, borderTopColor: colors.primary }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textDark }]}>Jami:</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>
            {order.total_amount?.toLocaleString('uz-UZ') || '0'} so'm
          </Text>
        </View>
      </View>
      </ScrollView>
      <Footer currentScreen="orders" />
    </FooterAwareView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.surface,
    padding: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textDark,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: Colors.textLight,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
  },
  totalSection: {
    backgroundColor: Colors.surface,
    padding: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textDark,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
});
