import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';

const timerOptions: { label: string; value: number | 'custom' }[] = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '20 minutes', value: 20 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: 'Custom', value: 'custom' },
];

interface TimerSelectionProps {
  onTimerChange: (minutes: number) => void;
  initialTimer?: number;
}

const TimerSelection: React.FC<TimerSelectionProps> = ({
  onTimerChange,
  initialTimer,
}) => {
  const [selectedTimer, setSelectedTimer] = useState<number | 'custom' | null>(
    initialTimer || null,
  );

  useEffect(() => {
    setSelectedTimer(initialTimer || null);
  }, [initialTimer]);

  const handlePress = (value: number | 'custom') => {
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
                setSelectedTimer(minutes);
                onTimerChange(minutes);
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
    if (selectedTimer === null) return false;
    if (option.value === selectedTimer) return true;
    if (
      option.value === 'custom' &&
      typeof selectedTimer === 'number' &&
      ![5, 10, 20, 30, 60].includes(selectedTimer)
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
      ![5, 10, 20, 30, 60].includes(selectedTimer)
    ) {
      return `${selectedTimer} min`;
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
    marginVertical: 10,
  },
  button: {
    width: '32%',
    aspectRatio: 2,
    backgroundColor: colors.white,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.backgroundDarker,
  },
  selectedButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
