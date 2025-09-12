import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Habit } from '../utils/store';

type HabitItemProps = {
  habit: Habit;
  onComplete: () => void;
  onEdit: () => void;
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

export function HabitItem({ habit, onComplete, onEdit }: HabitItemProps) {
  const isCompleted = isHabitCompletedToday(habit);
  
  return (
    <TouchableOpacity
      style={[
        styles.habitItem,
        isCompleted && styles.completedHabitItem,
      ]}
      onLongPress={onEdit}
    >
      <View style={styles.habitInfo}>
        <Text style={styles.habitTitle}>{habit.title}</Text>

        {habit.description && (
          <Text style={styles.habitDescription}>
            {habit.description}
          </Text>
        )}
      </View>

      {!isCompleted && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={onComplete}
        >
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
  completeButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
