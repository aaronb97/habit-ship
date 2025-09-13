import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { getLevelProgress, getXPForNextLevel } from '../types';
import { useUserLevel } from '../utils/store';
import { ProgressBar } from './ProgressBar';

export function LevelProgressBar() {
  const userLevel = useUserLevel();
  const progress = getLevelProgress(userLevel.totalXP);
  const nextLevelXP = getXPForNextLevel(userLevel.level);

  return (
    <View style={styles.container}>
      <View style={styles.levelContainer}>
        <Text style={styles.levelText}>Level {userLevel.level}</Text>
      </View>
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={progress}
          color={colors.primaryText}
          backgroundColor={colors.backgroundDarker}
          height={8}
        />
        <Text style={styles.xpText}>
          {userLevel.currentXP} / {nextLevelXP} XP
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
