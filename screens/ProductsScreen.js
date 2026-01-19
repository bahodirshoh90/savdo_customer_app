/**
 * Products Screen for Customer App
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../constants/colors';
import { getProducts } from '../services/products';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';

export default function ProductsScreen({ navigation }) {
  const { addToCart, cartItems, removeFromCart, updateQuantity } = useCart();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const result = await getProducts(searchQuery, 0, 100);
      setProducts(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [searchQuery])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProducts();
  };

  const handleProductPress = (product) => {
    // Navigate within ProductsStack
    navigation.navigate('ProductDetail', { productId: product.id });
  };

  const handleAddToCart = (product, quantityChange = 1) => {
    if (quantityChange > 0) {
      addToCart(product, quantityChange);
    } else {
      // Remove or decrease quantity
      const currentItem = cartItems.find(item => item.product.id === product.id);
      if (currentItem) {
        if (currentItem.quantity <= 1) {
          // Remove from cart
          removeFromCart(product.id);
        } else {
          // Decrease quantity
          updateQuantity(product.id, currentItem.quantity - 1);
        }
      }
    }
  };

  const getCartQuantity = (productId) => {
    const item = cartItems.find(item => item.product.id === productId);
    return item ? item.quantity : 0;
  };

  const renderProduct = ({ item }) => (
    <View style={{ flex: 1, marginHorizontal: 4, maxWidth: '48%' }}>
      <ProductCard
        product={item}
        onPress={handleProductPress}
        onAdd={handleAddToCart}
        quantity={getCartQuantity(item.id)}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Mahsulot qidirish..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Mahsulot topilmadi' : 'Mahsulotlar topilmadi'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
});
