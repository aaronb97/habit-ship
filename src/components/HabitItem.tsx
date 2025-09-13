import { MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTimer } from 'react-timer-hook';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Habit, useStore } from '../utils/store';

type HabitItemProps = {
  habit: Habit;
  onComplete: () => void;
  onEdit: () => void;
  onStartTimer: () => void;
};

const calculateDailyStreak = (completions: string[]): number => {
  if (completions.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completionDates = completions
    .map((completion) => {
      const date = new Date(completion);
      date.setHours(0, 0, 0, 0);
      return date;
    })
    .sort((a, b) => b.getTime() - a.getTime()); // Sort descending (most recent first)

  // Remove duplicates (same day completions)
  const uniqueDates = completionDates.filter(
    (date, index) =>
      index === 0 || date.getTime() !== completionDates[index - 1].getTime(),
  );

  if (uniqueDates.length === 0) return 0;

  const mostRecentCompletion = uniqueDates[0];
  const daysSinceLastCompletion = Math.floor(
    (today.getTime() - mostRecentCompletion.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Don't show streak if the most recent completion was more than 1 day ago
  // (completing today wouldn't increase the streak)
  if (daysSinceLastCompletion > 1) return 0;

  let streak = 0;
  let expectedDate = new Date(today);

  // If the most recent completion was today, start from today
  // If it was yesterday, start from yesterday
  if (daysSinceLastCompletion === 0) {
    expectedDate = new Date(today);
  } else if (daysSinceLastCompletion === 1) {
    expectedDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  }

  for (const completionDate of uniqueDates) {
    if (completionDate.getTime() === expectedDate.getTime()) {
      streak++;
      expectedDate = new Date(expectedDate.getTime() - 24 * 60 * 60 * 1000); // Go back one day
    } else {
      break;
    }
  }

  return streak;
};

const formatLastCompleted = (completions: string[]) => {
  if (completions.length === 0) return null;

  const lastCompletion = new Date(completions[completions.length - 1]);
  const today = new Date();

  if (lastCompletion.toDateString() === today.toDateString()) {
    return `Completed today at ${lastCompletion.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  const diffTime = Math.abs(today.getTime() - lastCompletion.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return 'Last completed: yesterday';
  }

  return `Last completed: ${diffDays} days ago`;
};

const isHabitCompletedToday = (habit: Habit) => {
  if (habit.completions.length === 0) return false;
  const lastCompletion = new Date(
    habit.completions[habit.completions.length - 1],
  );

  const today = new Date();
  return lastCompletion.toDateString() === today.toDateString();
};

const SWIPE_THRESHOLD = -110;

export function HabitItem({
  habit,
  onComplete,
  onEdit,
  onStartTimer,
}: HabitItemProps) {
  const isCompleted = isHabitCompletedToday(habit);
  const lastCompletedText = formatLastCompleted(habit.completions);
  const dailyStreak = calculateDailyStreak(habit.completions);
  const {
    activeTimer,
    cancelTimer,
    removeHabit,
    swipedHabitId,
    setSwipedHabit,
  } = useStore();

  const isActiveTimer = activeTimer?.habitId === habit.id;
  const translateX = useSharedValue(0);
  const isThisHabitSwiped = swipedHabitId === habit.id;

  const resetSwipe = () => {
    translateX.value = withTiming(0);
    setSwipedHabit(undefined);
  };

  // Sync animation with global swipe state
  useEffect(() => {
    if (isThisHabitSwiped) {
      translateX.value = withTiming(SWIPE_THRESHOLD);
    } else {
      translateX.value = withTiming(0);
    }
  }, [isThisHabitSwiped, translateX]);

  const timerProgress = useSharedValue(0);

  const presentAlert = () => {
    if (isCompleted) {
      Alert.alert(
        'Timer Complete',
        `You have already completed your habit: ${habit.title} today!`,
        [{ text: 'OK' }],
      );

      return;
    }

    Alert.alert(
      'Timer Complete',
      `Have you completed your habit: ${habit.title}?`,
      [{ text: 'Yes', onPress: onComplete }, { text: 'Not Yet' }],
    );
  };

  function getTimerExpiryTimestamp() {
    if (!activeTimer) return new Date();
    return new Date(
      new Date(activeTimer.startTime).getTime() +
        habit.timerLength! * 60 * 1000,
    );
  }

  const {
    minutes,
    seconds,
    isRunning,
    pause,
    restart,
    totalMilliseconds,
    hours,
  } = useTimer({
    expiryTimestamp: getTimerExpiryTimestamp(),
    autoStart: false,
    onExpire: () => {
      cancelTimer();
      presentAlert();
    },
  });

  useEffect(() => {
    if (isActiveTimer) {
      const totalSeconds = habit.timerLength! * 60;
      const progress = 1 - (totalMilliseconds - 1000) / (totalSeconds * 1000);
      timerProgress.value = withTiming(progress, {
        duration: 1000,
        easing: Easing.linear,
      });
    } else {
      timerProgress.value = 0;
    }
  }, [
    isActiveTimer,
    minutes,
    seconds,
    habit.timerLength,
    timerProgress,
    totalMilliseconds,
  ]);

  if (isActiveTimer && !isRunning) {
    restart(getTimerExpiryTimestamp());
  }

  const handleDelete = () => {
    removeHabit(habit.id);
  };

  const handleEdit = () => {
    onEdit();

    setTimeout(() => {
      resetSwipe();
    }, 500);
  };

  const handleStartTimer = () => {
    onStartTimer();
    resetSwipe();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = Math.min(
        Math.max(SWIPE_THRESHOLD * 1.1, event.translationX),
        0,
      );
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        translateX.value = withTiming(SWIPE_THRESHOLD);
        runOnJS(setSwipedHabit)(habit.id);
      } else {
        translateX.value = withTiming(0);
        runOnJS(setSwipedHabit)(undefined);
      }
    });

  if (!isActiveTimer && isRunning) {
    pause();
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedWipeStyle = useAnimatedStyle(() => {
    return {
      width: `${timerProgress.value * 100}%`,
    };
  });

  const timerButton = habit.timerLength ? (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: colors.accent }]}
      onPress={handleStartTimer}
    >
      <MaterialIcons name="timer" size={20} color={colors.white} />
      <Text style={styles.actionButtonText}>{`${habit.timerLength} min`}</Text>
    </TouchableOpacity>
  ) : null;

  const renderContent = () => {
    if (isActiveTimer) {
      return (
        <View style={styles.timerContainer}>
          <View style={styles.invisibleButton} />
          <View style={styles.timerDisplay}>
            <Text style={styles.timerText}>{habit.title}</Text>
            <Text style={styles.timerText}>{`${minutes + hours * 60}:${seconds
              .toString()
              .padStart(2, '0')}`}</Text>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={cancelTimer}>
            <MaterialIcons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      );
    }

    if (isCompleted) {
      return (
        <View style={styles.completedContainer}>
          <View style={styles.completedHabitInfo}>
            <View style={styles.habitTitleRow}>
              <Text style={[styles.habitTitle, styles.completedHabitTitle]}>
                {habit.title}
              </Text>
              {dailyStreak > 0 && (
                <View style={styles.streakBadge}>
                  <MaterialIcons
                    name="local-fire-department"
                    size={16}
                    color={colors.white}
                  />
                  <Text style={[styles.streakText, styles.completedStreakText]}>
                    {dailyStreak}
                  </Text>
                </View>
              )}
            </View>
            {lastCompletedText ? (
              <Text style={styles.completedTodayText}>{lastCompletedText}</Text>
            ) : null}
          </View>
          {timerButton}
        </View>
      );
    }

    return (
      <>
        <View style={styles.habitInfo}>
          <View style={styles.habitTitleRow}>
            <Text style={styles.habitTitle}>{habit.title}</Text>
            {dailyStreak > 0 && (
              <View style={styles.streakBadge}>
                <MaterialIcons
                  name="local-fire-department"
                  size={16}
                  color={colors.accent}
                />
                <Text style={styles.streakText}>{dailyStreak}</Text>
              </View>
            )}
          </View>
          {habit.description ? (
            <Text style={styles.habitDescription}>{habit.description}</Text>
          ) : null}
          {lastCompletedText ? (
            <Text style={styles.lastCompletedText}>{lastCompletedText}</Text>
          ) : null}
        </View>
        <View style={styles.actionsContainer}>
          {timerButton}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={onComplete}
          >
            <MaterialIcons name="check" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <GestureHandlerRootView>
      <View style={styles.container}>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.swipeButton, styles.editButton]}
            onPress={handleEdit}
          >
            <MaterialIcons name="edit" size={24} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <MaterialIcons name="delete" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.animatedContainer, animatedStyle]}>
            <TouchableOpacity
              activeOpacity={1}
              delayLongPress={200}
              style={[
                styles.habitItem,
                isCompleted && styles.completedHabitItem,
                isActiveTimer && styles.activeTimerHabitItem,
              ]}
              onLongPress={handleEdit}
            >
              <Animated.View style={[styles.timerWipe, animatedWipeStyle]} />
              <View style={styles.contentContainer}>{renderContent()}</View>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedContainer: {
    width: '100%',
  },
  buttonsContainer: {
    position: 'absolute',
    right: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  editButton: {
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  habitItem: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    height: 64,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentContainer: {
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeTimerHabitItem: {
    backgroundColor: colors.backgroundDarker,
  },
  completedHabitItem: {
    backgroundColor: colors.primary,
  },
  habitInfo: {
    flex: 1,
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  habitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarker,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  streakText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.small,
    color: colors.accent,
    marginLeft: 4,
  },
  completedStreakText: {
    color: colors.white,
  },
  completedHabitInfo: {
    flex: 1,
  },
  habitTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  completedHabitTitle: {
    color: colors.white,
  },
  lastCompletedText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.grey,
    marginTop: 4,
  },
  completedTodayText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.white,
    marginTop: 4,
  },
  habitDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  actionButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xsmall,
    color: colors.white,
  },
  timerContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  timerDisplay: {
    flexGrow: 1,
  },
  timerText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.white,
    textAlign: 'center',
  },
  cancelButton: {
    width: 40,
    padding: 8,
  },
  invisibleButton: {
    width: 40,
  },
  completedContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerWipe: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
});
