/**
 * Products Service for Customer App
 */
import { Platform } from 'react-native';
import api from './api';
import { API_ENDPOINTS } from '../config/api';

/**
 * Get products list
 */
export const getProducts = async (
  search = '',
  skip = 0,
  limit = 100,
  brand = '',
  supplier = '',
  category = '',
  sort = '',
  onSale = false,
  season = ''
) => {
  try {
    let url = `${API_ENDPOINTS.PRODUCTS.LIST}?skip=${skip}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (brand) url += `&brand=${encodeURIComponent(brand)}`;
    if (supplier) url += `&supplier=${encodeURIComponent(supplier)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (sort) url += `&sort_by=${encodeURIComponent(sort)}`;
    if (onSale) url += '&on_sale=true';
    if (season) url += `&season=${encodeURIComponent(season)}`;

    const response = await api.get(url);
    return Array.isArray(response) ? response : (response?.products || []);
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
};

/**
 * Eng ko'p sotilgan mahsulotlar
 */
export const getMostSoldProducts = async (limit = 10) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.PRODUCTS.MOST_SOLD}?limit=${limit}`);
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error getting most sold products:', error);
    return [];
  }
};

/**
 * Get product by ID
 */
export const getProduct = async (productId) => {
  try {
    const response = await api.get(API_ENDPOINTS.PRODUCTS.GET(productId));
    return response;
  } catch (error) {
    console.error('Error getting product:', error);
    throw error;
  }
};

/**
 * Rasm orqali mahsulot qidirish (yuklangan yoki kameradan olingan rasm).
 * @param {string} imageUri - Rasm URI (local file path yoki data URI)
 * @param {string} method - 'phash' yoki 'embedding'
 * @returns {Promise<{ products: Array, matches: Array }>}
 */
export const searchProductsByImage = async (imageUri, method = 'phash') => {
  try {
    const formData = new FormData();
    const filename = imageUri.split('/').pop()?.split('?')[0] || 'image.jpg';
    const type = imageUri.startsWith('data:')
      ? (imageUri.match(/data:([^;]+);/)?.[1] || 'image/jpeg')
      : 'image/jpeg';

    if (Platform.OS === 'web') {
      if (imageUri.startsWith('data:')) {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        formData.append('file', blob, filename);
      } else if (imageUri.startsWith('blob:')) {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        formData.append('file', blob, filename);
      } else {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        formData.append('file', blob, filename);
      }
    } else {
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: type,
      });
    }

    const url = `${API_ENDPOINTS.PRODUCTS.SEARCH_BY_IMAGE}?method=${encodeURIComponent(method)}&max_results=20`;
    const response = await api.post(url, formData, {
      headers: Platform.OS === 'web' ? {} : { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response;
  } catch (error) {
    console.error('Error searching by image:', error);
    throw error;
  }
};
