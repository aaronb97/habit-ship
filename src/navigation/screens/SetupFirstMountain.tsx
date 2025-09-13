import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your First Adventure</Text>

      <Text style={styles.subtitle}>
        Choose a mountain to begin your journey.
      </Text>

      <ScrollView style={styles.scrollView}>
        {mountains.map((mountain) => (
          <MountainListItem
            key={mountain.name}
            mountain={mountain}
            isSelected={selectedMountain === mountain.name}
            onPress={() => setSelectedMountain(mountain.name)}
          />
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
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
});
