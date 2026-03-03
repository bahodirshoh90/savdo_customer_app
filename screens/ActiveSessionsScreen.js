/**
 * Active Sessions Screen - list devices/sessions and option to close all
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/api';
import Footer, { FooterAwareView } from '../components/Footer';
import { Ionicons } from '@expo/vector-icons';

export default function ActiveSessionsScreen({ navigation }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingAll, setClosingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.AUTH.SESSIONS);
      const list = res?.sessions || res || [];
      setSessions(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Load sessions error:', e);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSessions();
    }, [loadSessions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const closeAllSessions = () => {
    Alert.alert(
      t('closeAllSessions') || 'Barcha sessiyalarni yopish',
      'Barcha qurilmalardan chiqiladi. Davom etasizmi?',
      [
        { text: t('cancel') || 'Bekor qilish', style: 'cancel' },
        {
          text: t('confirm') || 'Tasdiqlash',
          onPress: async () => {
            setClosingAll(true);
            try {
              await api.post(API_ENDPOINTS.AUTH.LOGOUT_ALL);
              await logout();
              navigation.reset?.({ index: 0, routes: [{ name: 'Login' }] });
            } catch (e) {
              console.warn('Logout all error:', e);
            } finally {
              setClosingAll(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString();
  };

  return (
    <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {sessions.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textLight }]}>
                {t('activeSessions')}: yo‘q
              </Text>
            ) : (
              sessions.map((s) => (
                <View
                  key={s.session_id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.row}>
                    <Ionicons
                      name={s.is_current ? 'phone-portrait' : 'phone-portrait-outline'}
                      size={24}
                      color={colors.primary}
                    />
                    <View style={styles.cardBody}>
                      <Text style={[styles.deviceName, { color: colors.text }]}>
                        {s.device_name || s.device_id || t('device')} {s.is_current ? `(${t('currentDevice')})` : ''}
                      </Text>
                      {s.last_active && (
                        <Text style={[styles.meta, { color: colors.textLight }]}>
                          {t('lastActive')}: {formatDate(s.last_active)}
                        </Text>
                      )}
                      {s.ip_address && (
                        <Text style={[styles.meta, { color: colors.textLight }]}>
                          IP: {s.ip_address}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
            {sessions.length > 1 && (
              <TouchableOpacity
                style={[styles.closeAllBtn, { backgroundColor: colors.error || '#dc3545' }]}
                onPress={closeAllSessions}
                disabled={closingAll}
              >
                {closingAll ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.closeAllText}>{t('closeAllSessions')}</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
      <Footer />
    </FooterAwareView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  closeAllBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
