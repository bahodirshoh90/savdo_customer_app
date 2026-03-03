/**
 * PIN keypad: 4 dots + numeric keypad (1–9, 0, delete).
 * Rasmda ko'rsatilgan PIN ekraniga o'xshash.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const DOT_COUNT = 4;

export function PinDots({ length, filledColor = '#10b981', emptyColor = '#d1d5db' }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: DOT_COUNT }).map((_, index) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          style={[
            styles.dot,
            { backgroundColor: index < length ? filledColor : emptyColor },
          ]}
        />
      ))}
    </View>
  );
}

export default function PinKeypad({ onDigit, onDelete }) {
  // 3 ustunli grid: 0 raqami 8 ostida, delete 9 ostida.
  const rows = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['empty', 0, 'delete'],
  ];

  return (
    <View style={styles.keypad}>
      {rows.map((row, rowIndex) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={rowIndex}
          style={styles.keypadRow}
        >
          {row.map((key) => {
            if (key === 'empty') {
              return <View key="empty" style={styles.keyButton} />;
            }
            if (key === 'delete') {
              return (
                <TouchableOpacity
                  key="del"
                  style={styles.keyButton}
                  onPress={onDelete}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteIcon}>⌫</Text>
                  <Text style={styles.deleteLabel}>delete</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={key}
                style={styles.keyButton}
                onPress={() => onDigit(String(key))}
                activeOpacity={0.7}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: 8,
  },
  keypad: {
    alignSelf: 'stretch',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  keyText: {
    fontSize: 28,
    color: '#1f2937',
    fontWeight: '500',
  },
  deleteIcon: {
    fontSize: 22,
    color: '#6b7280',
  },
  deleteLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
});

