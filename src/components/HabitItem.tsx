import { MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
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

export function HabitItem({
  habit,
  onComplete,
  onEdit,
  onStartTimer,
}: HabitItemProps) {
  const isCompleted = isHabitCompletedToday(habit);
  const lastCompletedText = formatLastCompleted(habit.completions);
  const { activeTimer, cancelTimer } = useStore();
  const isActiveTimer = activeTimer?.habitId === habit.id;

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

  const { minutes, seconds, isRunning, pause, restart, totalMilliseconds } =
    useTimer({
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

  if (!isActiveTimer && isRunning) {
    pause();
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${timerProgress.value * 100}%`,
    };
  });

  const timerButton = (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: colors.accent }]}
      onPress={onStartTimer}
    >
      <MaterialIcons name="timer" size={24} color={colors.white} />
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (isActiveTimer) {
      return (
        <View style={styles.timerContainer}>
          <View style={styles.invisibleButton} />
          <Text style={styles.timerDisplay}>{`${minutes}:${seconds
            .toString()
            .padStart(2, '0')}`}</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={cancelTimer}>
            <MaterialIcons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      );
    }

    if (isCompleted) {
      return (
        <View style={styles.completedContainer}>
          <View>
            <Text style={[styles.habitTitle, styles.completedHabitTitle]}>
              {habit.title}
            </Text>
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
          <Text style={styles.habitTitle}>{habit.title}</Text>
          {habit.description ? (
            <Text style={styles.habitDescription}>{habit.description}</Text>
          ) : null}
          {lastCompletedText ? (
            <Text style={styles.lastCompletedText}>{lastCompletedText}</Text>
          ) : null}
        </View>
        <View style={styles.actionsContainer}>
          {habit.timerLength ? timerButton : null}
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
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.habitItem,
        isCompleted && styles.completedHabitItem,
        isActiveTimer && styles.activeTimerHabitItem,
      ]}
      onLongPress={onEdit}
    >
      <Animated.View style={[styles.timerWipe, animatedStyle]} />
      <View style={styles.contentContainer}>{renderContent()}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  habitItem: {
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentContainer: {
    padding: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
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
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.white,
    flex: 1,
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
