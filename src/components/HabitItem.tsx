import { MaterialIcons } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTimer } from 'react-timer-hook';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Habit, useStore } from '../utils/store';

type HabitItemProps = {
  habit: Habit;
  onComplete: () => void;
  onEdit: () => void;
  onStartTimer: () => void;
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
  const { activeTimer, cancelTimer } = useStore();
  const isActiveTimer = activeTimer?.habitId === habit.id;

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

  const { minutes, seconds, isRunning, pause, restart } = useTimer({
    expiryTimestamp: getTimerExpiryTimestamp(),
    autoStart: false,
    onExpire: () => {
      cancelTimer();
      presentAlert();
    },
  });

  if (isActiveTimer && !isRunning) {
    restart(getTimerExpiryTimestamp());
  }

  if (!isActiveTimer && isRunning) {
    pause();
  }

  return (
    <TouchableOpacity
      style={[styles.habitItem, isCompleted && styles.completedHabitItem]}
      activeOpacity={0.7}
      onLongPress={onEdit}
    >
      <View style={styles.habitInfo}>
        <Text style={styles.habitTitle}>{habit.title}</Text>

        {habit.description ? (
          <Text style={styles.habitDescription}>{habit.description}</Text>
        ) : null}
      </View>

      <View style={styles.actionsContainer}>
        {isActiveTimer ? (
          <View style={styles.timerContainer}>
            <Text style={styles.timerDisplay}>{`${minutes}:${seconds
              .toString()
              .padStart(2, '0')}`}</Text>

            <TouchableOpacity onPress={cancelTimer}>
              <MaterialIcons name="close" size={24} color={colors.grey} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {habit.timerLength ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onStartTimer}
              >
                <MaterialIcons
                  name="play-arrow"
                  size={24}
                  color={colors.accent}
                />
              </TouchableOpacity>
            ) : null}

            {!isCompleted ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onComplete}
              >
                <MaterialIcons
                  name="check"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  completedHabitItem: {
    backgroundColor: colors.lightGrey,
    borderColor: colors.primary,
  },
  habitInfo: {
    flex: 1,
    marginRight: 16,
  },
  habitTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
    marginBottom: 4,
  },
  habitDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  actionButton: {
    marginLeft: 16,
  },
  timerDisplay: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.primary,
    marginBottom: 4,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
  },
  completeButtonText: {
    color: colors.primary,
  },
  timerButtonText: {
    color: colors.accent,
  },
  cancelButtonText: {
    color: colors.grey,
    fontSize: fontSizes.small,
  },
});
