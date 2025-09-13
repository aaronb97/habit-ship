import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { mountains } from '../mountains';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useStore } from '../utils/store';
import { ProgressBar } from './ProgressBar';
import { metersToFeet } from '../utils/units';

interface HikeDisplayProps {
  onMountainPress?: () => void;
}

export function HikeDisplay({ onMountainPress }: HikeDisplayProps) {
  const { hike, expendEnergy, clearData } = useStore();

  useEffect(() => {
    const interval = setInterval(() => {
      expendEnergy();
    }, 100);

    return () => clearInterval(interval);
  }, [expendEnergy]);

  const mountain = mountains.find((m) => m.name === hike?.mountainName);

  if (!mountain || !hike) {
    console.error('Encountered invalid mountain, resetting data');
    clearData();
    return null;
  }

  const heightPercentage = (hike.height || 0) / mountain.height;
  const energyPercentage = (hike.energy || 0) / 100;

  const currentHeightInFeet = metersToFeet(hike.height).toFixed(1);
  const totalHeightInFeet = metersToFeet(mountain.height).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 0,
    },
  );

  const progressValue = `${currentHeightInFeet.toLocaleString()} / ${totalHeightInFeet} ft`;

  return (
    <View style={styles.hikeDisplayContainer}>
      <TouchableOpacity
        style={styles.mountainInfoContainer}
        activeOpacity={0.7}
        onPress={onMountainPress}
      >
        <Text style={styles.mountainTitle}>{hike.mountainName}</Text>
        <Text style={styles.mountainSubtitle}>{mountain.location}</Text>
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>{progressValue}</Text>
        </View>
        <ProgressBar progress={heightPercentage} color={colors.primary} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Energy</Text>
          <Text style={styles.progressValue}>
            {`${(energyPercentage * 100).toFixed(0)}%`}
          </Text>
        </View>
        <ProgressBar progress={energyPercentage} color={colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hikeDisplayContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mountainInfoContainer: {
    marginBottom: 16,
  },
  mountainTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xlarge,
    color: colors.text,
    textAlign: 'center',
  },
  mountainSubtitle: {
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
