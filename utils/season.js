/**
 * Joriy oy bo'yicha mavsumni qaytaradi.
 * Backend Product.season maydoni winter, spring, summer, autumn qabul qiladi.
 */
export function getCurrentSeason() {
  const month = new Date().getMonth(); // 0-11
  if (month >= 11 || month <= 1) return 'winter'; // Dec, Jan, Feb
  if (month >= 2 && month <= 4) return 'spring';  // Mar, Apr, May
  if (month >= 5 && month <= 7) return 'summer';  // Jun, Jul, Aug
  return 'autumn'; // Sep, Oct, Nov
}
