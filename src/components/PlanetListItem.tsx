import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Planet, Moon } from '../planets';
import { useUserLevel } from '../utils/store';

interface PlanetListItemProps {
  planet: Planet | Moon;
  distance: number; // Distance in km from current position
  isSelected?: boolean;
  disabledReason?: string; // Reason why planet cannot be selected
  isVisited?: boolean; // Whether the planet has been visited/completed
  onPress?: () => void;
}

export function PlanetListItem({
  planet,
  distance,
  isSelected,
  disabledReason,
  isVisited,
  onPress,
}: PlanetListItemProps) {
  const userLevel = useUserLevel();
  const minLevel = planet.minLevel;
  const isLocked = minLevel !== undefined ? userLevel < minLevel : false;
  const isDisabled = !!disabledReason || isLocked;

  // Format distance for display
  const formatDistance = (dist: number): string => {
    if (dist === 0) {
      return '0 km';
    }

    if (dist < 1000) {
      return `${dist.toFixed(0)} km`;
    }

    if (dist < 1000000) {
      return `${(dist / 1000).toFixed(1)}K km`;
    }

    return `${(dist / 1000000).toFixed(1)}M km`;
  };

  return (
    <TouchableOpacity
      style={[
        styles.planetBox,
        isSelected && styles.selectedPlanetBox,
        isLocked && styles.lockedPlanetBox,
        disabledReason && styles.disabledPlanetBox,
      ]}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : onPress}
    >
      <View style={styles.nameContainer}>
        <Text style={[styles.planetName, isDisabled && styles.lockedText]}>
          {planet.name}
        </Text>
        {isVisited && <Text style={styles.visitedBadge}>✓ Visited</Text>}
      </View>

      <Text style={[styles.planetInfo, isDisabled && styles.lockedText]}>
        <Text style={styles.planetInfoLabel}>Distance:</Text>{' '}
        {formatDistance(distance)}
      </Text>

      {planet.xpReward && (
        <Text style={[styles.planetInfo, isDisabled && styles.lockedText]}>
          <Text style={styles.planetInfoLabel}>Landing XP:</Text>{' '}
          {planet.xpReward} XP
        </Text>
      )}

      {planet.moneyReward && (
        <Text style={[styles.planetInfo, isDisabled && styles.lockedText]}>
          <Text style={styles.planetInfoLabel}>Landing Money:</Text>{' '}
          {planet.moneyReward} Space Money
        </Text>
      )}

      {isLocked && minLevel !== undefined && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockText}>Level {minLevel} Required</Text>
        </View>
      )}

      {disabledReason && !isLocked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockText}>{disabledReason}</Text>
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
  disabledPlanetBox: {
    backgroundColor: colors.starfield,
    opacity: 0.6,
  },
  nameContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  planetName: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  visitedBadge: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.small,
    color: colors.primary,
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
  lockText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
    textAlign: 'center',
  },
});
