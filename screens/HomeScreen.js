/**
 * Home Screen for Customer App
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import BannerCarousel from '../components/BannerCarousel';
import api from '../services/api';
import API_CONFIG from '../config/api';
import Footer, { FooterAwareView } from '../components/Footer';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getTotalItems } = useCart();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const response = await api.get('/banners?is_active=true');
      const activeBanners = Array.isArray(response) ? response : [];
      
      if (activeBanners.length === 0) {
        setBanners([]);
        return;
      }
      
      activeBanners.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      
      const bannersWithUrls = activeBanners.map(banner => {
        let imageUrl = banner.image_url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          const baseUrl = API_CONFIG.BASE_URL.replace('/api', '').replace(/\/$/, '');
          if (!imageUrl.startsWith('/')) {
            imageUrl = '/' + imageUrl;
          }
          imageUrl = `${baseUrl}${imageUrl}`;
        }
        return { ...banner, image_url: imageUrl };
      });
      
      setBanners(bannersWithUrls);
    } catch (error) {
      console.error('Error loading banners:', error);
      setBanners([]);
    }
  };

  const handleBannerPress = (banner) => {
    if (banner.link_url) {
      const productUrlMatch = banner.link_url.match(/\/product\/(\d+)/);
      if (productUrlMatch) {
        const productId = parseInt(productUrlMatch[1], 10);
        navigation.navigate('Products', {
          screen: 'ProductDetail',
          params: { productId },
        });
        return;
      }
      
      // Check if it's an external URL
      if (banner.link_url.startsWith('http')) {
        // In web: window.open, in native: Linking.openURL
        if (typeof window !== 'undefined' && window.open) {
          window.open(banner.link_url, '_blank');
        } else {
          // For native, use Linking
          const { Linking } = require('react-native');
          Linking.openURL(banner.link_url).catch(err => {
            console.error('Failed to open URL:', err);
          });
        }
        return;
      }
      
      // If it's a relative URL starting with /product/, try to extract product ID
      if (banner.link_url.startsWith('/product/')) {
        const productId = parseInt(banner.link_url.split('/product/')[1], 10);
        if (!isNaN(productId)) {
          console.log('Navigating to product from relative URL:', productId);
          navigation.navigate('Products', {
            screen: 'ProductDetail',
            params: { productId },
          });
          return;
        }
      }
    }
  };

  return (
    <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Salom, {user?.name || 'Mijoz'}!
          </Text>
          <Text style={[styles.subtitle, { color: colors.textLight }]}>{t('welcome')}</Text>
        </View>

        {/* Advertisement Banners */}
        {banners.length > 0 && (
          <BannerCarousel 
            banners={banners} 
            onBannerPress={handleBannerPress}
            rotationInterval={banners.length > 0 ? banners[0].rotation_interval : undefined}
          />
        )}

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Products')}
          >
            <Ionicons name="cube-outline" size={32} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('products')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="cart-outline" size={32} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('cart')}</Text>
            {getTotalItems() > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={[styles.badgeText, { color: Colors.surface }]}>{getTotalItems()}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Orders')}
          >
            <Ionicons name="list-outline" size={32} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('orders')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('products')}</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.filterCard, styles.filterCardMostSold, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Products', params: { screen: 'ProductsList', params: { filter: 'most_sold' } } })}
            >
              <View style={[styles.filterIconWrap, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="trending-up" size={28} color={Colors.primary} />
              </View>
              <Text style={[styles.filterCardText, { color: colors.text }]}>{t('mostSold')}</Text>
              <Text style={[styles.filterCardHint, { color: colors.textLight }]}>{t('topProducts')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.filterCard, styles.filterCardSeason, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Products', params: { screen: 'ProductsList', params: { filter: 'season' } } })}
            >
              <View style={[styles.filterIconWrap, { backgroundColor: '#f59e0b15' }]}>
                <Ionicons name="sunny" size={28} color="#f59e0b" />
              </View>
              <Text style={[styles.filterCardText, { color: colors.text }]}>{t('seasonal')}</Text>
              <Text style={[styles.filterCardHint, { color: colors.textLight }]}>{t('seasonalHint')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.filterCard, styles.filterCardSale, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Products', params: { screen: 'ProductsList', params: { filter: 'on_sale' } } })}
            >
              <View style={[styles.filterIconWrap, { backgroundColor: Colors.danger + '15' }]}>
                <Ionicons name="pricetag" size={28} color={Colors.danger} />
              </View>
              <Text style={[styles.filterCardText, { color: colors.text }]}>{t('onSale')}</Text>
              <Text style={[styles.filterCardHint, { color: colors.textLight }]}>{t('saleHint')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Referral va Bonus bo'limi */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bonusFriends')}</Text>
          <View style={styles.bonusRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.bonusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Referal')}
            >
              <Ionicons name="people" size={28} color={Colors.primary} />
              <Text style={[styles.bonusCardText, { color: colors.text }]}>{t('referFriend')}</Text>
              <Text style={[styles.bonusCardHint, { color: colors.textLight }]}>{t('bonusHint')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.bonusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Loyalty')}
            >
              <Ionicons name="trophy" size={28} color="#f59e0b" />
              <Text style={[styles.bonusCardText, { color: colors.text }]}>{t('bonusSystem')}</Text>
              <Text style={[styles.bonusCardHint, { color: colors.textLight }]}>{t('bonusBall')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('quickAccess')}</Text>
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Products')}
          >
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.text }]}>{t('allProducts')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Footer currentScreen="home" />
    </FooterAwareView>
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
  header: {
    padding: 24,
    paddingTop: 40,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    // backgroundColor and borderColor set inline
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  filterCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  filterCardMostSold: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  filterCardSeason: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  filterCardSale: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  filterIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  filterCardText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterCardHint: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  bonusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bonusCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bonusCardText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  bonusCardHint: {
    fontSize: 11,
    marginTop: 2,
    color: Colors.textLight,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
});
