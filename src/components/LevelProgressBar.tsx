import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useStore, useUserLevel } from '../utils/store';
import { ProgressBar } from './ProgressBar';
import {
  getLevelProgress,
  xpCurrentThresholdForLevel,
  getCurrentLevelXP,
} from '../utils/experience';

export function LevelProgressBar() {
  const level = useUserLevel();
  const { totalXP } = useStore();
  const progress = getLevelProgress(totalXP);
  const threshold = xpCurrentThresholdForLevel(level);
  const currentXP = getCurrentLevelXP(totalXP);

  return (
    <View style={styles.container}>
      <View style={styles.levelContainer}>
        <Text style={styles.levelText}>Level {level}</Text>
      </View>
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={progress}
          color={colors.primaryText}
          backgroundColor={colors.backgroundDarker}
          height={8}
        />
        <Text style={styles.xpText}>
          {currentXP} / {threshold} XP
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 120,
  },
  levelContainer: {
    marginBottom: 4,
  },
  levelText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.text,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  xpText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xsmall,
    color: colors.grey,
    marginTop: 2,
    textAlign: 'center',
  },
});
