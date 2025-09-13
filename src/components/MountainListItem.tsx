import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Meter, metersToFeet } from '../utils/units';
import { Mountain } from '../mountains';
import { useUserLevel } from '../utils/store';

interface MountainListItemProps {
  mountain: Mountain;
  isSelected?: boolean;
  onPress: () => void;
}

export function MountainListItem({
  mountain,
  isSelected,
  onPress,
}: MountainListItemProps) {
  const userLevel = useUserLevel();
  const isLocked = userLevel.level < mountain.minLevel;

  function getHeightString(height: Meter) {
    return `${metersToFeet(height).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ft`;
  }

  return (
    <TouchableOpacity
      style={[
        styles.mountainBox, 
        isSelected && styles.selectedMountainBox,
        isLocked && styles.lockedMountainBox
      ]}
      disabled={isLocked}
      onPress={isLocked ? undefined : onPress}
    >
      <Text style={[styles.mountainName, isLocked && styles.lockedText]}>
        {mountain.name}
      </Text>

      <Text style={[styles.mountainInfo, isLocked && styles.lockedText]}>
        <Text style={styles.mountainInfoLabel}>Location:</Text>{' '}
        {mountain.location}
      </Text>

      <Text style={[styles.mountainInfo, isLocked && styles.lockedText]}>
        <Text style={styles.mountainInfoLabel}>Height:</Text>{' '}
        {getHeightString(mountain.height)}
      </Text>

      <Text style={[styles.mountainInfo, isLocked && styles.lockedText]}>
        <Text style={styles.mountainInfoLabel}>Min Level:</Text>{' '}
        {mountain.minLevel}
      </Text>

      <Text style={[styles.mountainDescription, isLocked && styles.lockedText]}>
        {mountain.description}
      </Text>

      {isLocked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockText}>Level {mountain.minLevel} Required</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  lockedMountainBox: {
    backgroundColor: colors.lightGrey,
    opacity: 0.6,
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
  lockedText: {
    color: colors.grey,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
