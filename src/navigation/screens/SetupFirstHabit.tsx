import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TimerSelection from '../../components/TimerSelection';
import { colors, fonts, fontSizes } from '../../styles/theme';

export function SetupFirstHabit() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState(0);

  const isFormComplete = title.trim() !== '';

  const handleNext = useCallback(() => {
    navigation.navigate('SetupFirstMountain', {
      habit: {
        title,
        description,
        timerLength,
      },
    });
  }, [navigation, title, description, timerLength]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          disabled={!isFormComplete}
          style={styles.headerButton}
          onPress={handleNext}
        >
          <Text
            style={[
              styles.headerButtonText,
              !isFormComplete && styles.headerButtonDisabledText,
            ]}
          >
            Next
          </Text>
        </TouchableOpacity>
      ),
    });

    return () => {
      navigation.setOptions({
        headerRight: undefined,
      });
    };
  }, [navigation, isFormComplete, handleNext]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your First Habit</Text>

      <Text style={styles.subtitle}>What new peak will you conquer?</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Habit Title (e.g., Morning Run)"
          placeholderTextColor={colors.grey}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          placeholderTextColor={colors.grey}
          value={description}
          onChangeText={setDescription}
        />

        <View style={styles.labelContainer}>
          <Text style={styles.label}>Timer</Text>
          <Text style={styles.subLabel}>(optional)</Text>
        </View>
        <TimerSelection onTimerChange={setTimerLength} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: 32,
  },
  labelContainer: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  subLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.card,
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
  headerButtonDisabledText: {
    color: colors.grey,
  },
});
