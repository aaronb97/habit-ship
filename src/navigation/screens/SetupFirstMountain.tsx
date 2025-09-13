import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MountainListItem } from '../../components/MountainListItem';
import { RootStackParamList } from '..';
import { mountains } from '../../mountains';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useStore } from '../../utils/store';
import { Meter } from '../../utils/units';

export function SetupFirstMountain() {
  const navigation = useNavigation();
  const { setIsSetupFinished, addHabit, setHike } = useStore();
  const [selectedMountain, setSelectedMountain] = useState(mountains[0].name);
  const params =
    useRoute<RouteProp<RootStackParamList, 'SetupFirstMountain'>>().params;

  // Animation values
  const titleOpacity = useState(new Animated.Value(0))[0];
  const titleTranslateY = useState(new Animated.Value(30))[0];
  const subtitleOpacity = useState(new Animated.Value(0))[0];
  const subtitleTranslateY = useState(new Animated.Value(30))[0];
  const listOpacity = useState(new Animated.Value(0))[0];
  const listTranslateY = useState(new Animated.Value(30))[0];

  const { habit } = params;

  const handleFinish = useCallback(() => {
    addHabit(habit);

    setHike({
      height: 0 as Meter,
      energy: 0,
      mountainName: selectedMountain,
    });

    setIsSetupFinished(true);
    navigation.navigate('WelcomeTransition');
  }, [
    addHabit,
    habit,
    selectedMountain,
    setHike,
    setIsSetupFinished,
    navigation,
  ]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerButton} onPress={handleFinish}>
          <Text style={styles.headerButtonText}>Finish</Text>
        </TouchableOpacity>
      ),
    });

    return () => {
      navigation.setOptions({
        headerRight: undefined,
      });
    };
  }, [navigation, handleFinish]);

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

    const listAnimation = Animated.parallel([
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(listTranslateY, {
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
      listAnimation,
    ]).start();
  }, [
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    listOpacity,
    listTranslateY,
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
          Your First Adventure
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
          Choose a mountain to begin your journey.
        </Animated.Text>

        <Animated.ScrollView
          style={[
            styles.scrollView,
            {
              opacity: listOpacity,
              transform: [{ translateY: listTranslateY }],
            },
          ]}
        >
          {mountains.map((mountain) => (
            <MountainListItem
              key={mountain.name}
              mountain={mountain}
              isSelected={selectedMountain === mountain.name}
              onPress={() => setSelectedMountain(mountain.name)}
            />
          ))}
        </Animated.ScrollView>
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
    marginBottom: 24,
  },
  scrollView: {
    width: '100%',
  },
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.primaryText,
  },
});
