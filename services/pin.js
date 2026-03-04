/**
 * PIN code service: hash, verify, store in SecureStore.
 * Failed attempts are stored in AsyncStorage.
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line global-require
    SecureStore = require('expo-secure-store').default;
  } catch (e) {
    console.warn('[PIN] SecureStore not available, falling back to AsyncStorage/localStorage (less secure).');
  }
}

const PIN_HASH_KEY = 'customer_pin_hash';
const PIN_SALT_KEY = 'customer_pin_salt';
const PIN_FAILED_ATTEMPTS_KEY = 'pin_failed_attempts';
const MAX_PIN_ATTEMPTS = 5;

/** Get existing salt only (do not create). Used for PIN verification so we never overwrite salt when resuming from background. On native, fallback to AsyncStorage if SecureStore returns null (e.g. after resume from background). */
async function getStoredSalt() {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(PIN_SALT_KEY) || null;
  }
  if (SecureStore) {
    try {
      const fromSecure = await SecureStore.getItemAsync(PIN_SALT_KEY);
      if (fromSecure) return fromSecure;
    } catch {
      // ignore
    }
  }
  try {
    const fromAsync = await AsyncStorage.getItem(PIN_SALT_KEY);
    return fromAsync || null;
  } catch {
    return null;
  }
}

async function getSalt() {
  let salt = await getStoredSalt();
  if (salt) return salt;

  salt = `${Math.random().toString(36).slice(2)}${Date.now()}`;
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(PIN_SALT_KEY, salt);
    } catch {
      // ignore
    }
  } else if (SecureStore) {
    try {
      await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.setItem(PIN_SALT_KEY, salt);
    } catch {
      // ignore
    }
  }
  return salt;
}

async function hashPin(pin) {
  const salt = await getSalt();
  return hashPinWithSalt(pin, salt);
}

async function hashPinWithSalt(pin, salt) {
  const combined = `${salt}${pin}`;
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

async function getStoredPinHash() {
  // Web: localStorage
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(PIN_HASH_KEY) || null;
    } catch {
      return null;
    }
  }

  // Native: try SecureStore first
  if (SecureStore) {
    try {
      const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
      if (hash) return hash;
    } catch (e) {
      console.warn('[PIN] SecureStore getItemAsync error, falling back to AsyncStorage:', e);
    }
  }

  // Fallback / mirror: AsyncStorage (less secure, but more reliable)
  try {
    const hash = await AsyncStorage.getItem(PIN_HASH_KEY);
    return hash || null;
  } catch {
    return null;
  }
}

export async function setPin(pin) {
  const salt = `${Math.random().toString(36).slice(2)}${Date.now()}`;

  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(PIN_SALT_KEY, salt);
    } catch {}
  } else {
    if (SecureStore) {
      try { await SecureStore.setItemAsync(PIN_SALT_KEY, salt); } catch {}
    }
    try { await AsyncStorage.setItem(PIN_SALT_KEY, salt); } catch {}
  }

  const hash = await hashPinWithSalt(pin, salt);

  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(PIN_HASH_KEY, hash);
    } catch {}
  } else {
    if (SecureStore) {
      try { await SecureStore.setItemAsync(PIN_HASH_KEY, hash); } catch {}
    }
    try { await AsyncStorage.setItem(PIN_HASH_KEY, hash); } catch {}
  }

  await setFailedAttempts(0);
}

export async function verifyPin(pin) {
  const stored = await getStoredPinHash();
  const salt = await getStoredSalt();
  
  // DEBUG — o'chirishni unutmang production da
  console.log('[PIN_VERIFY] stored hash exists:', !!stored);
  console.log('[PIN_VERIFY] salt exists:', !!salt);
  
  if (!stored) return false;
  if (!salt) return false;
  const hash = await hashPinWithSalt(pin, salt);
  const result = hash === stored;
  console.log('[PIN_VERIFY] result:', result);
  return result;
}

export async function hasPin() {
  const hash = await getStoredPinHash();
  return !!hash;
}

export async function clearPin() {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(PIN_HASH_KEY);
      globalThis.localStorage?.removeItem(PIN_SALT_KEY);
    } catch {
      // ignore
    }
  } else if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(PIN_HASH_KEY);
      await SecureStore.deleteItemAsync(PIN_SALT_KEY);
    } catch (e) {
      console.warn('[PIN] SecureStore deleteItemAsync error, clearing AsyncStorage copy:', e);
    }
    try {
      await AsyncStorage.removeItem(PIN_HASH_KEY);
      await AsyncStorage.removeItem(PIN_SALT_KEY);
    } catch {
      // ignore
    }
  } else {
    try {
      await AsyncStorage.removeItem(PIN_HASH_KEY);
    } catch {
      // ignore
    }
  }

  await setFailedAttempts(0);
}

export async function getFailedAttempts() {
  try {
    const raw = await AsyncStorage.getItem(PIN_FAILED_ATTEMPTS_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setFailedAttempts(n) {
  try {
    await AsyncStorage.setItem(PIN_FAILED_ATTEMPTS_KEY, String(n));
  } catch {
    // ignore
  }
}

export async function incrementFailedAttempts() {
  const current = await getFailedAttempts();
  const next = current + 1;
  await setFailedAttempts(next);
  return next;
}

export const MAX_PIN_ATTEMPTS_COUNT = MAX_PIN_ATTEMPTS;

