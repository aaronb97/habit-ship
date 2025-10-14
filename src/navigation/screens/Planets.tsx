import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLandablePlanets } from '../../hooks/usePlanets';
import { colors } from '../../styles/theme';
import { useIsTraveling, useStore } from '../../utils/store';
import { PlanetListItem } from '../../components/PlanetListItem';

export function Planets() {
  const { setDestination } = useStore();
  const isTraveling = useIsTraveling();
  const justLanded = useStore((s) => s.justLanded);
  const planetsWithDistance = useLandablePlanets();

  const handleSetDestination = (planetName: string) => {
    if (justLanded) {
      Alert.alert(
        'Select on Home',
        'You just landed! Please go to the Home tab to choose your next destination.',
      );

      return;
    }

    if (isTraveling) {
      Alert.alert(
        'Change Destination',
        'You are currently traveling. Changing your destination will reset your progress toward the current destination. Are you sure you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Change Destination',
            style: 'destructive',
            onPress: () => {
              setDestination(planetName);
            },
          },
        ],
      );
    } else {
      Alert.alert('Set Destination', `Set ${planetName} as your destination?`, [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Set Destination',
          onPress: () => {
            setDestination(planetName);
          },
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {planetsWithDistance.map(
          ({ planet, distance, disabledReason, isVisited }) => (
            <PlanetListItem
              key={planet.name}
              planet={planet}
              distance={distance}
              disabledReason={disabledReason}
              isVisited={isVisited}
              onPress={() => handleSetDestination(planet.name)}
            />
          ),
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.starfield,
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  debugButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 16,
    zIndex: 10,
    opacity: 0.9,
  },
});
