import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTimer } from 'react-timer-hook';
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

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return lastCompletion > yesterday;
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
        [
          {
            text: 'OK',
          },
        ],
      );

      return;
    }

    Alert.alert(
      'Timer Complete',
      `Have you completed your habit: ${habit.title}?`,
      [
        {
          text: 'Yes',
          onPress: () => {
            onComplete();
          },
        },
        {
          text: 'Not Yet',
        },
      ],
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
      onLongPress={onEdit}
    >
      <View style={styles.habitInfo}>
        <Text style={styles.habitTitle}>{habit.title}</Text>

        {habit.description && (
          <Text style={styles.habitDescription}>{habit.description}</Text>
        )}
      </View>

      {isActiveTimer && (
        <View style={styles.timerContainer}>
          <Text style={styles.timerDisplay}>{`${minutes}:${seconds
            .toString()
            .padStart(2, '0')}`}</Text>

          <TouchableOpacity style={styles.cancelButton} onPress={cancelTimer}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {habit.timerLength && !isActiveTimer && (
        <TouchableOpacity style={styles.timerButton} onPress={onStartTimer}>
          <Text style={styles.buttonText}>Start Timer</Text>
        </TouchableOpacity>
      )}

      {!isCompleted && !isActiveTimer && (
        <TouchableOpacity style={styles.completeButton} onPress={onComplete}>
          <Text style={styles.buttonText}>✓ Complete</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedHabitItem: {
    backgroundColor: '#f0f9f0',
    borderColor: '#4caf50',
  },
  habitInfo: {
    flex: 1,
    marginRight: 10,
  },
  habitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  habitDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timerContainer: {
    alignItems: 'center',
    gap: 8,
  },
  completeButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timerButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timerDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
