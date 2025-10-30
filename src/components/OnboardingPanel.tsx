import { useState, useRef } from 'react';
import { Animated, View, TextInput, StyleSheet } from 'react-native';
import { FadingTextList } from './FadingTextList';
import { HSTextInput } from './common/HSTextInput';
import { HSButton } from './common/HSButton';

// Delay used in onboarding for the OK button fade-in after lines appear
const ONBOARDING_OK_DELAY_MS = 2000;

const styles = StyleSheet.create({
  onboardOkButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
});

/**
 * First-run onboarding flow inside the glass panel. Orchestrates three steps:
 *
 * 1) Welcome copy with fading lines and an OK button.
 * 2) Create first habit with fading guidance and an auto-focused TextInput.
 * 3) Intro to the Moon as initial destination with an OK button.
 *
 * onCreateFirstHabit: Adds the first habit with given title.
 * onComplete: Marks onboarding complete.
 *
 * Returns: JSX for the current step.
 */
export function OnboardingPanel({
  onCreateFirstHabit,
  onComplete,
}: {
  onCreateFirstHabit: (title: string) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  if (step === 0) {
    return <WelcomeStep onNext={() => setStep(1)} />;
  }

  if (step === 1) {
    return (
      <FirstHabitStep
        onSubmitHabit={(title) => {
          onCreateFirstHabit(title);
          setStep(2);
        }}
      />
    );
  }

  return <MoonStep onDone={onComplete} />;
}

/**
 * Step 1: Welcome copy with fading text lines and a fading OK button.
 *
 * onNext: Advances to the next step when user taps OK.
 */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  const okOpacity = useRef(new Animated.Value(0)).current;
  const animateOk = () => {
    setTimeout(() => {
      Animated.timing(okOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, ONBOARDING_OK_DELAY_MS);
  };

  const lines = [
    'Welcome to HabitShip!',
    'Build small habits to fuel your journey.',
    'Explore the solar system as you progress.',
  ];

  return (
    <View style={{ width: '100%' }}>
      <FadingTextList
        lines={lines}
        onAllVisible={animateOk}
      />

      <Animated.View style={{ opacity: okOpacity }}>
        <HSButton
          style={styles.onboardOkButton}
          onPress={onNext}
        >
          OK
        </HSButton>
      </Animated.View>
    </View>
  );
}

/**
 * Step 2: Create the first habit. Shows fading guidance and an auto-focused input.
 *
 * onSubmitHabit: Called with the habit title when user taps OK.
 */
function FirstHabitStep({ onSubmitHabit }: { onSubmitHabit: (title: string) => void }) {
  const [title, setTitle] = useState('');
  const [showControls, setShowControls] = useState(false);
  const okOpacity = useRef(new Animated.Value(0)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(8)).current;
  const inputRef = useRef<TextInput | null>(null);

  const afterLines = () => {
    setShowControls(true);
    Animated.parallel([
      Animated.timing(okOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(inputOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(inputTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Focus the input when it becomes visible
      inputRef.current?.focus();
    });
  };

  const lines = [
    "Let's set up your first habit!",
    'Keep it simple; one small action you can do daily.',
  ];

  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0;

  return (
    <View style={{ width: '100%' }}>
      <FadingTextList
        lines={lines}
        onAllVisible={afterLines}
      />

      {showControls ? (
        <>
          <Animated.View
            style={{
              opacity: inputOpacity,
              transform: [{ translateY: inputTranslateY }],
            }}
          >
            <HSTextInput
              ref={inputRef}
              placeholder="e.g., Read twenty minutes"
              value={title}
              returnKeyType="done"
              onChangeText={setTitle}
              onSubmitEditing={() => {
                if (canSubmit) {
                  onSubmitHabit(trimmed);
                }
              }}
            />
          </Animated.View>

          <Animated.View style={{ opacity: okOpacity }}>
            <HSButton
              disabled={!canSubmit}
              style={styles.onboardOkButton}
              onPress={() => {
                if (canSubmit) {
                  onSubmitHabit(trimmed);
                }
              }}
            >
              OK
            </HSButton>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

/**
 * Step 3: Introduces the Moon as the initial destination and prompts to begin.
 *
 * onDone: Completes onboarding and reveals the normal panel content.
 */
function MoonStep({ onDone }: { onDone: () => void }) {
  const okOpacity = useRef(new Animated.Value(0)).current;
  const animateOk = () => {
    setTimeout(() => {
      Animated.timing(okOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, ONBOARDING_OK_DELAY_MS);
  };

  const lines = [
    'The Solar System awaits you!',
    'You will be amazed by what you can accomplish with persistent effort.',
    "Don't worry; we're starting you off easy with The Moon.",
    'Complete your first habit to fuel your launch, then open the Rocket tab to begin your journey.',
  ];

  return (
    <View style={{ width: '100%' }}>
      <FadingTextList
        lines={lines}
        onAllVisible={animateOk}
      />

      <Animated.View style={{ opacity: okOpacity }}>
        <HSButton
          style={styles.onboardOkButton}
          onPress={onDone}
        >
          OK
        </HSButton>
      </Animated.View>
    </View>
  );
}
