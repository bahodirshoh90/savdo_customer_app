/**
 * Unlock screen: 4 xonali PIN + Face ID / biometrik.
 * Ilova ochilganda rasmga o'xshash PIN ekrani ko'rsatiladi.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import PinKeypad, { PinDots } from '../components/PinKeypad';
import * as pinService from '../services/pin';

let LocalAuthentication = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line global-require
    LocalAuthentication = require('expo-local-authentication');
  } catch (e) {
    console.warn('[PIN] expo-local-authentication not available');
  }
}

const MAX_ATTEMPTS = 5;

export default function UnlockScreen({ onUnlock, onLockout }) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!LocalAuthentication) {
        setBiometricAvailable(false);
        return;
      }
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          if (mounted) setBiometricAvailable(false);
          return;
        }
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (mounted) setBiometricAvailable(isEnrolled);
      } catch {
        if (mounted) setBiometricAvailable(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDigit = (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      verifyPin(next);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const verifyPin = async (value) => {
    const ok = await pinService.verifyPin(value);
    if (ok) {
      await pinService.setFailedAttempts(0);
      onUnlock();
      return;
    }
    const used = await pinService.incrementFailedAttempts();
    const left = MAX_ATTEMPTS - used;
    setAttemptsLeft(left);
    setPin('');
    if (left <= 0) {
      await pinService.clearPin();
      if (onLockout) onLockout();
    } else {
      Alert.alert(
        "Noto'g'ri PIN",
        `Qolgan urinish: ${left}. 5 marta noto'g'ri kiritilsa login sahifasiga qaytishingiz kerak bo'ladi.`
      );
    }
  };

  const handleBiometric = async () => {
    if (!LocalAuthentication || !biometricAvailable) return;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ilovani ochish uchun biometrik tasdiqlang',
      });
      if (result.success) {
        await pinService.setFailedAttempts(0);
        onUnlock();
      }
    } catch (e) {
      console.warn('[PIN] Biometric error:', e);
    }
  };

  return (
    <View style={[styles.container]}>
      <Text style={styles.title}>Enter your PIN Code</Text>
      <PinDots length={pin.length} filledColor="#e5e7eb" emptyColor="#111827" />
      <PinKeypad onDigit={handleDigit} onDelete={handleDelete} />
      {biometricAvailable && (
        <TouchableOpacity
          style={[styles.biometricBtn, { borderColor: colors.primary }]}
          onPress={handleBiometric}
        >
          <Text style={[styles.biometricText, { color: colors.primary }]}>
            Face ID / Biometrik bilan ochish
          </Text>
        </TouchableOpacity>
      )}
      {attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
        <Text style={[styles.attemptsLeft, { color: colors.textLight }]}>
          Qolgan urinish: {attemptsLeft}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#050b1f',
  },
  title: {
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
    color: '#e5e7eb',
  },
  biometricBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 8,
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '500',
  },
  attemptsLeft: {
    marginTop: 12,
    fontSize: 14,
  },
});

