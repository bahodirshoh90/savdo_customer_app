/**
 * Shaxsiy teglar ekrani: ro'yxat, qo'shish, o'chirish.
 * GET/POST/DELETE /api/product-tags
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Footer, { FooterAwareView } from '../components/Footer';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/api';
import Colors from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProductTagsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [tags, setTags] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [tagName, setTagName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadTags = useCallback(async () => {
    try {
      const raw = await api.get(API_ENDPOINTS.PRODUCT_TAGS.LIST);
      const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.items ?? []);
      setTags(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Product tags load error:', e);
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (search = '') => {
    try {
      const url = search
        ? `${API_ENDPOINTS.PRODUCTS.LIST}?search=${encodeURIComponent(search)}&limit=50`
        : `${API_ENDPOINTS.PRODUCTS.LIST}?limit=50`;
      const list = await api.get(url);
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Products load error:', e);
      setProducts([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadTags();
    }, [loadTags])
  );

  useEffect(() => {
    if (showAddModal) {
      loadProducts(productSearch);
    }
  }, [showAddModal, productSearch, loadProducts]);

  const handleAddTag = async () => {
    const pid = selectedProductId ? parseInt(selectedProductId, 10) : null;
    const tag = (tagName || '').trim();
    if (!pid || !tag) {
      Alert.alert('Xatolik', 'Mahsulot va teg nomini kiriting.');
      return;
    }
    setAdding(true);
    try {
      await api.post(API_ENDPOINTS.PRODUCT_TAGS.CREATE, { product_id: pid, tag });
      setShowAddModal(false);
      setSelectedProductId('');
      setTagName('');
      setProductSearch('');
      loadTags();
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Teg qo\'shishda xatolik';
      Alert.alert('Xatolik', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAdding(false);
    }
  };

  const performDelete = async (item, tagId) => {
    setDeletingId(item.id);
    try {
      const customerId = await AsyncStorage.getItem('customer_id');
      const url = API_ENDPOINTS.PRODUCT_TAGS.DELETE(tagId);
      const config = {};
      if (customerId) config.headers = { 'X-Customer-ID': customerId };
      await api.delete(url, config);
      setTags((prev) => prev.filter((t) => (t.id != null ? Number(t.id) : null) !== tagId));
      loadTags();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : (detail && typeof detail === 'object' && detail.message) || e.message || "O'chirishda xatolik";
      if (Platform.OS === 'web') {
        window.alert('Xatolik: ' + msg);
      } else {
        Alert.alert('Xatolik', msg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (item) => {
    const tagId = item.id != null ? Number(item.id) : null;
    if (tagId == null || isNaN(tagId)) {
      const errMsg = "Teg ID topilmadi. Ro'yxatni yangilab qayta urinib ko'ring.";
      if (Platform.OS === 'web') {
        window.alert('Xatolik: ' + errMsg);
      } else {
        Alert.alert('Xatolik', errMsg);
      }
      return;
    }
    const message = `"${item.tag || 'Teg'}" ni o'chirmoqchimisiz?`;
    if (Platform.OS === 'web') {
      if (window.confirm("Tegni o'chirish\n\n" + message)) {
        performDelete(item, tagId);
      }
      return;
    }
    Alert.alert(
      "Tegni o'chirish",
      message,
      [
        { text: 'Bekor', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () => performDelete(item, tagId),
        },
      ]
    );
  };

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId));
  const filteredProducts = productSearch.trim()
    ? products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.item_number || '').toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.barcode || '').toLowerCase().includes(productSearch.toLowerCase())
      )
    : products;

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.surface, borderColor: colors.border },
    text: { color: colors.text },
    textLight: { color: colors.textLight },
    input: { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  };

  return (
    <FooterAwareView style={[styles.container, dynamicStyles.container]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, dynamicStyles.text]}>
          {t('personalTags') || 'Shaxsiy teglar'}
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Teg qo'shish</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : tags.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="pricetag-outline" size={64} color={colors.textLight} />
          <Text style={[styles.emptyText, dynamicStyles.textLight]}>
            Hali teg yo'q. "Teg qo'shish" orqali qo'shing.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.card, dynamicStyles.card]}>
              <View style={styles.cardBody}>
                <Text style={[styles.tagName, dynamicStyles.text]} numberOfLines={1}>
                  {item.tag}
                </Text>
                <Text style={[styles.productName, dynamicStyles.textLight]} numberOfLines={1}>
                  {item.product_name || `Mahsulot #${item.product_id}`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color={Colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Yangi teg</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, dynamicStyles.text]}>Mahsulot qidirish</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Nom, kod yoki barkod..."
                placeholderTextColor={colors.textLight}
                value={productSearch}
                onChangeText={(v) => {
                  setProductSearch(v);
                  if (!v.trim()) setSelectedProductId('');
                }}
              />
              {productSearch.trim().length > 0 && (
                <View style={[styles.dropdown, dynamicStyles.card]}>
                  {filteredProducts.slice(0, 20).map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.dropdownItem,
                        selectedProductId === String(p.id) && styles.dropdownItemSelected,
                        selectedProductId === String(p.id) && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        setSelectedProductId(String(p.id));
                        setProductSearch(p.name || '');
                      }}
                    >
                      <Text style={[styles.dropdownItemText, dynamicStyles.text]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {(p.item_number || p.barcode) && (
                        <Text style={[styles.dropdownItemSub, dynamicStyles.textLight]} numberOfLines={1}>
                          {[p.item_number, p.barcode].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {filteredProducts.length === 0 && (
                    <Text style={[styles.dropdownEmpty, dynamicStyles.textLight]}>Mahsulot topilmadi</Text>
                  )}
                </View>
              )}
              <Text style={[styles.label, dynamicStyles.text]}>Teg nomi</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Masalan: Sevimli, Sovg'a..."
                placeholderTextColor={colors.textLight}
                value={tagName}
                onChangeText={setTagName}
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddTag}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Qo'shish</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Footer />
    </FooterAwareView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    marginTop: 48,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardBody: {
    flex: 1,
  },
  tagName: {
    fontSize: 16,
    fontWeight: '600',
  },
  productName: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  dropdownItemSelected: {
    borderLeftWidth: 3,
  },
  dropdownItemText: {
    fontSize: 15,
  },
  dropdownItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  dropdownEmpty: {
    padding: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
