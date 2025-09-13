import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Meter, metersToFeet } from '../utils/units';
import { Mountain } from '../mountains';

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
  function getHeightString(height: Meter) {
    return `${metersToFeet(height).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ft`;
  }

  return (
    <TouchableOpacity
      style={[styles.mountainBox, isSelected && styles.selectedMountainBox]}
      onPress={onPress}
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

      <Text style={styles.mountainDescription}>{mountain.description}</Text>
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
});
