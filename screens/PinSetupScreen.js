/**
 * PIN setup ekran: birinchi login dan keyin 4 xonali PIN o'rnatish.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import PinKeypad, { PinDots } from '../components/PinKeypad';
import * as pinService from '../services/pin';

export default function PinSetupScreen({ onSuccess }) {
  const { colors } = useTheme();
  const [step, setStep] = useState('enter'); // enter | confirm
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const currentPin = step === 'enter' ? firstPin : confirmPin;
  const title =
    step === 'enter'
      ? '4 xonali PIN kiriting'
      : 'PIN ni tasdiqlang';

  const handleDigit = (digit) => {
    if (currentPin.length >= 4) return;
    const next = currentPin + digit;
    if (step === 'enter') {
      setFirstPin(next);
      if (next.length === 4) {
        console.log('[PIN_SETUP] First PIN entered, moving to confirm');
        setStep('confirm');
      }
    } else {
      setConfirmPin(next);
      if (next.length === 4) {
        if (next === firstPin) {
          console.log('[PIN_SETUP] Confirm PIN matches, saving PIN...');
          pinService
            .setPin(next)
            .then(() => {
              console.log('[PIN_SETUP] PIN saved successfully, calling onSuccess()');
              onSuccess();
            })
            .catch((e) => {
              console.warn('[PIN_SETUP] Error saving PIN:', e);
              Alert.alert('Xatolik', 'PIN kodni saqlashda xatolik yuz berdi. Qayta urinib ko‘ring.');
            });
        } else {
          Alert.alert('Xatolik', 'PIN kodlar mos kelmadi. Qayta urinib ko‘ring.');
          setConfirmPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setFirstPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textLight }]}>{title}</Text>
      <PinDots length={currentPin.length} filledColor={colors.primary} />
      <PinKeypad onDigit={handleDigit} onDelete={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
});

