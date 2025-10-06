import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Meter } from '../utils/units';
import { Planet } from '../planets';
import { useUserLevel } from '../utils/store';

interface PlanetListItemProps {
  planet: Planet;
  isSelected?: boolean;
  onPress: () => void;
}

export function PlanetListItem({
  planet,
  isSelected,
  onPress,
}: PlanetListItemProps) {
  const userLevel = useUserLevel();
  const isLocked = userLevel.level < planet.minLevel;

  function getDistanceString(distance: Meter) {
    // Convert to millions of km for readability
    const distanceInMillionsKm = distance / 1000000;
    if (distanceInMillionsKm < 1) {
      return `${distance.toLocaleString()} km`;
    }

    return `${distanceInMillionsKm.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} million km`;
  }

  return (
    <TouchableOpacity
      style={[
        styles.planetBox,
        isSelected && styles.selectedPlanetBox,
        isLocked && styles.lockedPlanetBox,
      ]}
      disabled={isLocked}
      onPress={isLocked ? undefined : onPress}
    >
      <Text style={[styles.planetName, isLocked && styles.lockedText]}>
        {planet.name}
      </Text>

      <Text style={[styles.planetInfo, isLocked && styles.lockedText]}>
        <Text style={styles.planetInfoLabel}>System:</Text> {planet.system}
      </Text>

      <Text style={[styles.planetInfo, isLocked && styles.lockedText]}>
        <Text style={styles.planetInfoLabel}>Distance:</Text>{' '}
        {getDistanceString(planet.distance)}
      </Text>

      <Text style={[styles.planetInfo, isLocked && styles.lockedText]}>
        <Text style={styles.planetInfoLabel}>Min Level:</Text> {planet.minLevel}
      </Text>

      {isLocked ? null : (
        <Text style={styles.planetDescription}>{planet.description}</Text>
      )}

      {isLocked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockText}>Level {planet.minLevel} Required</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  planetBox: {
    backgroundColor: colors.card,
    padding: 20,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: colors.accent,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPlanetBox: {
    borderColor: colors.primary,
    shadowOpacity: 0.4,
  },
  lockedPlanetBox: {
    backgroundColor: colors.starfield,
    opacity: 0.5,
  },
  planetName: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  planetInfo: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: 4,
  },
  planetInfoLabel: {
    fontFamily: fonts.medium,
    color: colors.cosmic,
  },
  planetDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    marginTop: 8,
    textAlign: 'center',
  },
  lockedText: {
    color: colors.grey,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  lockText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
    textAlign: 'center',
  },
});
