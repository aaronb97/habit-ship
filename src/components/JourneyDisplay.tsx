import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { planets } from '../planets';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useStore } from '../utils/store';
import { ProgressBar } from './ProgressBar';

interface JourneyDisplayProps {
  onPlanetPress?: () => void;
}

export function JourneyDisplay({ onPlanetPress }: JourneyDisplayProps) {
  const { journey, expendEnergy, clearData } = useStore();

  useEffect(() => {
    const interval = setInterval(() => {
      expendEnergy();
    }, 100);

    return () => clearInterval(interval);
  }, [expendEnergy]);

  const planet = planets.find((p) => p.name === journey?.planetName);

  if (!planet || !journey) {
    console.error('Encountered invalid planet, resetting data');
    clearData();
    return null;
  }

  const distancePercentage = (journey.distance || 0) / planet.distance;
  const energyPercentage = (journey.energy || 0) / 100;

  const currentDistanceInKm = (journey.distance / 1000).toFixed(0);
  const totalDistanceInKm = (planet.distance / 1000000).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    },
  );

  const progressValue = `${currentDistanceInKm.toLocaleString()} km / ${totalDistanceInKm} million km`;

  return (
    <View style={styles.journeyDisplayContainer}>
      <TouchableOpacity
        style={styles.planetInfoContainer}
        activeOpacity={0.7}
        onPress={onPlanetPress}
      >
        <Text style={styles.planetTitle}>{journey.planetName}</Text>
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>🚀 Journey Progress</Text>
          <Text style={styles.progressValue}>{progressValue}</Text>
        </View>
        <ProgressBar progress={distancePercentage} color={colors.primary} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>⚡ Fuel</Text>
          <Text style={styles.progressValue}>
            {`${(energyPercentage * 100).toFixed(0)}%`}
          </Text>
        </View>
        <ProgressBar progress={energyPercentage} color={colors.accent} />
      </View>

      {journey.energy === 0 && (
        <Text style={styles.outOfEnergyText}>
          Complete a habit to refuel your spacecraft! ⛽
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outOfEnergyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    marginTop: 8,
    textAlign: 'center',
  },
  journeyDisplayContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planetInfoContainer: {
    marginBottom: 16,
  },
  planetTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xlarge,
    color: colors.text,
    textAlign: 'center',
  },
  planetSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    textAlign: 'center',
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.text,
  },
  progressValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
});
