import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  SafeAreaView,
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

  // Animation values
  const titleOpacity = useState(new Animated.Value(0))[0];
  const titleTranslateY = useState(new Animated.Value(30))[0];
  const subtitleOpacity = useState(new Animated.Value(0))[0];
  const subtitleTranslateY = useState(new Animated.Value(30))[0];
  const formOpacity = useState(new Animated.Value(0))[0];
  const formTranslateY = useState(new Animated.Value(30))[0];

  const isFormComplete = title.trim() !== '';

  const handleNext = useCallback(() => {
    navigation.navigate('SetupFirstPlanet', {
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

  useEffect(() => {
    // Animate elements in sequence
    const titleAnimation = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    const subtitleAnimation = Animated.parallel([
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    const formAnimation = Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    // Sequence the animations
    Animated.sequence([
      titleAnimation,
      Animated.delay(200),
      subtitleAnimation,
      Animated.delay(200),
      formAnimation,
    ]).start();
  }, [
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    formOpacity,
    formTranslateY,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          Create Your First Habit
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            },
          ]}
        >
          What new world will you explore? 🌌
        </Animated.Text>

        <Animated.View
          style={[
            styles.inputContainer,
            {
              opacity: formOpacity,
              transform: [{ translateY: formTranslateY }],
            },
          ]}
        >
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
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
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
    color: colors.text,
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
    fontSize: fontSizes.large,
    color: colors.primaryText,
  },
  headerButtonDisabledText: {
    color: colors.grey,
  },
});
