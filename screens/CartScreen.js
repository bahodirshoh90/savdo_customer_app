/**
 * Cart Screen for Customer App
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Colors from '../constants/colors';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CartItem from '../components/CartItem';
import { createOrder } from '../services/orders';
import API_CONFIG from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Footer, { FooterAwareView } from '../components/Footer';
import api from '../services/api';

export default function CartScreen({ navigation }) {
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalAmount } = useCart();
  const { user, checkAuth } = useAuth();
  const { colors } = useTheme();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('cash'); // 'cash', 'card', 'debt'
  const [showLocationModal, setShowLocationModal] = React.useState(false);
  const [selectedLocation, setSelectedLocation] = React.useState({
    address: null,
    latitude: null,
    longitude: null,
  });
  const [loyaltyPoints, setLoyaltyPoints] = React.useState(0);
  const [useBonus, setUseBonus] = React.useState(false);
  const [bonusAmount, setBonusAmount] = React.useState(0);
  const [isLoadingLoyalty, setIsLoadingLoyalty] = React.useState(false);

  // Load loyalty points when user is available. Delay after auth so token is committed (web localStorage) before first request.
  React.useEffect(() => {
    if (!user?.customer_id) return;
    const t = setTimeout(() => loadLoyaltyPoints(), 800);
    return () => clearTimeout(t);
  }, [user?.customer_id]);

  const loadLoyaltyPoints = async () => {
    try {
      setIsLoadingLoyalty(true);
      const customerId = user?.customer_id != null ? String(user.customer_id) : await AsyncStorage.getItem('customer_id');
      if (!customerId) return;

      const data = await api.get('/loyalty/points');
      setLoyaltyPoints(data.points || 0);
    } catch (error) {
      // Loyalty optional - 401 is handled by api interceptor (refresh + retry); ignore other errors
      setLoyaltyPoints(0);
    } finally {
      setIsLoadingLoyalty(false);
    }
  };

  // Calculate bonus amount (1 point = 1 so'm)
  const calculateBonusAmount = () => {
    if (!useBonus || loyaltyPoints === 0) return 0;
    const totalAmount = getTotalAmount();
    // Calculate bonus based on available points (1 point = 1 so'm)
    const bonusFromPoints = loyaltyPoints; // All available points converted to so'm (1 point = 1 so'm)
    // Use all available points, but not more than total amount
    return Math.min(bonusFromPoints, totalAmount);
  };

  React.useEffect(() => {
    if (useBonus) {
      const bonus = calculateBonusAmount();
      setBonusAmount(bonus);
    } else {
      setBonusAmount(0);
    }
  }, [useBonus, loyaltyPoints, cartItems]);

  const getImageUrl = (product) => {
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

  // Extract order creation logic to a separate function
  const executeOrderCreation = async () => {
    const customerId = user?.customer_id != null ? String(user.customer_id) : await AsyncStorage.getItem('customer_id');
    setIsSubmitting(true);
    try {
      const orderItems = cartItems
        .filter(item => item.product && item.product.id && item.quantity && item.quantity > 0)
        .map(item => ({
          product_id: parseInt(item.product.id, 10),
          requested_quantity: parseInt(item.quantity, 10),
        }))
        .filter(item => item.product_id > 0 && item.requested_quantity > 0);

      if (orderItems.length === 0) {
        Alert.alert('Xatolik', 'Buyurtma uchun mahsulot topilmadi.');
        setIsSubmitting(false);
        return;
      }

      const orderData = {
        items: orderItems,
        payment_method: paymentMethod,
        delivery_address: selectedLocation.address,
        delivery_latitude: selectedLocation.latitude,
        delivery_longitude: selectedLocation.longitude,
        bonus_points_used: useBonus && bonusAmount > 0 ? bonusAmount : 0,
        customer_id: customerId || undefined,
      };

      const result = await createOrder(orderData);

      // Spend loyalty points AFTER successful order creation (not before)
      if (!result.offline && useBonus && bonusAmount > 0) {
        try {
          const spendData = await api.post('/loyalty/spend', { points: bonusAmount });
          setLoyaltyPoints(spendData.remaining_points || 0);
        } catch (bonusError) {
          // Ignore - bonus already applied in order
        }
      }
      
      // Clear cart immediately after successful order creation
      clearCart();

      const isOffline = result.offline === true;
      const alertTitle = isOffline ? 'Offline saqlandi' : 'Muvaffaqiyatli';
      const alertMessage = isOffline
        ? result.message || "Internet yo'q. Buyurtma offline saqlandi, keyinroq yuboriladi."
        : `Buyurtma muvaffaqiyatli yaratildi!\n\nBuyurtma raqami: #${result.id}`;

      Alert.alert(
        alertTitle,
        alertMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation && navigation.navigate) {
                navigation.navigate('Orders');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[CART] Order creation failed:', error.message);
      const errorMessage = error.response?.data?.detail || error.message || 'Buyurtma yaratishda xatolik yuz berdi.';
      Alert.alert('Xatolik', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Xatolik', 'Savatcha bo\'sh');
      return;
    }

    let customerId = user?.customer_id != null ? String(user.customer_id) : (await AsyncStorage.getItem('customer_id'));
    if (!customerId) {
      await checkAuth();
      customerId = (await AsyncStorage.getItem('customer_id')) || (user?.customer_id != null ? String(user.customer_id) : null);
    }
    if (!customerId) {
      Alert.alert('Xatolik', 'Mijoz ma\'lumotlari topilmadi. Iltimos, profil orqali chiqib qayta login qiling.');
      return;
    }

    const invalidItems = cartItems.filter(item => !item.product || !item.product.id || !item.quantity || item.quantity <= 0);
    if (invalidItems.length > 0) {
      Alert.alert('Xatolik', 'Savatchada noto\'g\'ri mahsulotlar mavjud. Iltimos, savatni tekshiring.');
      return;
    }

    setIsSubmitting(true);

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Jami: ${getTotalAmount().toLocaleString('uz-UZ')} so'm\n\nBuyurtmani tasdiqlaysizmi?`
      );
      if (confirmed) {
        await executeOrderCreation();
      } else {
        setIsSubmitting(false);
      }
    } else {
      Alert.alert(
        'Buyurtma berish',
        `Jami: ${getTotalAmount().toLocaleString('uz-UZ')} so'm\n\nBuyurtmani tasdiqlaysizmi?`,
        [
          { 
            text: 'Bekor qilish', 
            style: 'cancel', 
            onPress: () => setIsSubmitting(false),
          },
          {
            text: 'Tasdiqlash',
            onPress: () => executeOrderCreation(),
          },
        ]
      );
    }
  };

  if (cartItems.length === 0) {
    return (
      <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Savatcha bo'sh</Text>
          <TouchableOpacity
            style={[styles.browseButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Products')}
          >
            <Text style={[styles.browseButtonText, { color: Colors.surface }]}>Mahsulotlarni ko'rish</Text>
          </TouchableOpacity>
        </View>
        <Footer currentScreen="cart" />
      </FooterAwareView>
    );
  }

  return (
    <FooterAwareView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.content, { paddingBottom: 300 }]}
      >
        {cartItems.map((item) => (
          <CartItem
            key={item.product.id}
            item={item}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            getImageUrl={getImageUrl}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {/* Location Selection */}
        <View style={[styles.locationContainer, { borderBottomColor: colors.border }]}>
          <Text style={[styles.locationLabel, { color: colors.text }]}>Yetkazib berish manzili:</Text>
          <TouchableOpacity
            style={[styles.locationButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowLocationModal(true)}
          >
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={[styles.locationText, { color: selectedLocation.address ? colors.text : colors.textLight }]}>
              {selectedLocation.address || 'Xaritadan joyni tanlang'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
          {selectedLocation.address && (
            <TouchableOpacity
              style={styles.clearLocationButton}
              onPress={() => setSelectedLocation({ address: null, latitude: null, longitude: null })}
            >
              <Ionicons name="close-circle" size={18} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>

        {/* Payment Method Selection */}
        <View style={[styles.paymentMethodContainer, { borderBottomColor: colors.border }]}>
          <Text style={[styles.paymentMethodLabel, { color: colors.text }]}>To'lov usuli:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={paymentMethod}
              onValueChange={(value) => {
                console.log('[CART] Payment method changed to:', value);
                setPaymentMethod(value);
              }}
              style={[styles.picker, { color: colors.text }]}
              dropdownIconColor={colors.primary}
            >
              <Picker.Item label="Naqd" value="cash" />
              <Picker.Item label="Plastik karta" value="card" />
              <Picker.Item label="Olinadigan (qarz)" value="debt" />
            </Picker>
          </View>
        </View>

        {/* Bonus Usage Toggle */}
        {loyaltyPoints > 0 && (
          <View style={[styles.bonusContainer, { borderBottomColor: colors.border }]}>
            <View style={styles.bonusRow}>
              <View style={styles.bonusInfo}>
                <Ionicons name="trophy" size={20} color={Colors.success} />
                <Text style={[styles.bonusLabel, { color: colors.text }]}>
                  Bonuslar: {loyaltyPoints.toLocaleString('uz-UZ')} ball
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.bonusToggle, useBonus && { backgroundColor: colors.primary }]}
                onPress={() => setUseBonus(!useBonus)}
              >
                <Text style={[styles.bonusToggleText, { color: useBonus ? Colors.surface : colors.text }]}>
                  {useBonus ? 'Yoqilgan' : 'Yoqilmagan'}
                </Text>
              </TouchableOpacity>
            </View>
            {useBonus && bonusAmount > 0 && (
              <Text style={[styles.bonusAmount, { color: Colors.success }]}>
                Chegirma: -{bonusAmount.toLocaleString('uz-UZ')} so'm
              </Text>
            )}
          </View>
        )}

        <View style={styles.totalContainer}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Jami:</Text>
          <Text style={[styles.totalAmount, { color: colors.primary }]}>
            {Math.max(0, getTotalAmount() - bonusAmount).toLocaleString('uz-UZ')} so'm
          </Text>
        </View>
        {useBonus && bonusAmount > 0 && (
          <View style={styles.originalTotalContainer}>
            <Text style={[styles.originalTotalLabel, { color: colors.textLight }]}>
              Asl narx: {getTotalAmount().toLocaleString('uz-UZ')} so'm
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.checkoutButton, { backgroundColor: colors.primary }, isSubmitting && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={[styles.checkoutButtonText, { color: colors.surface }]}>Buyurtma berish</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Location Selection Modal */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Yetkazib berish manzili</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.locationModalContent}>
              <Text style={[styles.locationModalText, { color: colors.text }]}>
                Xaritadan joyni tanlash funksiyasi tez orada qo'shiladi.
              </Text>
              <Text style={[styles.locationModalSubtext, { color: colors.textLight }]}>
                Hozircha manzilni qo'lda kiriting:
              </Text>

              <TextInput
                style={[styles.addressInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Manzilni kiriting (masalan: Toshkent shahar, Chilonzor tumani, ...)"
                placeholderTextColor={colors.textLight}
                value={selectedLocation.address || ''}
                onChangeText={(text) => setSelectedLocation({ ...selectedLocation, address: text })}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.getCurrentLocationButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Ruxsat kerak', 'Joylashuv ruxsatini bering');
                      return;
                    }

                    const location = await Location.getCurrentPositionAsync({});
                    const { latitude, longitude } = location.coords;

                    // Use coordinates directly (Geocoding API removed in SDK 49)
                    // User can manually enter address or we can use coordinates
                    const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    
                    setSelectedLocation({
                      address: address,
                      latitude,
                      longitude,
                    });
                    Alert.alert('Muvaffaqiyatli', 'Joylashuv aniqlandi. Iltimos, manzilni qo\'lda kiriting.');
                  } catch (error) {
                    console.error('Error getting location:', error);
                    Alert.alert('Xatolik', 'Joylashuvni aniqlashda xatolik');
                  }
                }}
              >
                <Ionicons name="locate" size={20} color={Colors.surface} />
                <Text style={[styles.getCurrentLocationText, { color: Colors.surface }]}>
                  Joriy joylashuvni olish
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setShowLocationModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>Bekor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (selectedLocation.address) {
                      setShowLocationModal(false);
                    } else {
                      Alert.alert('Xatolik', 'Manzilni kiriting');
                    }
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: Colors.surface }]}>Saqlash</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Footer currentScreen="cart" />
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
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 100, // Add padding to avoid footer overlap
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 20,
  },
  browseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    position: 'relative',
    zIndex: 10,
    backgroundColor: Colors.surface,
  },
  paymentMethodContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  checkoutButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  locationContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
  },
  clearLocationButton: {
    marginLeft: 8,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  locationModalContent: {
    gap: 16,
  },
  locationModalText: {
    fontSize: 16,
    textAlign: 'center',
  },
  locationModalSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  addressInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  getCurrentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  getCurrentLocationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bonusContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bonusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bonusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  bonusToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bonusToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bonusAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  originalTotalContainer: {
    marginTop: 4,
  },
  originalTotalLabel: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
});
