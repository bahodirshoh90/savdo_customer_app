/**
 * Dashboard Screen - Mijoz statistikasi va hisobotlari
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import responsive from '../utils/responsive';

export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState('monthly'); // daily, monthly, yearly

  useFocusEffect(
    useCallback(() => {
      loadStatistics();
    }, [period])
  );

  const loadStatistics = async () => {
    try {
      setIsLoading(true);
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const data = await api.get(`/statistics?period=${period}`);
      setStatistics(data);
    } catch (error) {
      setStatistics(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStatistics();
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const orderStats = statistics?.orders || {};
  const totalOrders = orderStats.total_orders || 0;
  const totalOrdersAmount = orderStats.total_orders_amount || 0;
  const ordersByStatus = orderStats.orders_by_status || {};

  if (isLoading && !statistics) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
        />
      }
    >
      {/* Period Selector */}
      <View style={[styles.periodSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.periodButton, period === 'daily' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('daily')}
        >
          <Text style={[styles.periodText, period === 'daily' && { color: colors.surface }, { color: colors.text }]}>
            Kunlik
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'monthly' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('monthly')}
        >
          <Text style={[styles.periodText, period === 'monthly' && { color: colors.surface }, { color: colors.text }]}>
            Oylik
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'yearly' && { backgroundColor: colors.primary }]}
          onPress={() => setPeriod('yearly')}
        >
          <Text style={[styles.periodText, period === 'yearly' && { color: colors.surface }, { color: colors.text }]}>
            Yillik
          </Text>
        </TouchableOpacity>
      </View>

      {statistics && (
        <>
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={32} color={colors.primary} />
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {totalOrders}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textLight }]}>Jami Buyurtmalar</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="cash-outline" size={32} color={colors.success || Colors.success} />
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatMoney(totalOrdersAmount)}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textLight }]}>Jami Summa</Text>
            </View>
          </View>

          {/* Orders by Status */}
          {Object.keys(ordersByStatus).length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Buyurtmalar Holati</Text>
              {Object.entries(ordersByStatus).map(([status, count]) => (
                <View key={status} style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: colors.text }]}>
                    {status === 'pending' ? 'Kutilmoqda' :
                     status === 'processing' ? 'Jarayonda' :
                     status === 'completed' ? 'Bajarildi' :
                     status === 'cancelled' ? 'Bekor qilindi' :
                     status === 'returned' ? 'Qaytarildi' : status}
                  </Text>
                  <Text style={[styles.statusValue, { color: colors.primary }]}>{count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick Actions */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tez Amallar</Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Orders')}
            >
              <Ionicons name="list-outline" size={20} color={colors.surface} />
              <Text style={[styles.actionText, { color: colors.surface }]}>Barcha Buyurtmalar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Products')}
            >
              <Ionicons name="cube-outline" size={20} color={colors.surface} />
              <Text style={[styles.actionText, { color: colors.surface }]}>Mahsulotlar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Favorites')}
            >
              <Ionicons name="heart-outline" size={20} color={colors.surface} />
              <Text style={styles.actionText}>Sevimlilar</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {!statistics && !isLoading && (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={80} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Statistika ma'lumotlari topilmadi
          </Text>
        </View>
        )}
      </ScrollView>
      <Footer currentScreen="reports" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  periodSelector: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodText: {
    fontSize: responsive.getFontSize(14),
    fontWeight: '600',
    // color set inline
  },
  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  summaryValue: {
    fontSize: responsive.getFontSize(20),
    fontWeight: 'bold',
    marginTop: responsive.getSpacing(8),
    marginBottom: responsive.getSpacing(4),
  },
  summaryLabel: {
    fontSize: responsive.getFontSize(12),
    textAlign: 'center',
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: responsive.getFontSize(18),
    fontWeight: 'bold',
    marginBottom: responsive.getSpacing(12),
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statusLabel: {
    fontSize: responsive.getFontSize(14),
  },
  statusValue: {
    fontSize: responsive.getFontSize(16),
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  actionText: {
    // color set inline
    fontSize: responsive.getFontSize(14),
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
