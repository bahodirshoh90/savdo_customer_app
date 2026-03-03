/**
 * Products Screen for Customer App
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { getProducts, getMostSoldProducts, searchProductsByImage } from '../services/products';
import * as ImagePicker from 'expo-image-picker';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import responsive from '../utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/api';
import api from '../services/api';
import useOffline from '../hooks/useOffline';
import offlineService from '../services/offlineService';
import AnimatedView from '../components/AnimatedView';
import { getCurrentSeason } from '../utils/season';
import { useToast } from '../context/ToastContext';
import Footer, { FooterAwareView } from '../components/Footer';
import websocketService from '../services/websocket';

export default function ProductsScreen({ navigation, route }) {
  const { addToCart, cartItems, removeFromCart, updateQuantity } = useCart();
  const { isOnline, loadWithCache } = useOffline();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [products, setProducts] = useState([]);
  const [favoriteStatus, setFavoriteStatus] = useState({}); // product_id -> is_favorite
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(''); // 'name_asc', 'name_desc', 'price_asc', 'price_desc'
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [selectForPriceAlert, setSelectForPriceAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'most_sold' | 'season' | 'on_sale'
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [isImageSearchResults, setIsImageSearchResults] = useState(false);
  const PRODUCTS_PER_PAGE = 20; // Mahsulotlar bir sahifada

  // route.params.filter dan filter rejimini o'rnatish (HomeScreen tugmalaridan kelganda)
  useEffect(() => {
    const filter = route?.params?.filter;
    if (filter === 'most_sold' || filter === 'season' || filter === 'on_sale') {
      setFilterMode(filter);
    } else if (filter === 'all' || filter === undefined) {
      setFilterMode('all');
    }
  }, [route?.params?.filter]);

  const loadProducts = async (resetPage = false) => {
    const currentPage = resetPage ? 0 : page;
    const skip = currentPage * PRODUCTS_PER_PAGE;
    
    if (resetPage) {
      setIsLoading(true);
      setProducts([]);
      setPage(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      let newProducts = [];
      let fromCache = false;

      // Eng ko'p sotilgan: maxsold endpoint, sahifalash yo'q
      if (filterMode === 'most_sold') {
        const result = await getMostSoldProducts(50);
        newProducts = Array.isArray(result) ? result : [];
        setHasMore(false);
      } else {
        // Parse sort parameter for backend
        let sortParam = '';
        if (sortBy === 'name_asc') sortParam = 'name_asc';
        else if (sortBy === 'name_desc') sortParam = 'name_desc';
        else if (sortBy === 'price_asc') sortParam = 'price_low_asc';
        else if (sortBy === 'price_desc') sortParam = 'price_high_desc';
        
        const onSale = filterMode === 'on_sale';
        const season = filterMode === 'season' ? getCurrentSeason() : '';
        
        // Offline mode bilan yuklash
        const cached = await loadWithCache(
          `products_${searchQuery}_${filterBrand}_${filterCategory}_${sortParam}_${skip}_${filterMode}_${onSale}_${season}`,
          async () => {
            return await getProducts(searchQuery, skip, PRODUCTS_PER_PAGE, filterBrand, '', filterCategory, sortParam, onSale, season);
          },
          7 * 24 * 60 * 60 * 1000 // 7 days cache
        );
        newProducts = Array.isArray(cached.data) ? cached.data : [];
        fromCache = cached.fromCache;
      }
      
      if (resetPage) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }
      
      // Cache products
      if (newProducts.length > 0) {
        await offlineService.cacheProducts(newProducts);
      }
      
      // Show cache indicator
      if (fromCache && isOnline) {
        showToast('Cache\'dan yuklandi. Yangilash...', 'info');
      }
      
      // Save search history if there's a search query
      if (resetPage && searchQuery && searchQuery.trim()) {
        await saveSearchHistory(searchQuery, newProducts.length);
      }
      
      // Agar qaytgan mahsulotlar soni limitdan kam bo'lsa, boshqa sahifa yo'q
      setHasMore(newProducts.length === PRODUCTS_PER_PAGE);
      if (resetPage) {
        setPage(1); // Keyingi yuklash uchun page 1 ga o'rnatiladi
      } else {
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      
      // Try to load from cache on error
      if (resetPage) {
        const cachedProducts = await offlineService.getCachedProducts();
        if (cachedProducts && cachedProducts.length > 0) {
          setProducts(cachedProducts);
          showToast('Offline rejimda. Cache\'dan yuklandi', 'warning');
        } else {
          setProducts([]);
        }
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  };

  // Load categories and search history on mount
  useEffect(() => {
    loadCategories();
    loadSearchHistory();
  }, []);

  useEffect(() => {
    if (route?.params?.selectForPriceAlert) {
      setSelectForPriceAlert(true);
    }
    if (route?.params?.compareMode === true) {
      setCompareMode(true);
      if (route?.params?.selectedIds?.length) {
        setSelectedForCompare(route.params.selectedIds);
      }
    }
  }, [route?.params?.selectForPriceAlert, route?.params?.compareMode, route?.params?.selectedIds]);

  // Debounce search query to avoid firing API on every keystroke
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const loadSearchHistory = async () => {
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) return;

      const history = await api.get('/search-history?limit=10');
      setSearchHistory(history || []);
    } catch (error) {
      // Ignore - search history optional
    }
  };

  const saveSearchHistory = async (query, resultCount = null) => {
    if (!query || !query.trim()) return;

    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) return;

      await api.post('/search-history', {
        search_query: query.trim(),
        result_count: resultCount,
      });
      await loadSearchHistory();
    } catch (error) {
      // Ignore - search history optional
    }
  };

  const clearSearchHistory = async () => {
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) return;

      await api.delete('/search-history');
      setSearchHistory([]);
    } catch (error) {
      // Ignore - search history optional
    }
  };

  const handleHistoryItemPress = (query) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchQuery(query);
    setDebouncedSearch(query);
    setShowSearchHistory(false);
  };

  const handleSearchFocus = () => {
    setShowSearchHistory(true);
  };

  const handleSearchBlur = () => {
    setTimeout(() => {
      setShowSearchHistory(false);
    }, 200);
  };

  const handleImageSearch = async () => {
    if (!isOnline) {
      showToast('Rasm orqali qidirish uchun internet kerak', 'error');
      return;
    }
    Alert.alert(
      'Rasm orqali qidirish',
      'Rasmni qanday tanlaysiz?',
      [
        { text: 'Kamera', onPress: () => pickImage('camera') },
        { text: 'Galereya', onPress: () => pickImage('gallery') },
        { text: 'Bekor qilish', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (source) => {
    try {
      const { status } = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('Rasm uchun ruxsat kerak', 'error');
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.3 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.3 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      setImageSearchLoading(true);
      const data = await searchProductsByImage(uri, 'phash');
      const list = data.products || [];
      setProducts(list);
      setIsImageSearchResults(true);
      setHasMore(false);
      showToast(list.length ? `${list.length} ta mahsulot topildi` : 'O\'xshash mahsulot topilmadi', list.length ? 'success' : 'info');
    } catch (error) {
      showToast(error.response?.data?.detail || error.message || 'Qidiruvda xatolik', 'error');
    } finally {
      setImageSearchLoading(false);
    }
  };

  const clearImageSearchResults = () => {
    setIsImageSearchResults(false);
    setHasMore(true);
    loadProducts(true);
  };

  const loadCategories = async () => {
    try {
      try {
        const cats = await api.get('/categories');
        const names = Array.isArray(cats)
          ? cats.map(c => c.name || c).filter(n => n && n.trim() !== '').sort()
          : [];
        setCategories(names);
        return;
      } catch (e) {
        // Fallback: fetch products to extract categories
      }
      const products = await api.get('/products?limit=200');
      const uniqueCategories = [...new Set(
        (products || []).map(p => p.category).filter(cat => cat && cat.trim() !== '')
      )].sort();
      setCategories(uniqueCategories);
    } catch (error) {
      // Ignore - categories optional
    }
  };

  // Listen for customer type changes
  useEffect(() => {
    // Connect WebSocket if not connected
    websocketService.connect();
    
    const unsubscribe = websocketService.on('customer_type_changed', () => {
      loadProducts(true);
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts(true); // Reset to first page when screen focused or filters change
      loadFavoriteStatus(); // Load favorite status when screen is focused
    }, [debouncedSearch, sortBy, filterBrand, filterCategory, filterMode])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProducts(true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !isLoading && filterMode !== 'most_sold') {
      loadProducts(false);
    }
  };

  const handleProductPress = useCallback((product) => {
    if (compareMode) {
      setSelectedForCompare(prev => {
        if (prev.includes(product.id)) return prev.filter(id => id !== product.id);
        if (prev.length < 3) return [...prev, product.id];
        Alert.alert('Xatolik', 'Maksimal 3 ta mahsulotni taqqoslash mumkin');
        return prev;
      });
    } else if (selectForPriceAlert) {
      navigation.navigate('PriceAlertCreate', { product });
      setSelectForPriceAlert(false);
      if (navigation.setParams) navigation.setParams({ selectForPriceAlert: false });
    } else {
      navigation.navigate('ProductDetail', { productId: product.id, product });
    }
  }, [compareMode, selectForPriceAlert, navigation]);

  const exitPriceAlertMode = () => {
    setSelectForPriceAlert(false);
    if (navigation.setParams) {
      navigation.setParams({ selectForPriceAlert: false });
    }
  };

  const handleAddToCart = useCallback((product, quantityChange = 1) => {
    try {
      if (quantityChange > 0) {
        addToCart(product, quantityChange);
        showToast(`${quantityChange} dona savatchaga qo'shildi`, 'success');
      } else {
        const currentItem = cartItems.find(item => item.product.id === product.id);
        if (currentItem) {
          if (currentItem.quantity <= 1) {
            removeFromCart(product.id);
            showToast('Mahsulot savatchadan olib tashlandi', 'success');
          } else {
            updateQuantity(product.id, currentItem.quantity - 1);
            showToast('Miqdor kamaytirildi', 'success');
          }
        }
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      showToast('Savatchaga qo\'shishda xatolik yuz berdi', 'error');
    }
  }, [addToCart, removeFromCart, updateQuantity, cartItems, showToast]);

  const getCartQuantity = useCallback((productId) => {
    const item = cartItems.find(item => item.product.id === productId);
    return item ? item.quantity : 0;
  }, [cartItems]);

  const loadFavoriteStatus = async () => {
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) return;

      const data = await api.get('/favorites');
      const statusMap = {};
      (data.favorites || data.items || []).forEach(product => {
        statusMap[product.id || product.product_id] = true;
      });
      setFavoriteStatus(statusMap);
    } catch (error) {
      // Ignore - favorite status optional
    }
  };

  const handleToggleFavorite = useCallback(async (product) => {
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) {
        showToast('Foydalanuvchi ma\'lumotlari topilmadi', 'error');
        return;
      }
      const isFavorite = favoriteStatus[product.id] || false;
      setFavoriteStatus(prev => ({ ...prev, [product.id]: !isFavorite }));
      try {
        if (isFavorite) {
          await api.delete(`/favorites/${product.id}`);
          showToast('Sevimlilar ro\'yxatidan olib tashlandi', 'success');
        } else {
          await api.post('/favorites', { product_id: product.id });
          showToast('Sevimlilar ro\'yxatiga qo\'shildi', 'success');
        }
      } catch (apiError) {
        setFavoriteStatus(prev => ({ ...prev, [product.id]: isFavorite }));
        throw apiError;
      }
    } catch (error) {
      showToast(error.response?.data?.detail || error.message || 'Xatolik yuz berdi', 'error');
    }
  }, [favoriteStatus, showToast]);

  // Responsive number of columns
  const numColumns = responsive.isTablet() ? 3 : 2;
  const itemWidth = responsive.isTablet() ? '32%' : '48%';

  const renderProduct = ({ item }) => (
    <View style={{ flex: 1, marginHorizontal: 4, maxWidth: itemWidth }}>
      <ProductCard
        product={item}
        onPress={() => handleProductPress(item)}
        onAddToCart={(product, quantityChange = 1) => handleAddToCart(product, quantityChange)}
        onFavorite={handleToggleFavorite}
        quantity={getCartQuantity(item.id)}
        isFavorite={favoriteStatus[item.id] || false}
        onCompare={compareMode ? () => handleProductPress(item) : null}
        isInCompare={compareMode && selectedForCompare.includes(item.id)}
      />
    </View>
  );

  return (
    <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Compare Mode Header */}
      {compareMode && (
        <View style={styles.compareHeader}>
          <Text style={styles.compareHeaderText}>
            {selectedForCompare.length}/3 ta mahsulot tanlandi
          </Text>
          {selectedForCompare.length > 0 && (
            <TouchableOpacity
              style={styles.compareButton}
              onPress={() => {
                navigation.navigate('CompareProducts', { productIds: selectedForCompare });
              }}
            >
              <Text style={styles.compareButtonText}>Taqqoslash</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.cancelCompareButton}
            onPress={() => {
              setCompareMode(false);
              setSelectedForCompare([]);
            }}
          >
            <Text style={styles.cancelCompareText}>Bekor qilish</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search and Filters */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { flex: 1, color: colors.text }]}
              placeholder="Mahsulot qidirish..."
              placeholderTextColor={colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                }}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="search" size={20} color={colors.textLight} style={styles.searchIcon} />
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterButton, compareMode && styles.filterButtonActive]}
            onPress={() => {
              setCompareMode(!compareMode);
              if (compareMode) setSelectedForCompare([]);
            }}
          >
            <Ionicons name="git-compare-outline" size={24} color={compareMode ? Colors.surface : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={24} color={colors.primary} />
            {(sortBy || filterBrand || filterCategory) && (
              <View style={styles.filterBadge} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, imageSearchLoading && { opacity: 0.6 }]}
            onPress={handleImageSearch}
            disabled={imageSearchLoading}
          >
            {imageSearchLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Search History Dropdown */}
        {showSearchHistory && searchHistory.length > 0 && !searchQuery && (
          <View style={[styles.searchHistoryContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.searchHistoryHeader}>
                <Text style={[styles.searchHistoryTitle, { color: colors.text }]}>So'nggi qidiruvlar</Text>
              <TouchableOpacity onPress={clearSearchHistory}>
                <Text style={[styles.clearHistoryText, { color: colors.primary }]}>Tozalash</Text>
              </TouchableOpacity>
            </View>
            {searchHistory.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.historyItem}
                onPress={() => handleHistoryItemPress(item.search_query)}
              >
                <Ionicons name="time-outline" size={18} color={colors.textLight} />
                <Text style={[styles.historyText, { color: colors.text }]}>{item.search_query}</Text>
                {item.result_count != null ? (
                  <Text style={styles.historyCount}>{item.result_count} ta</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Rasm orqali qidirish natijasi chip */}
      {isImageSearchResults && (
        <View style={[styles.filterChipContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.filterChipText, { color: colors.text }]}>Rasm bo'yicha natija</Text>
          <TouchableOpacity
            onPress={clearImageSearchResults}
            style={[styles.filterChipClear, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="close" size={18} color={Colors.surface} />
            <Text style={styles.filterChipClearText}>Barcha mahsulotlar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter mode chip - Home dan kelgan filtrlarni ko'rsatish */}
      {filterMode !== 'all' && !isImageSearchResults && (
        <View style={[styles.filterChipContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.filterChipText, { color: colors.text }]}>
            {filterMode === 'most_sold'
              ? "Eng ko'p sotilgan"
              : filterMode === 'season'
              ? `Mavsumiy (${getCurrentSeason()})`
              : filterMode === 'on_sale'
              ? 'Aksiyadagi mahsulotlar'
              : ''}
          </Text>
          <TouchableOpacity
            onPress={() => setFilterMode('all')}
            style={[styles.filterChipClear, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="close" size={18} color={Colors.surface} />
            <Text style={styles.filterChipClearText}>Barchasi</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectForPriceAlert && (
        <View style={styles.priceAlertBanner}>
          <View style={styles.priceAlertInfo}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <Text style={styles.priceAlertText}>
              Narx eslatmasi uchun mahsulot tanlang
            </Text>
          </View>
          <TouchableOpacity onPress={exitPriceAlertMode} style={styles.priceAlertCancel}>
            <Text style={styles.priceAlertCancelText}>Bekor qilish</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={(item, index) => `${item.id ?? index}-${index}`}
            contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.row : null}
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.loadingMoreText}>Yuklanmoqda...</Text>
                </View>
              ) : !hasMore && products.length > 0 ? (
                <View style={styles.endContainer}>
                  <Text style={styles.endText}>Barcha mahsulotlar ko'rsatildi</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Mahsulot topilmadi' : filterMode !== 'all' ? 'Bu bo\'limda mahsulot topilmadi' : 'Mahsulotlar topilmadi'}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrlar va Tartiblash</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={Colors.textDark} />
              </TouchableOpacity>
            </View>

            {/* Sort */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Tartiblash</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={sortBy}
                  onValueChange={(value) => setSortBy(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Tartibsiz" value="" />
                  <Picker.Item label="Nomi (A-Z)" value="name_asc" />
                  <Picker.Item label="Nomi (Z-A)" value="name_desc" />
                  <Picker.Item label="Narx (Pastdan Yuqori)" value="price_asc" />
                  <Picker.Item label="Narx (Yuqoridan Past)" value="price_desc" />
                </Picker>
              </View>
            </View>

            {/* Category Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Kategoriya</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={filterCategory}
                  onValueChange={(value) => setFilterCategory(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Barcha kategoriyalar" value="" />
                  {categories.map((category) => (
                    <Picker.Item key={category} label={category} value={category} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Brand Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Brend</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Brend nomi..."
                value={filterBrand}
                onChangeText={setFilterBrand}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.clearButton]}
                onPress={() => {
                  setSortBy('');
                  setFilterBrand('');
                  setFilterCategory('');
                  setShowFilters(false);
                }}
              >
                <Text style={styles.clearButtonText}>Tozalash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Qo'llash</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Footer currentScreen="products" />
    </FooterAwareView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    padding: responsive.getSpacing(16),
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  searchIcon: {
    marginLeft: 8,
  },
  clearSearchButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchHistoryContainer: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 200,
    overflow: 'hidden',
  },
  searchHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  clearHistoryText: {
    fontSize: 12,
    color: Colors.primary,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  historyText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  historyCount: {
    fontSize: 12,
    color: Colors.textLight,
  },
  compareBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
  },
  compareBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.surface,
  },
  compareBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  clearCompareButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  clearCompareText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
  viewCompareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  viewCompareText: {
    marginLeft: 4,
    fontSize: 12,
    color: Colors.surface,
    fontWeight: '600',
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.borderLight,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  picker: {
    height: 50,
    color: Colors.textDark,
  },
  filterInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
  },
  applyButton: {
    backgroundColor: Colors.primary,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  listContent: {
    padding: 8,
  },
  row: {
    justifyContent: 'flex-start',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  loadingMoreContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.textLight,
  },
  endContainer: {
    padding: 20,
    alignItems: 'center',
  },
  endText: {
    fontSize: 14,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.primary + '20',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  compareHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  compareButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  compareButtonText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelCompareButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelCompareText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  filterChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsive.getSpacing(16),
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterChipClear: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  filterChipClearText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },
  priceAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsive.getSpacing(16),
    paddingVertical: 10,
    backgroundColor: Colors.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceAlertInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  priceAlertText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  priceAlertCancel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceAlertCancelText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
