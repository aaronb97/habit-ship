import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';

// Timer values are now in seconds
const timerOptions: { label: string; value: number | 'custom' }[] = [
  { label: '5 minutes', value: 5 * 60 },
  { label: '10 minutes', value: 10 * 60 },
  { label: '20 minutes', value: 20 * 60 },
  { label: '30 minutes', value: 30 * 60 },
  { label: '1 hour', value: 60 * 60 },
  { label: 'Custom', value: 'custom' },
];

const defaultValues = [5 * 60, 10 * 60, 20 * 60, 30 * 60, 60 * 60];

interface TimerSelectionProps {
  onTimerChange: (seconds: number) => void;
  initialTimer?: number;
}

const TimerSelection: React.FC<TimerSelectionProps> = ({
  onTimerChange,
  initialTimer,
}) => {
  const [selectedTimer, setSelectedTimer] = useState<number | null>(
    initialTimer || null,
  );

  useEffect(() => {
    setSelectedTimer(initialTimer || null);
  }, [initialTimer]);

  const handlePress = (value: number | 'custom') => {
    // If the pressed button is already selected, deselect it.
    if (value !== 'custom' && value === selectedTimer) {
      setSelectedTimer(null);
      onTimerChange(0);
      return;
    }

    if (value === 'custom') {
      Alert.prompt(
        'Custom Timer',
        'Enter timer length in minutes:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: (text: string | undefined) => {
              const minutes = parseInt(text || '0', 10);
              if (!isNaN(minutes) && minutes > 0) {
                const seconds = minutes * 60;
                setSelectedTimer(seconds);
                onTimerChange(seconds);
              }
            },
          },
        ],
        'plain-text',
        '',
        'numeric',
      );
    } else {
      setSelectedTimer(value);
      onTimerChange(value);
    }
  };

  const isSelected = (option: { label: string; value: number | 'custom' }) => {
    if (selectedTimer === null) {
      return false;
    }

    if (option.value === selectedTimer) {
      return true;
    }

    if (
      option.value === 'custom' &&
      typeof selectedTimer === 'number' &&
      !defaultValues.includes(selectedTimer)
    ) {
      return true;
    }

    return false;
  };

  const getButtonLabel = (option: {
    label: string;
    value: number | 'custom';
  }) => {
    if (
      option.value === 'custom' &&
      typeof selectedTimer === 'number' &&
      !defaultValues.includes(selectedTimer)
    ) {
      return `${Math.floor(selectedTimer / 60)} min`;
    }

    return option.label;
  };

  return (
    <View style={styles.container}>
      {timerOptions.map((option) => (
        <TouchableOpacity
          key={option.label}
          style={[styles.button, isSelected(option) && styles.selectedButton]}
          onPress={() => handlePress(option.value)}
        >
          <Text
            style={[
              styles.buttonText,
              isSelected(option) && styles.selectedButtonText,
            ]}
          >
            {getButtonLabel(option)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 2,
    rowGap: 8,
  },
  button: {
    width: '32%',
    padding: 12,
    boxSizing: 'border-box',
    backgroundColor: colors.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.border,
    shadowColor: colors.accent,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.medium,
    color: colors.text,
    textAlign: 'center',
  },
  selectedButtonText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
  },
});

export default TimerSelection;
