/**
 * Order Tracking Stepper Component
 * Shows order status progression with visual stepper
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

const ORDER_STATUSES = [
  { key: 'pending', label: 'Kutilmoqda', icon: 'time-outline' },
  { key: 'processing', label: 'Jarayonda', icon: 'cog-outline' },
  { key: 'completed', label: 'Bajarildi', icon: 'checkmark-circle-outline' },
  { key: 'cancelled', label: 'Bekor qilindi', icon: 'close-circle-outline' },
  { key: 'returned', label: 'Qaytarildi', icon: 'return-down-back-outline' },
];

export default function OrderTrackingStepper({ currentStatus, orderDate, estimatedDelivery }) {
  const { colors } = useTheme();
  const getStatusIndex = (status) => {
    return ORDER_STATUSES.findIndex(s => s.key === status);
  };

  const currentIndex = getStatusIndex(currentStatus);
  const isCompleted = currentStatus === 'completed';
  const isCancelled = currentStatus === 'cancelled';
  const isReturned = currentStatus === 'returned';

  // Filter statuses based on current status
  let displayStatuses = ORDER_STATUSES;
  if (isCancelled || isReturned) {
    // Show only up to current status for cancelled/returned
    displayStatuses = ORDER_STATUSES.slice(0, currentIndex + 1);
  } else {
    // Show all statuses up to completed
    displayStatuses = ORDER_STATUSES.filter(s => 
      s.key !== 'cancelled' && s.key !== 'returned'
    );
  }

  const getStatusColor = (index) => {
    if (isCancelled || isReturned) {
      return index <= currentIndex ? Colors.danger : Colors.border;
    }
    if (isCompleted) {
      return Colors.success;
    }
    return index <= currentIndex ? Colors.primary : Colors.border;
  };

  const getStatusIcon = (status, index) => {
    const isActive = index <= currentIndex;
    
    if (status.key === 'completed' && isActive) {
      return 'checkmark-circle';
    }
    if (status.key === 'cancelled' && isActive) {
      return 'close-circle';
    }
    if (status.key === 'returned' && isActive) {
      return 'return-down-back';
    }
    if (isActive) {
      return status.icon.replace('-outline', '');
    }
    return status.icon;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Buyurtma Holati</Text>
        {orderDate && (
          <Text style={[styles.date, { color: colors.textLight }]}>
            {new Date(orderDate).toLocaleDateString('uz-UZ', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        )}
      </View>

      <View style={styles.stepper}>
        {displayStatuses.map((status, index) => {
          const isActive = index <= currentIndex;
          const isLast = index === displayStatuses.length - 1;
          const statusColor = getStatusColor(index);
          const iconName = getStatusIcon(status, index);

          return (
            <View key={status.key} style={styles.stepContainer}>
              <View style={styles.step}>
                {/* Connector Line */}
                {!isLast && (
                  <View
                    style={[
                      styles.connector,
                      { backgroundColor: index < currentIndex ? statusColor : colors.border }
                    ]}
                  />
                )}

                {/* Step Circle */}
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor: isActive ? statusColor : colors.surface,
                      borderColor: statusColor,
                    }
                  ]}
                >
                  <Ionicons
                    name={iconName}
                    size={24}
                    color={isActive ? colors.surface : colors.textLight}
                  />
                </View>

                {/* Step Label */}
                <Text
                  style={[
                    styles.stepLabel,
                    { color: isActive ? colors.text : colors.textLight }
                  ]}
                >
                  {status.label}
                </Text>

                {/* Current Status Indicator */}
                {index === currentIndex && (
                  <View style={[styles.currentIndicator, { backgroundColor: (colors.primaryLight || Colors.primaryLight) }]}>
                    <Text style={[styles.currentText, { color: colors.primary }]}>Joriy</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Estimated Delivery */}
      {estimatedDelivery && currentStatus === 'processing' && (
        <View style={[styles.deliveryInfo, { backgroundColor: (colors.primaryLight || Colors.primaryLight) }]}>
          <Ionicons name="time" size={18} color={colors.primary} />
          <Text style={[styles.deliveryText, { color: colors.text }]}>
            Taxminiy yetkazish: {new Date(estimatedDelivery).toLocaleDateString('uz-UZ')}
          </Text>
        </View>
      )}

      {/* Status Message */}
      <View style={[styles.statusMessage, { backgroundColor: colors.background }]}>
        <Text style={[styles.statusMessageText, { color: colors.text }]}>
          {currentStatus === 'pending' && 'Buyurtmangiz qabul qilindi va tekshirilmoqda.'}
          {currentStatus === 'processing' && 'Buyurtmangiz tayyorlanmoqda va tez orada yetkaziladi.'}
          {currentStatus === 'completed' && 'Buyurtmangiz muvaffaqiyatli bajarildi!'}
          {currentStatus === 'cancelled' && 'Buyurtmangiz bekor qilindi.'}
          {currentStatus === 'returned' && 'Buyurtmangiz qaytarildi.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: Colors.textLight,
  },
  stepper: {
    position: 'relative',
  },
  stepContainer: {
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  connector: {
    position: 'absolute',
    left: 12,
    top: 24,
    width: 2,
    height: 40,
    zIndex: 0,
  },
  stepCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepLabel: {
    flex: 1,
    marginLeft: 12,
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  currentIndicator: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 4,
  },
  currentText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
  },
  deliveryText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  statusMessage: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  statusMessageText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
});
