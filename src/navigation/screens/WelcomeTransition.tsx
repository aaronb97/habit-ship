import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, fontSizes } from '../../styles/theme';

export function WelcomeTransition() {
  const navigation = useNavigation();

  // Animation values for each element
  const emojiOpacity = useState(new Animated.Value(0))[0];
  const emojiScale = useState(new Animated.Value(0.3))[0];
  const titleOpacity = useState(new Animated.Value(0))[0];
  const titleTranslateY = useState(new Animated.Value(30))[0];
  const subtitleOpacity = useState(new Animated.Value(0))[0];
  const subtitleTranslateY = useState(new Animated.Value(30))[0];
  const motivationalOpacity = useState(new Animated.Value(0))[0];
  const motivationalTranslateY = useState(new Animated.Value(30))[0];
  const buttonOpacity = useState(new Animated.Value(0))[0];
  const buttonTranslateY = useState(new Animated.Value(30))[0];

  const handleContinue = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  useEffect(() => {
    // Sequential animations for each element
    const emojiAndTitleAnimation = Animated.parallel([
      Animated.timing(emojiOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(emojiScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
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

    const motivationalAnimation = Animated.parallel([
      Animated.timing(motivationalOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(motivationalTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    const buttonAnimation = Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    // Sequence all animations with delays
    Animated.sequence([
      emojiAndTitleAnimation,
      Animated.delay(300),
      subtitleAnimation,
      Animated.delay(200),
      motivationalAnimation,
      Animated.delay(300),
      buttonAnimation,
    ]).start();
  }, [
    emojiOpacity,
    emojiScale,
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    motivationalOpacity,
    motivationalTranslateY,
    buttonOpacity,
    buttonTranslateY,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.Text
          style={[
            styles.emoji,
            {
              opacity: emojiOpacity,
              transform: [{ scale: emojiScale }],
            },
          ]}
        >
          🚀
        </Animated.Text>

        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          Welcome to Your Journey!
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
          Every journey through the cosmos begins with a single step.
        </Animated.Text>

        <Animated.Text
          style={[
            styles.motivationalText,
            {
              opacity: motivationalOpacity,
              transform: [{ translateY: motivationalTranslateY }],
            },
          ]}
        >
          The stars are waiting for you.
        </Animated.Text>

        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Start My Journey</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  content: {
    alignItems: 'center',
    textAlign: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge + 4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.large,
    color: colors.primaryText,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  motivationalText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: colors.primaryText,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
    textAlign: 'center',
  },
});
