/**
 * Product Detail Screen for Customer App
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Colors from '../constants/colors';
import { getProduct } from '../services/products';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import API_CONFIG from '../config/api';
import { getProductPrice, getProductDiscountPercent, getProductBasePrice } from '../utils/pricing';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import StarRating from '../components/StarRating';
import { TextInput, Modal, Share as RNShare } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useToast } from '../context/ToastContext';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import websocketService from '../services/websocket';

export default function ProductDetailScreen({ route, navigation }) {
  const { productId, product: routeProduct } = route.params || {};
  const { addToCart, cartItems } = useCart();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [product, setProduct] = useState(routeProduct || null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [productImages, setProductImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  // Get current cart quantity for this product
  const currentProductId = productId || (product?.id) || (routeProduct?.id);
  
  const getCartQuantity = () => {
    if (!currentProductId) return 0;
    const item = cartItems.find(item => item.product.id === currentProductId);
    return item ? item.quantity : 0;
  };
  
  // Always get fresh cart quantity from context
  const cartQuantity = getCartQuantity();
  const { user } = useAuth();

  // Listen for customer type changes to reload product with updated prices
  useEffect(() => {
    websocketService.connect();
    
    const unsubscribe = websocketService.on('customer_type_changed', async () => {
      if (currentProductId) {
        await loadProduct();
      }
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentProductId]);

  useEffect(() => {
    if (currentProductId) {
      // If product is passed via route params, use it immediately
      if (routeProduct && routeProduct.id && routeProduct.id === currentProductId) {
        setIsLoading(false);
        setProduct(routeProduct);
        checkFavoriteStatus();
        loadReviews(routeProduct.id);
        loadRatingSummary(routeProduct.id);
        loadProductImages();
      } else if (product && product.id === currentProductId) {
        setIsLoading(false);
        checkFavoriteStatus();
        loadReviews();
        loadRatingSummary();
        loadProductImages();
      } else {
        loadProduct();
      }
    } else {
      setIsLoading(false);
    }
  }, [currentProductId, routeProduct]);

  const checkFavoriteStatus = async () => {
    const currentProduct = product || routeProduct;
    if (!currentProduct || !currentProduct.id) return;
    
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) return;

      const data = await api.get(`/favorites/check/${currentProduct.id}`);
      setIsFavorite(data.is_favorite || false);
    } catch (error) {
      if (error.response?.status !== 404) {
        // Ignore 404 - endpoint might not exist
      }
    }
  };

  const toggleFavorite = async () => {
    const currentProduct = product || routeProduct;
    if (!currentProduct) return;

    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) {
        Alert.alert('Xatolik', 'Foydalanuvchi ma\'lumotlari topilmadi. Iltimos, qayta kirib tering.');
        return;
      }

      if (isFavorite) {
        await api.delete(`/favorites/${currentProduct.id}`);
        setIsFavorite(false);
        showToast('Sevimlilar ro\'yxatidan olib tashlandi', 'success');
      } else {
        const responseData = await api.post('/favorites', { product_id: currentProduct.id });
        setIsFavorite(true);
        showToast(responseData.message || 'Sevimlilar ro\'yxatiga qo\'shildi', 'success');
      }
    } catch (error) {
      if (error.response?.status === 404 && isFavorite) {
        setIsFavorite(false);
        showToast('Sevimlilar ro\'yxatidan olib tashlandi', 'success');
      } else {
        showToast(error.response?.data?.detail || error.message || 'Xatolik yuz berdi', 'error');
      }
    }
  };

  const loadProduct = async () => {
    const targetProductId = currentProductId;
    if (!targetProductId) {
      setIsLoading(false);
      Alert.alert('Xatolik', 'Mahsulot ID topilmadi');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await getProduct(targetProductId);
      
      if (result && result.id) {
        setProduct(result);
        await Promise.all([
          loadReviews(result.id),
          loadRatingSummary(result.id),
          loadProductImages()
        ]);
        checkFavoriteStatus();
      } else {
        throw new Error('Mahsulot topilmadi');
      }
    } catch (error) {
      console.error('[ProductDetail] Error loading product:', error);
      console.error('[ProductDetail] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      Alert.alert('Xatolik', error.message || 'Mahsulot ma\'lumotlarini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReviews = async (productIdToLoad = null) => {
    const targetProductId = productIdToLoad || currentProductId;
    if (!targetProductId) return;

    try {
      const data = await api.get(`/products/${targetProductId}/reviews?limit=20&sort_by=created_at&sort_order=desc`);
      setReviews(data || []);
    } catch (error) {
      setReviews([]);
    }
  };

  const loadProductImages = async () => {
    if (!currentProductId) return;
    
    try {
      const images = await api.get(`/products/${currentProductId}/images`);
      setProductImages(images || []);
    } catch (error) {
      if (product?.image_url) {
        setProductImages([{ image_url: product.image_url, is_primary: true }]);
      }
    }
  };

  const loadRatingSummary = async (productIdToLoad = null) => {
    const targetProductId = productIdToLoad || currentProductId;
    if (!targetProductId) return;

    try {
      const data = await api.get(`/products/${targetProductId}/rating-summary`);
      setRatingSummary(data);
    } catch (error) {
      setRatingSummary(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!currentProductId) {
      Alert.alert('Xatolik', 'Mahsulot topilmadi');
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      Alert.alert('Xatolik', 'Iltimos, 1 dan 5 gacha baholash tanlang');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      if (!customerId) {
        Alert.alert('Xatolik', 'Foydalanuvchi ma\'lumotlari topilmadi. Iltimos, tizimga kiring.');
        setIsSubmittingReview(false);
        return;
      }

      await api.post(`/products/${currentProductId}/reviews`, {
        product_id: currentProductId,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });

      Alert.alert('Muvaffaqiyatli', 'Baholashingiz qabul qilindi');
      setReviewRating(5);
      setReviewComment('');
      setShowReviewForm(false);
      await Promise.all([
        loadReviews(),
        loadRatingSummary()
      ]);
    } catch (error) {
      Alert.alert('Xatolik', error.response?.data?.detail || 'Baholash yozishda xatolik');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = () => {
    const currentProduct = product || routeProduct;
    if (!currentProduct) {
      Alert.alert('Xatolik', 'Mahsulot ma\'lumotlari topilmadi');
      return;
    }
    
    const isOutOfStock = currentProduct.total_pieces !== undefined && currentProduct.total_pieces !== null && currentProduct.total_pieces <= 0;
    if (isOutOfStock) {
      Alert.alert('Xatolik', 'Bu mahsulot omborda yo\'q');
      return;
    }

    try {
      addToCart(currentProduct, quantity);
      showToast(`${quantity} dona savatchaga qo'shildi`, 'success');
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Xatolik', 'Savatchaga qo\'shishda xatolik yuz berdi');
    }
  };

  const getImageUrl = () => {
    if (!product?.image_url) return null;
    if (product.image_url.startsWith('http')) {
      return product.image_url.replace('http://', 'https://');
    }
    let baseUrl = API_CONFIG.BASE_URL;
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.replace('/api', '');
    }
    const imagePath = product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`;
    return `${baseUrl}${imagePath}`.replace('http://', 'https://');
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.text }]}>Mahsulot topilmadi</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.surface }]}>Orqaga qaytish</Text>
          </TouchableOpacity>
        </View>
        <Footer currentScreen="products" />
      </View>
    );
  }

  const imageUrl = getImageUrl();
  const price = getProductPrice(product, user?.customer_type);
  const discountPercent = getProductDiscountPercent(product, user?.customer_type);
  const basePrice = discountPercent > 0 ? getProductBasePrice(product, user?.customer_type) : price;
  const currentProductForActions = product || routeProduct;
  const isOutOfStock = product.total_pieces !== undefined && product.total_pieces !== null && product.total_pieces <= 0;

  // Get all images (product.image_url + productImages)
  const allImages = [];
  if (imageUrl) {
    allImages.push({ id: 'main', image_url: imageUrl, is_primary: true });
  }
  productImages.forEach(img => {
    const imgUrl = img.image_url.startsWith('http') 
      ? img.image_url.replace('http://', 'https://')
      : (() => {
          let baseUrl = API_CONFIG.BASE_URL;
          if (baseUrl.endsWith('/api')) {
            baseUrl = baseUrl.replace('/api', '');
          }
          const imagePath = img.image_url.startsWith('/') ? img.image_url : `/${img.image_url}`;
          return `${baseUrl}${imagePath}`.replace('http://', 'https://');
        })();
    allImages.push({ ...img, image_url: imgUrl });
  });

  const currentImage = allImages[selectedImageIndex] || allImages[0];
  const currentImageUrl = currentImage?.image_url || imageUrl;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.imageContainer}>
        {currentImageUrl ? (
          <Image
            source={{ uri: currentImageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>📦</Text>
          </View>
        )}
        
        {/* Image Gallery Indicator */}
        {allImages.length > 1 && (
          <View style={styles.imageGalleryIndicator}>
            {allImages.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.imageDot,
                  index === selectedImageIndex && styles.imageDotActive
                ]}
                onPress={() => setSelectedImageIndex(index)}
              />
            ))}
          </View>
        )}
        
        {/* Image Navigation */}
        {allImages.length > 1 && (
          <>
            {selectedImageIndex > 0 && (
              <TouchableOpacity
                style={styles.imageNavButton}
                onPress={() => setSelectedImageIndex(selectedImageIndex - 1)}
              >
                <Ionicons name="chevron-back" size={24} color={colors.surface} />
              </TouchableOpacity>
            )}
            {selectedImageIndex < allImages.length - 1 && (
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavButtonRight]}
                onPress={() => setSelectedImageIndex(selectedImageIndex + 1)}
              >
                <Ionicons name="chevron-forward" size={24} color={colors.surface} />
              </TouchableOpacity>
            )}
          </>
        )}
        
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={toggleFavorite}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? '#ff3b30' : colors.surface}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.content, { backgroundColor: colors.surface }]}>
        <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>

        {/* Rating Summary */}
        {ratingSummary && ratingSummary.total_reviews > 0 && (
          <View style={styles.ratingContainer}>
            <StarRating 
              rating={ratingSummary.average_rating} 
              size={18}
              showValue={true}
            />
            <Text style={[styles.reviewCount, { color: colors.textLight }]}>
              ({ratingSummary.total_reviews} baholash)
            </Text>
          </View>
        )}

        {product.barcode && (
          <Text style={[styles.barcode, { color: colors.textLight }]}>Barcode: {product.barcode}</Text>
        )}

        {discountPercent > 0 && (
          <View style={styles.priceRow}>
            <Text style={[styles.oldPrice, { color: colors.textLight }]}>
              {basePrice.toLocaleString('uz-UZ')} so'm
            </Text>
            <View style={[styles.discountBadge, { backgroundColor: Colors.danger }]}>
              <Text style={styles.discountBadgeText}>-{Math.round(discountPercent)}%</Text>
            </View>
          </View>
        )}
        <Text style={[styles.price, { color: colors.primary }]}>
          {price.toLocaleString('uz-UZ')} so'm
        </Text>

        {product.total_pieces !== undefined && product.total_pieces !== null && (
          <Text style={[styles.stockInfo, isOutOfStock && styles.stockInfoOutOfStock]}>
            {isOutOfStock ? 'Omborda yo\'q' : `Omborda: ${product.total_pieces} dona`}
          </Text>
        )}

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => {
              if (!currentProductForActions) {
                Alert.alert('Xatolik', 'Mahsulot topilmadi');
                return;
              }
              navigation.navigate('PriceAlertCreate', { product: currentProductForActions });
            }}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.surface} />
            <Text style={styles.alertButtonText}>Narx eslatmasi</Text>
          </TouchableOpacity>
        </View>

        {/* Add to Cart Button with Quantity Controls */}
        {cartQuantity > 0 ? (
          <View style={styles.cartControlsContainer}>
            <TouchableOpacity
              style={[styles.quantityButton, cartQuantity <= 1 && styles.quantityButtonDisabled]}
              onPress={() => {
                if (cartQuantity <= 1) return;
                const currentProduct = product || routeProduct;
                if (currentProduct) {
                  addToCart(currentProduct, -1);
                }
              }}
              disabled={cartQuantity <= 1}
            >
              <Text style={[styles.quantityButtonText, cartQuantity <= 1 && styles.quantityButtonTextDisabled]}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, styles.addButtonWithQuantity]}
              disabled={isOutOfStock}
            >
              <Text style={styles.addButtonText}>
                Savatchada: {cartQuantity} dona
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quantityButton, isOutOfStock && styles.quantityButtonDisabled]}
              onPress={() => {
                const currentProduct = product || routeProduct;
                if (currentProduct) {
                  const isOutOfStock = currentProduct.total_pieces !== undefined && currentProduct.total_pieces !== null && currentProduct.total_pieces <= cartQuantity;
                  if (isOutOfStock) {
                    Alert.alert('Xatolik', 'Omborda yetarli mahsulot yo\'q');
                    return;
                  }
                  addToCart(currentProduct, 1);
                }
              }}
              disabled={isOutOfStock}
            >
              <Text style={[styles.quantityButtonText, isOutOfStock && styles.quantityButtonTextDisabled]}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addButton, isOutOfStock && styles.addButtonDisabled]}
            onPress={handleAddToCart}
            disabled={isOutOfStock}
          >
            <Text style={[styles.addButtonText, isOutOfStock && styles.addButtonTextDisabled]}>
              {isOutOfStock ? 'Omborda yo\'q' : 'Savatchaga qo\'shish'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reviews Section */}
      <View style={[styles.reviewsSection, { backgroundColor: colors.surface }]}>
        <View style={styles.reviewsHeader}>
          <Text style={[styles.reviewsTitle, { color: colors.textDark }]}>Baholashlar va Sharhlar</Text>
          <TouchableOpacity
            style={[styles.writeReviewButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowReviewForm(!showReviewForm)}
          >
            <Text style={[styles.writeReviewText, { color: colors.surface }]}>
              {showReviewForm ? 'Bekor qilish' : 'Baholash yozish'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Review Form */}
        {showReviewForm && (
          <View style={[styles.reviewForm, { backgroundColor: colors.background }]}>
            <Text style={[styles.reviewFormLabel, { color: colors.textDark }]}>Baholash:</Text>
            <StarRating
              rating={reviewRating}
              onRatingPress={setReviewRating}
              size={30}
            />
            <Text style={[styles.reviewFormLabel, { color: colors.textDark }]}>Sharh:</Text>
            <TextInput
              style={[styles.reviewInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textDark }]}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Baholashingizni yozing..."
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textLight}
            />
            <TouchableOpacity
              style={[styles.submitReviewButton, { backgroundColor: colors.primary }, isSubmittingReview && styles.submitReviewButtonDisabled]}
              onPress={handleSubmitReview}
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[styles.submitReviewText, { color: colors.surface }]}>Yuborish</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Reviews List */}
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <View key={review.id} style={[styles.reviewItem, { backgroundColor: colors.background }]}>
              <View style={styles.reviewHeader}>
                <Text style={[styles.reviewAuthor, { color: colors.textDark }]}>{review.customer_name}</Text>
                <View style={styles.reviewMeta}>
                  <StarRating rating={review.rating} size={14} />
                  <Text style={[styles.reviewDate, { color: colors.textLight }]}>
                    {new Date(review.created_at).toLocaleDateString('uz-UZ')}
                  </Text>
                </View>
              </View>
              {review.comment && (
                <Text style={[styles.reviewComment, { color: colors.textDark }]}>{review.comment}</Text>
              )}
              {review.is_verified_purchase && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success || Colors.success} />
                  <Text style={[styles.verifiedText, { color: colors.success || Colors.success }]}>Tasdiqlangan xarid</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={[styles.noReviewsText, { color: colors.textLight }]}>Hozircha baholashlar yo'q</Text>
        )}
      </View>
      </ScrollView>
      <Footer currentScreen="products" />
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.borderLight,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 64,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: Colors.surface,
    padding: 20,
    marginTop: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: 8,
  },
  barcode: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  oldPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountBadgeText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  stockInfo: {
    fontSize: 14,
    color: Colors.success,
    marginBottom: 20,
    fontWeight: '600',
  },
  stockInfoOutOfStock: {
    color: Colors.danger,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  quantityLabel: {
    fontSize: 16,
    color: Colors.textDark,
    fontWeight: '500',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  quantityButtonText: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  quantityButtonTextDisabled: {
    color: Colors.textLight,
  },
  quantity: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textDark,
    minWidth: 30,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: Colors.border,
  },
  addButtonText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: Colors.textLight,
  },
  cartControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  addButtonWithQuantity: {
    flex: 1,
  },
  cartQuantityContainer: {
    backgroundColor: Colors.primary + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  cartQuantityText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  alertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  alertButtonText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  reviewsSection: {
    backgroundColor: Colors.surface,
    padding: 20,
    marginTop: 8,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  writeReviewButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  writeReviewText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  reviewForm: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  reviewFormLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 8,
  },
  reviewInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textDark,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitReviewButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitReviewButtonDisabled: {
    opacity: 0.6,
  },
  submitReviewText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  reviewItem: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAuthor: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textDark,
    lineHeight: 20,
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
  },
  noReviewsText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    padding: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewCount: {
    fontSize: 14,
    color: Colors.textLight,
  },
  imageGalleryIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  imageNavButton: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  imageNavButtonRight: {
    left: 'auto',
    right: 16,
  },
});
