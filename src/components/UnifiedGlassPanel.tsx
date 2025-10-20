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
  getDailyDistanceForLevel,
} from '../utils/experience';
import { useTimer } from 'react-timer-hook';
import { useGetCurrentDate } from '../utils/time';
import { MaterialIcons } from '@expo/vector-icons';

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

  const getCurrentDate = useGetCurrentDate();
  const fuelKm = useStore((s) => s.fuelKm);
  const showJourneyRemaining = useStore((s) => s.showJourneyRemaining);
  const setShowJourneyRemaining = useStore((s) => s.setShowJourneyRemaining);
  const showFuelCapacity = useStore((s) => s.showFuelCapacity);
  const setShowFuelCapacity = useStore((s) => s.setShowFuelCapacity);

  const isTraveling = useIsTraveling();

  const displayLocation = isTraveling
    ? userPosition.target?.name
    : userPosition.startingLocation;

  const planet = cBodies.find((p) => p.name === displayLocation);
  const bodyHex = planet
    ? `#${planet.color.toString(16).padStart(6, '0')}`
    : colors.white;

  useEffect(() => {
    if (!planet) {
      clearData();
    }
  }, [planet, clearData]);

  let distancePercentage = 0;
  let distanceRemaining = 0;

  if (userPosition.target) {
    const { initialDistance, previousDistanceTraveled } = userPosition;
    if (typeof initialDistance === 'number' && initialDistance > 0) {
      const traveled = previousDistanceTraveled ?? 0;
      distancePercentage = Math.min(1, Math.max(0, traveled / initialDistance));
      distanceRemaining = Math.max(0, initialDistance - traveled);
    }
  }

  const level = useUserLevel();
  const { totalXP } = useStore();
  const levelProgress = getLevelProgress(totalXP);
  const levelThreshold = xpCurrentThresholdForLevel(level);
  const currentXP = getCurrentLevelXP(totalXP);
  const dailyFuelCap = getDailyDistanceForLevel(level);
  const fuelProgress =
    dailyFuelCap > 0 ? Math.min(1, fuelKm / dailyFuelCap) : 0;

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

  const renderProgressItem = (
    left: string,
    right: string,
    progress: number,
    barColor: string,
  ) => (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{left}</Text>
        <Text style={styles.progressValue}>{right}</Text>
      </View>
      <ProgressBar
        progress={progress}
        color={barColor}
        backgroundColor={'rgba(255,255,255,0.2)'}
      />
    </View>
  );

  return (
    <GlassView style={styles.container} {...glassViewProps}>
      {!!planet && (
        <View style={styles.journeySection}>
          <View style={styles.planetInfoContainer}>
            {!isTraveling && (
              <Text style={[styles.statusText, { color: bodyHex }]}>
                Welcome to
              </Text>
            )}
            {isTraveling && (
              <Text style={[styles.statusText, { color: bodyHex }]}>
                En route to
              </Text>
            )}
            {onPressPlanetTitle ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPressPlanetTitle}
              >
                <Text style={[styles.planetTitle, { color: bodyHex }]}>
                  {planet.name}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.planetTitle, { color: bodyHex }]}>
                {planet.name}
              </Text>
            )}
            {!isTraveling && userPosition.target && fuelKm > 0 ? (
              <Text style={[styles.statusText, { color: bodyHex }]}>
                Open the map tab to launch to {userPosition.target.name}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowJourneyRemaining(!showJourneyRemaining)}
          >
            {renderProgressItem(
              showJourneyRemaining ? 'Distance Remaining' : 'Journey Progress',
              showJourneyRemaining
                ? `${distanceRemaining.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })} km`
                : `${(distancePercentage * 100).toFixed(1)}%`,
              distancePercentage,
              colors.primary,
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.levelSection}>
        {renderProgressItem(
          `Level ${level}`,
          `${currentXP} / ${levelThreshold} XP`,
          levelProgress,
          colors.accent,
        )}
      </View>

      <View style={styles.levelSection}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowFuelCapacity(!showFuelCapacity)}
        >
          {renderProgressItem(
            'Fuel',
            showFuelCapacity
              ? `${fuelKm.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} km / ${dailyFuelCap.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} km`
              : `${fuelKm.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} km`,
            fuelProgress,
            '#90EE90',
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.habitsHeaderRow}>
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
            if (habit.completions.length === 0) {
              return false;
            }

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
                <Text
                  style={[
                    styles.habitTitle,
                    completed ? styles.completedHabitTitle : null,
                  ]}
                >
                  {h.title}
                </Text>
                {(() => {
                  const count = h.completions.length;
                  if (count === 0) {
                    return null;
                  }

                  const last = new Date(h.completions[count - 1]!);
                  const today = getCurrentDate();
                  const todayStart = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                  );

                  const lastStart = new Date(
                    last.getFullYear(),
                    last.getMonth(),
                    last.getDate(),
                  );

                  const diffDays = Math.round(
                    (todayStart.getTime() - lastStart.getTime()) / 86400000,
                  );

                  const timeStr = last.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  });

                  const line1 =
                    diffDays === 0
                      ? `completed today at ${timeStr}`
                      : diffDays === 1
                        ? 'completed yesterday'
                        : `completed ${diffDays} days ago`;

                  return (
                    <>
                      <Text
                        style={[
                          styles.habitDescription,
                          completed ? styles.completedHabitTitle : null,
                        ]}
                      >
                        {line1}
                      </Text>
                      {count > 1 ? (
                        <Text
                          style={[
                            styles.habitDescription,
                            completed ? styles.completedHabitTitle : null,
                          ]}
                        >
                          {`${count} completions`}
                        </Text>
                      ) : null}
                    </>
                  );
                })()}
              </View>
              <View style={styles.actionsRow}>
                {h.timerLength ? (
                  <TimerButton habit={h} onPress={() => startTimer(h.id)} />
                ) : null}

                <CompleteButton
                  isCompleted={completed}
                  onPress={() => completeHabit(h.id)}
                />
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
    marginBottom: 12,
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
    marginBottom: 12,
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
    // marginVertical: 6,
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
    width: '100%',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  newHabitText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
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
    paddingVertical: 6,
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
    gap: 4,
    height: '100%',
  },
  habitTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  completedHabitTitle: {
    color: colors.primaryText,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowButtonSpacing: {
    marginLeft: 8,
  },
  rowButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.small,
    color: colors.white,
  },
  rowButtonLabel: {
    marginLeft: 6,
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
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  actionButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xsmall,
    color: colors.white,
  },
});

function TimerButton({
  habit,
  onPress,
}: {
  habit: Habit;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: colors.accent }]}
      onPress={onPress}
    >
      <MaterialIcons name="timer" size={20} color={colors.white} />
      <Text style={styles.actionButtonText}>{`${
        habit.timerLength! / 60
      } min`}</Text>
    </TouchableOpacity>
  );
}

function CompleteButton({
  onPress,
  isCompleted,
}: {
  onPress: () => void;
  isCompleted: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={isCompleted}
      style={[
        styles.actionButton,
        { backgroundColor: isCompleted ? colors.darkGray : colors.primary },
      ]}
      onPress={onPress}
    >
      <MaterialIcons name="check" size={20} color={colors.white} />
      {isCompleted ? <Text style={styles.actionButtonText}>Done</Text> : null}
    </TouchableOpacity>
  );
}

export default UnifiedGlassPanel;
