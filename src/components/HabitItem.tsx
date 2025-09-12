import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Habit, useStore } from '../utils/store';
import { useEffect, useState } from 'react';

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
  const [timeLeft, setTimeLeft] = useState<string>('');

  const isActiveTimer = activeTimer?.habitId === habit.id;

  useEffect(() => {
    function handleTimeLeft() {
      if (!isActiveTimer || !habit.timerLength) return;

      const startTime = new Date(activeTimer.startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, habit.timerLength! * 60 - elapsed);

      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      setTimeLeft(
        `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`,
      );
    }

    handleTimeLeft();

    const interval = setInterval(handleTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [isActiveTimer, activeTimer?.startTime, habit.timerLength]);

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
          <Text style={styles.timerDisplay}>{timeLeft}</Text>
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
