import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { GlassView, GlassViewProps } from 'expo-glass-effect';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Habit, useIsTraveling, useStore, useUserLevel } from '../utils/store';
import { cBodies } from '../planets';
import { ProgressBar } from './ProgressBar';
import {
  getLevelProgress,
  xpCurrentThresholdForLevel,
  getCurrentLevelXP,
} from '../utils/experience';
import { useTimer } from 'react-timer-hook';
import { getCurrentDate } from '../utils/time';

type UnifiedGlassPanelProps = {
  onPressPlanetTitle?: () => void;
  onPressNewHabit?: () => void;
};

export function UnifiedGlassPanel({
  onPressPlanetTitle,
  onPressNewHabit,
}: UnifiedGlassPanelProps) {
  const {
    userPosition,
    clearData,
    habits,
    activeTimer,
    timeOffset,
    cancelTimer,
    startTimer,
    expireTimer,
    completeHabit,
  } = useStore();

  const isTraveling = useIsTraveling();

  const displayLocation = isTraveling
    ? userPosition.target?.name
    : userPosition.startingLocation;
  const planet = cBodies.find((p) => p.name === displayLocation);

  useEffect(() => {
    if (!planet) {
      clearData();
    }
  }, [planet, clearData]);

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

  const level = useUserLevel();
  const { totalXP } = useStore();
  const levelProgress = getLevelProgress(totalXP);
  const levelThreshold = xpCurrentThresholdForLevel(level);
  const currentXP = getCurrentLevelXP(totalXP);

  const timerHabit = activeTimer
    ? habits.find((h) => h.id === activeTimer.habitId)
    : undefined;

  const initialExpiryTimestamp = activeTimer
    ? new Date(
        new Date(activeTimer.startTime).getTime() -
          timeOffset +
          (timerHabit?.timerLength ?? 0) * 1000,
      )
    : getCurrentDate();

  const { minutes, seconds, hours, restart, pause } = useTimer({
    expiryTimestamp: initialExpiryTimestamp,
    autoStart: false,
    onExpire: () => expireTimer(),
  });

  useEffect(() => {
    if (activeTimer) {
      const habit = habits.find((h) => h.id === activeTimer.habitId);
      const timerLen = habit?.timerLength ?? 0;
      const expiry = new Date(
        new Date(activeTimer.startTime).getTime() -
          timeOffset +
          timerLen * 1000,
      );
      restart(expiry);
    } else {
      pause();
    }
  }, [activeTimer, timeOffset, habits, restart, pause]);

  const glassViewProps: GlassViewProps = {
    glassEffectStyle: 'clear',
    tintColor: 'rgba(0, 0, 0, 0.8)',
  };

  if (activeTimer && timerHabit) {
    return (
      <GlassView
        style={[styles.container, styles.centered]}
        {...glassViewProps}
      >
        <Text style={styles.timerTitle}>{timerHabit.title}</Text>
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{`${hours * 60 + minutes}:${seconds
            .toString()
            .padStart(2, '0')}`}</Text>
        </View>
        <TouchableOpacity style={styles.cancelButton} onPress={cancelTimer}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </GlassView>
    );
  }

  return (
    <GlassView style={styles.container} {...glassViewProps}>
      <View style={styles.levelSection}>
        <Text style={styles.levelText}>Level {level}</Text>
        <ProgressBar
          progress={levelProgress}
          color={colors.white}
          backgroundColor={'rgba(255,255,255,0.2)'}
          height={8}
        />
        <Text style={styles.levelSubText}>
          {currentXP} / {levelThreshold} XP
        </Text>
      </View>

      {!!planet && (
        <View style={styles.journeySection}>
          <View style={styles.planetInfoContainer}>
            {!isTraveling && <Text style={styles.statusText}>Welcome to</Text>}
            {isTraveling && <Text style={styles.statusText}>En route to</Text>}
            {onPressPlanetTitle ? (
              <TouchableOpacity
                onPress={onPressPlanetTitle}
                activeOpacity={0.7}
              >
                <Text style={styles.planetTitle}>{planet.name}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.planetTitle}>{planet.name}</Text>
            )}
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Journey Progress</Text>
              <Text style={styles.progressValue}>
                {(distancePercentage * 100).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={distancePercentage}
              color={colors.white}
              backgroundColor={'rgba(255,255,255,0.2)'}
            />
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
        </View>
      )}

      <View style={styles.habitsHeaderRow}>
        <Text style={styles.sectionTitle}>Daily Habits</Text>
        {onPressNewHabit ? (
          <TouchableOpacity onPress={onPressNewHabit}>
            <Text style={styles.newHabitText}>+ New Habit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.habitsList}
        contentContainerStyle={styles.habitsListContent}
      >
        {habits.map((h, idx) => {
          const isCompletedToday = (habit: Habit) => {
            if (habit.completions.length === 0) return false;
            const lastCompletion = new Date(
              habit.completions[habit.completions.length - 1]!,
            );
            const today = getCurrentDate();
            return lastCompletion.toDateString() === today.toDateString();
          };
          const completed = isCompletedToday(h);
          return (
            <View
              key={h.id}
              style={[
                styles.habitRow,
                idx < habits.length - 1 ? styles.habitRowDivider : null,
              ]}
            >
              <View style={styles.habitRowInfo}>
                <Text style={styles.habitTitle}>{h.title}</Text>
                {h.description ? (
                  <Text style={styles.habitDescription}>{h.description}</Text>
                ) : null}
              </View>
              <View style={styles.actionsRow}>
                {h.timerLength ? (
                  <TouchableOpacity
                    style={styles.rowButton}
                    onPress={() => startTimer(h.id)}
                  >
                    <Text style={styles.rowButtonText}>Start</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.rowButton,
                    h.timerLength ? styles.rowButtonSpacing : null,
                  ]}
                  onPress={() =>
                    completeHabit(h.id).catch((e) => {
                      console.error(e);
                    })
                  }
                  disabled={completed}
                >
                  <Text
                    style={[
                      styles.rowButtonText,
                      completed ? { opacity: 0.5 } : null,
                    ]}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '92%',
    maxWidth: 560,
    padding: 20,
    borderRadius: 16,
    alignSelf: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  levelSection: {
    marginBottom: 18,
  },
  levelText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  levelSubText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 6,
  },
  journeySection: {
    marginBottom: 18,
  },
  planetInfoContainer: {
    marginBottom: 12,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.small,
    color: colors.white,
    opacity: 0.85,
    textAlign: 'center',
    marginTop: 2,
  },
  planetTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.white,
    textAlign: 'center',
  },
  progressContainer: {
    marginVertical: 6,
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
    color: colors.white,
  },
  progressValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.medium,
    color: colors.white,
    opacity: 0.9,
  },
  habitsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  newHabitText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
  },
  habitsList: {
    maxHeight: 320,
  },
  habitsListContent: {
    paddingBottom: 4,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  habitRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  habitRowInfo: {
    flex: 1,
    paddingRight: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  habitDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.white,
    opacity: 0.8,
    marginTop: 2,
  },
  rowButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rowButtonSpacing: {
    marginLeft: 8,
  },
  rowButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.small,
    color: colors.white,
  },
  timerTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  timerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  timerText: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.white,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cancelButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
  },
});

export default UnifiedGlassPanel;
