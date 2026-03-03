/**
 * Language Context for Customer App
 * Provides multi-language support with Uzbek, Russian, and English
 */
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LanguageContext = createContext();

// Translation dictionaries
const translations = {
  uz: {
    // Common
    loading: 'Yuklanmoqda...',
    error: 'Xatolik',
    success: 'Muvaffaqiyatli',
    cancel: 'Bekor qilish',
    confirm: 'Tasdiqlash',
    save: 'Saqlash',
    delete: 'O\'chirish',
    edit: 'Tahrirlash',
    search: 'Qidirish',
    filter: 'Filtr',
    sort: 'Tartiblash',
    all: 'Barchasi',

    // Navigation
    home: 'Bosh sahifa',
    products: 'Mahsulotlar',
    cart: 'Savatcha',
    orders: 'Buyurtmalar',
    profile: 'Profil',
    favorites: 'Sevimlilar',

    // Products
    productsList: 'Mahsulotlar ro\'yxati',
    productDetail: 'Mahsulot detallari',
    addToCart: 'Savatchaga qo\'shish',
    outOfStock: 'Omborda yo\'q',
    inStock: 'Omborda',
    price: 'Narx',
    brand: 'Brend',
    category: 'Kategoriya',
    reviews: 'Baholashlar',
    rating: 'Baholash',
    compare: 'Taqqoslash',

    // Cart
    cartItems: 'Savatchadagi mahsulotlar',
    quantity: 'Miqdor',
    total: 'Jami',
    checkout: 'Buyurtma berish',
    emptyCart: 'Savatcha bo\'sh',

    // Orders
    ordersList: 'Buyurtmalar ro\'yxati',
    orderDetail: 'Buyurtma detallari',
    orderNumber: 'Buyurtma raqami',
    orderStatus: 'Buyurtma holati',
    orderDate: 'Buyurtma sanasi',
    pending: 'Kutilmoqda',
    processing: 'Jarayonda',
    completed: 'Bajarildi',
    cancelled: 'Bekor qilindi',

    // Profile
    profileSettings: 'Profil sozlamalari',
    darkMode: 'Qorong\'u rejim',
    language: 'Til',
    logout: 'Chiqish',
    login: 'Kirish',

    // Reviews
    writeReview: 'Baholash yozish',
    ratingRequired: 'Baholash kerak',
    comment: 'Sharh',
    submit: 'Yuborish',
    helpful: 'Foydali',
    verifiedPurchase: 'Tasdiqlangan xarid',
    support: 'Yordam',
    chat: 'Suhbat',
    new_chat: 'Yangi suhbat',
    personalInfo: 'Shaxsiy ma\'lumotlar',
    theme: 'Tema',
    security: 'Xavfsizlik',
    helpAndNotif: 'Yordam va Bildirishnomalar',
    debtBalance: 'Qarz balansi',
    changePassword: 'Parolni o\'zgartirish',
    priceAlerts: 'Narx eslatmalari',
    name: 'Ism',
    phone: 'Telefon',
    address: 'Manzil',
    system: 'Tizim',
    dark: 'Qorong\'u',
    light: 'Yorug\'lik',
    langUz: 'O\'zbek',
    langRu: 'Русский',
    langEn: 'English',
    welcome: 'Xush kelibsiz',
    allProducts: 'Barcha mahsulotlarni ko\'rish',
    mostSold: 'Eng ko\'p sotilgan',
    topProducts: 'Top mahsulotlar',
    seasonal: 'Mavsumiy',
    seasonalHint: 'Mavsumga mos',
    onSale: 'Aksiyada',
    saleHint: 'Chegirmalar',
    bonusFriends: 'Bonus va Do\'stlar',
    referFriend: 'Do\'stni Taklif Qilish',
    bonusHint: 'Bonus oling',
    bonusSystem: 'Bonus Tizimi',
    bonusBall: 'Ballaringiz',
    quickAccess: 'Tezkor kirish',
    addProduct: 'Yana mahsulot qo\'shish',
  },

  ru: {
    // Common
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    save: 'Сохранить',
    delete: 'Удалить',
    edit: 'Редактировать',
    search: 'Поиск',
    filter: 'Фильтр',
    sort: 'Сортировка',
    all: 'Все',

    // Navigation
    home: 'Главная',
    products: 'Товары',
    cart: 'Корзина',
    orders: 'Заказы',
    profile: 'Профиль',
    favorites: 'Избранное',

    // Products
    productsList: 'Список товаров',
    productDetail: 'Детали товара',
    addToCart: 'В корзину',
    outOfStock: 'Нет в наличии',
    inStock: 'В наличии',
    price: 'Цена',
    brand: 'Бренд',
    category: 'Категория',
    reviews: 'Отзывы',
    rating: 'Рейтинг',
    compare: 'Сравнить',

    // Cart
    cartItems: 'Товары в корзине',
    quantity: 'Количество',
    total: 'Итого',
    checkout: 'Оформить заказ',
    emptyCart: 'Корзина пуста',

    // Orders
    ordersList: 'Список заказов',
    orderDetail: 'Детали заказа',
    orderNumber: 'Номер заказа',
    orderStatus: 'Статус заказа',
    orderDate: 'Дата заказа',
    pending: 'Ожидание',
    processing: 'В обработке',
    completed: 'Выполнено',
    cancelled: 'Отменено',

    // Profile
    profileSettings: 'Настройки профиля',
    darkMode: 'Тёмный режим',
    language: 'Язык',
    logout: 'Выйти',
    login: 'Войти',

    // Reviews
    writeReview: 'Написать отзыв',
    ratingRequired: 'Требуется рейтинг',
    comment: 'Комментарий',
    submit: 'Отправить',
    helpful: 'Полезно',
    verifiedPurchase: 'Подтверждённая покупка',
    support: 'Поддержка',
    chat: 'Чат',
    new_chat: 'Новый чат',
    personalInfo: 'Личные данные',
    theme: 'Тема',
    security: 'Безопасность',
    helpAndNotif: 'Помощь и уведомления',
    debtBalance: 'Баланс долга',
    changePassword: 'Сменить пароль',
    priceAlerts: 'Уведомления о ценах',
    name: 'Имя',
    phone: 'Телефон',
    address: 'Адрес',
    system: 'Система',
    dark: 'Тёмная',
    light: 'Светлая',
    langUz: 'O\'zbek',
    langRu: 'Русский',
    langEn: 'English',
    welcome: 'Добро пожаловать',
    allProducts: 'Все товары',
    mostSold: 'Популярные',
    topProducts: 'Топ товары',
    seasonal: 'Сезонные',
    seasonalHint: 'По сезону',
    onSale: 'Акция',
    saleHint: 'Скидки',
    bonusFriends: 'Бонусы и друзья',
    referFriend: 'Пригласить друга',
    bonusHint: 'Получите бонус',
    bonusSystem: 'Бонусная система',
    bonusBall: 'Ваши баллы',
    quickAccess: 'Быстрый доступ',
    addProduct: 'Добавить товар',
  },

  en: {
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    all: 'All',

    // Navigation
    home: 'Home',
    products: 'Products',
    cart: 'Cart',
    orders: 'Orders',
    profile: 'Profile',
    favorites: 'Favorites',

    // Products
    productsList: 'Products List',
    productDetail: 'Product Details',
    addToCart: 'Add to Cart',
    outOfStock: 'Out of Stock',
    inStock: 'In Stock',
    price: 'Price',
    brand: 'Brand',
    category: 'Category',
    reviews: 'Reviews',
    rating: 'Rating',
    compare: 'Compare',

    // Cart
    cartItems: 'Cart Items',
    quantity: 'Quantity',
    total: 'Total',
    checkout: 'Checkout',
    emptyCart: 'Cart is empty',

    // Orders
    ordersList: 'Orders List',
    orderDetail: 'Order Details',
    orderNumber: 'Order Number',
    orderStatus: 'Order Status',
    orderDate: 'Order Date',
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    cancelled: 'Cancelled',

    // Profile
    profileSettings: 'Profile Settings',
    darkMode: 'Dark Mode',
    language: 'Language',
    logout: 'Logout',
    login: 'Login',

    // Reviews
    writeReview: 'Write a Review',
    ratingRequired: 'Rating required',
    comment: 'Comment',
    submit: 'Submit',
    helpful: 'Helpful',
    verifiedPurchase: 'Verified Purchase',
    support: 'Support',
    chat: 'Chat',
    new_chat: 'New Chat',
    personalInfo: 'Personal Info',
    theme: 'Theme',
    security: 'Security',
    helpAndNotif: 'Help & Notifications',
    debtBalance: 'Debt Balance',
    changePassword: 'Change Password',
    priceAlerts: 'Price Alerts',
    name: 'Name',
    phone: 'Phone',
    address: 'Address',
    system: 'System',
    dark: 'Dark',
    light: 'Light',
    langUz: 'O\'zbek',
    langRu: 'Русский',
    langEn: 'English',
    welcome: 'Welcome',
    allProducts: 'View All Products',
    mostSold: 'Best Sellers',
    topProducts: 'Top Products',
    seasonal: 'Seasonal',
    seasonalHint: 'Seasonal picks',
    onSale: 'On Sale',
    saleHint: 'Discounts',
    bonusFriends: 'Bonus & Friends',
    referFriend: 'Refer a Friend',
    bonusHint: 'Earn bonus',
    bonusSystem: 'Bonus System',
    bonusBall: 'Your Points',
    quickAccess: 'Quick Access',
    addProduct: 'Add Another Product',
  },
};

// Helper to validate supported languages
const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'];

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('uz');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage)) {
        setLanguage(savedLanguage);
      } else {
        setLanguage('uz'); // Default to Uzbek
      }
    } catch (error) {
      console.error('Error loading language:', error);
      setLanguage('uz');
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = async (lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn('Invalid language:', lang);
      return;
    }

    try {
      await AsyncStorage.setItem('app_language', lang);
      setLanguage(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key, params = {}) => {
    let translation = translations[language]?.[key] || key;

    // Replace parameters in translation
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });

    return translation;
  };

  const value = {
    language,
    changeLanguage,
    t,
    isLoading,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export default LanguageContext;