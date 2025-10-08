import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { planets } from '../planets';
import { colors, fonts, fontSizes } from '../styles/theme';
import {
  calculateDistance,
  useIsTraveling,
  useStore,
  useTimeRemaining,
} from '../utils/store';
import { ProgressBar } from './ProgressBar';

interface JourneyDisplayProps {
  onPlanetPress?: () => void;
}

function formatTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)} hour${hours !== 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours}h`;
  }
}

export function JourneyDisplay({ onPlanetPress }: JourneyDisplayProps) {
  const { userPosition, updateTravelPosition, clearData } = useStore();

  // Update position every second (which also triggers re-render for time remaining)
  useEffect(() => {
    const interval = setInterval(() => {
      updateTravelPosition();
    }, 1000);

    return () => clearInterval(interval);
  }, [updateTravelPosition]);

  // Determine what to display
  const displayLocation =
    userPosition.target?.name || userPosition.currentLocation;

  const isTraveling = useIsTraveling();

  const planet = planets.find((p) => p.name === displayLocation);

  if (!planet) {
    console.error('Encountered invalid planet, resetting data');
    clearData();
    return null;
  }

  // Calculate current stats if traveling
  let distanceRemaining = 0;
  let distancePercentage = 0;
  const timeRemaining = useTimeRemaining();

  if (
    userPosition.target &&
    userPosition.currentCoordinates &&
    userPosition.speed > 0
  ) {
    const targetPos = userPosition.target.position;

    distanceRemaining = calculateDistance(
      userPosition.currentCoordinates,
      targetPos,
    );

    if (userPosition.initialDistance && userPosition.initialDistance > 0) {
      const distanceTraveled = userPosition.initialDistance - distanceRemaining;
      distancePercentage = distanceTraveled / userPosition.initialDistance;
    }
  }

  return (
    <View style={styles.journeyDisplayContainer}>
      <TouchableOpacity
        style={styles.planetInfoContainer}
        activeOpacity={0.7}
        onPress={onPlanetPress}
      >
        <Text style={styles.planetTitle}>{planet.name}</Text>
        {!isTraveling && <Text style={styles.statusText}>Landed</Text>}
        {isTraveling && <Text style={styles.statusText}>En Route</Text>}
      </TouchableOpacity>

      {isTraveling && (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Journey Progress</Text>
              <Text style={styles.progressValue}>
                {(distancePercentage * 100).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar progress={distancePercentage} color={colors.primary} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Speed</Text>
              <Text style={styles.progressValue}>
                {userPosition.speed.toLocaleString()} km/h
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Time Remaining</Text>
              <Text style={styles.progressValue}>
                {formatTime(timeRemaining)}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Distance Remaining</Text>
              <Text style={styles.progressValue}>
                {distanceRemaining.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                km
              </Text>
            </View>
          </View>
        </>
      )}

      {userPosition.speed === 0 && (
        <Text style={styles.landedText}>
          {userPosition.target?.name
            ? `Complete a habit to launch toward ${userPosition.target.name}`
            : 'Select a destination to begin your journey'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  landedText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    marginTop: 8,
    textAlign: 'center',
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.small,
    color: colors.accent,
    textAlign: 'center',
    marginTop: 4,
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
