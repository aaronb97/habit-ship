import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RootStackParamList } from '..';
import { mountains } from '../../mountains';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useStore } from '../../utils/store';

export function SetupFirstMountain() {
  const navigation = useNavigation();
  const { setIsSetupFinished, addHabit, setHike } = useStore();
  const [selectedMountain, setSelectedMountain] = useState(mountains[0].name);
  const params =
    useRoute<RouteProp<RootStackParamList, 'SetupFirstMountain'>>().params;

  const { habit } = params;

  const handleFinish = useCallback(() => {
    addHabit(habit);

    setHike({
      height: 0,
      energy: 0,
      mountainName: selectedMountain,
    });

    setIsSetupFinished(true);
  }, [addHabit, habit, selectedMountain, setHike, setIsSetupFinished]);

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

  function getHeightString(height: number) {
    return `${height.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ft`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your First Adventure</Text>

      <Text style={styles.subtitle}>
        Choose a mountain to begin your journey.
      </Text>

      <ScrollView style={styles.scrollView}>
        {mountains.map((mountain) => (
          <TouchableOpacity
            key={mountain.name}
            style={[
              styles.mountainBox,
              selectedMountain === mountain.name && styles.selectedMountainBox,
            ]}
            onPress={() => setSelectedMountain(mountain.name)}
          >
            <Text style={styles.mountainName}>{mountain.name}</Text>

            <Text style={styles.mountainInfo}>
              <Text style={styles.mountainInfoLabel}>Location:</Text>{' '}
              {mountain.location}
            </Text>

            <Text style={styles.mountainInfo}>
              <Text style={styles.mountainInfoLabel}>Height:</Text>{' '}
              {getHeightString(mountain.height)}
            </Text>

            <Text style={styles.mountainDescription}>
              {mountain.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    marginBottom: 24,
  },
  scrollView: {
    width: '100%',
  },
  mountainBox: {
    backgroundColor: colors.card,
    padding: 20,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMountainBox: {
    borderColor: colors.primary,
  },
  mountainName: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  mountainInfo: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: 4,
  },
  mountainInfoLabel: {
    fontFamily: fonts.medium,
  },
  mountainDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    marginTop: 8,
    textAlign: 'center',
  },
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
});
