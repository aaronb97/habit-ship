import { StyleSheet, Text, View } from 'react-native';
import { cBodies } from '../planets';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useIsTraveling, useStore } from '../utils/store';
import { ProgressBar } from './ProgressBar';

export function JourneyDisplay() {
  const { userPosition, clearData } = useStore();

  const isTraveling = useIsTraveling();

  // Determine what to display
  const displayLocation = isTraveling
    ? userPosition.target?.name
    : userPosition.startingLocation;

  const planet = cBodies.find((p) => p.name === displayLocation);
  // No time remaining in distance-per-habit model

  if (!planet) {
    console.error('Encountered invalid planet, resetting data');
    clearData();
    return null;
  }

  // Calculate current stats if traveling (distance-based)
  let distanceRemaining = 0;
  let distancePercentage = 0;

  if (userPosition.target) {
    const { initialDistance, distanceTraveled } = userPosition;
    if (typeof initialDistance === 'number' && initialDistance > 0) {
      const traveled = distanceTraveled ?? 0;
      distanceRemaining = Math.max(0, initialDistance - traveled);
      distancePercentage = Math.min(1, Math.max(0, traveled / initialDistance));
    }
  }

  return (
    <View style={styles.journeyDisplayContainer}>
      <View style={styles.planetInfoContainer}>
        {!isTraveling && <Text style={styles.statusText}>Welcome to </Text>}
        {isTraveling && <Text style={styles.statusText}>En route to </Text>}
        <Text style={styles.planetTitle}>{planet.name}</Text>
      </View>

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
          <Text style={styles.progressLabel}>Distance Remaining</Text>
          <Text style={styles.progressValue}>
            {distanceRemaining.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{' '}
            km
          </Text>
        </View>
      </View>

      {!isTraveling && (
        <Text style={styles.landedText}>
          {userPosition.target?.name
            ? `Complete a habit to travel toward ${userPosition.target.name}`
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
