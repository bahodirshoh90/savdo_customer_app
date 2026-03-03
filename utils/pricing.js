/**
 * Pricing utilities for customer-specific prices
 */
export const normalizeCustomerType = (customerType) => {
  const value = (customerType || '').toString().toLowerCase().trim();
  if (value === 'wholesale' || value === 'ulgurji') {
    return 'wholesale';
  }
  if (value === 'retail' || value === 'dona') {
    return 'retail';
  }
  return 'regular';
};

const toNumber = (value) => {
  if (typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Get base price before discount (for customer type)
 */
export const getProductBasePrice = (product, customerType) => {
  const type = normalizeCustomerType(customerType);
  const wholesale = toNumber(product?.wholesale_price);
  const retail = toNumber(product?.retail_price);
  const regular = toNumber(product?.regular_price);

  if (type === 'wholesale') {
    return wholesale || retail || regular || 0;
  }
  if (type === 'retail') {
    return retail || regular || wholesale || 0;
  }
  return regular || retail || wholesale || 0;
};

/**
 * Aksiya faqat admin tanlagan narx turidagi mijozlar uchun.
 * sale_applies_to: 'wholesale'|'retail'|'regular'
 */
const saleAppliesToCustomer = (product, customerType) => {
  const type = normalizeCustomerType(customerType);
  const appliesTo = (product?.sale_applies_to || 'retail').toLowerCase();
  return type === appliesTo;
};

/**
 * Get product price with sale discount applied only when is_on_sale and sale_applies_to matches customer
 */
export const getProductPrice = (product, customerType) => {
  const basePrice = getProductBasePrice(product, customerType);
  const isOnSale = product?.is_on_sale === true;
  const discountPercent = toNumber(product?.discount_percent);
  const appliesToMe = saleAppliesToCustomer(product, customerType);

  if (isOnSale && appliesToMe && discountPercent > 0 && basePrice > 0) {
    const discount = basePrice * (discountPercent / 100);
    return Math.round(basePrice - discount);
  }
  return basePrice;
};

/**
 * Get discount percent for display (0 if not on sale or not for this customer type)
 */
export const getProductDiscountPercent = (product, customerType) => {
  if (!product?.is_on_sale || product?.discount_percent == null) return 0;
  if (!saleAppliesToCustomer(product, customerType)) return 0;
  return toNumber(product.discount_percent);
};
