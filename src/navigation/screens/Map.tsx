import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlanets } from '../../hooks/usePlanets';
import { colors } from '../../styles/theme';
import { useIsTraveling, useStore } from '../../utils/store';
import { PlanetListItem } from '../../components/PlanetListItem';
import { SolarSystemMap } from '../../components/SolarSystemMap';
type ViewMode = 'list' | 'map';

export function Planets() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPlanet, setSelectedPlanet] = useState('');
  const [mapKey, setMapKey] = useState(0);
  const { setDestination } = useStore();
  const isTraveling = useIsTraveling();
  const planetsWithDistance = usePlanets();

  const handleSetDestination = (planetName: string) => {
    if (isTraveling) {
      Alert.alert(
        'Change Destination',
        'You are currently traveling. Changing your destination will reset your speed. Are you sure you want to continue?',
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
              setSelectedPlanet('');
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
            setSelectedPlanet('');
          },
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segment,
              styles.segmentLeft,
              viewMode === 'list' && styles.segmentActive,
            ]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list"
              size={20}
              color={viewMode === 'list' ? colors.white : colors.grey}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              styles.segmentRight,
              viewMode === 'map' && styles.segmentActive,
            ]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons
              name="map"
              size={20}
              color={viewMode === 'map' ? colors.white : colors.grey}
            />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
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
                isSelected={selectedPlanet === planet.name}
                disabledReason={disabledReason}
                isVisited={isVisited}
                onPress={() => handleSetDestination(planet.name)}
              />
            ),
          )}
        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <SolarSystemMap key={mapKey} />
          <TouchableOpacity
            style={styles.debugButton}
            accessibilityLabel="Remount SolarSystemMap"
            onPress={() => setMapKey((k) => k + 1)}
          >
            <Ionicons name="refresh" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
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
