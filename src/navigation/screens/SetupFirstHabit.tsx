import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../../styles/theme';

export function SetupFirstHabit() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState('');

  const isFormComplete = title.trim() !== '';

  const handleNext = useCallback(() => {
    const timer = parseInt(timerLength, 10) || 0;
    navigation.navigate('SetupFirstMountain', {
      habit: {
        title,
        description,
        timerLength: timer,
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
          placeholderTextColor={theme.colors.grey}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          placeholderTextColor={theme.colors.grey}
          value={description}
          onChangeText={setDescription}
        />

        <TextInput
          style={styles.input}
          placeholder="Timer in Minutes (optional)"
          placeholderTextColor={theme.colors.grey}
          value={timerLength}
          keyboardType="numeric"
          onChangeText={setTimerLength}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.xxlarge,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.medium,
    color: theme.colors.grey,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: theme.colors.card,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.medium,
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
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.fontSizes.medium,
    color: theme.colors.primary,
  },
  headerButtonDisabledText: {
    color: theme.colors.grey,
  },
});
