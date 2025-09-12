import { Button, Text } from '@react-navigation/elements';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useStore } from '../../utils/store';
import { Habit } from '../../utils/store';

export function Home() {
  const { clearData, habits, hike, completeHabit } = useStore();

  const isHabitCompletedToday = (habit: Habit) => {
    if (habit.completions.length === 0) return false;
    const lastCompletion = new Date(
      habit.completions[habit.completions.length - 1],
    );
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return lastCompletion > yesterday;
  };

  return (
    <View style={styles.container}>
      {hike && (
        <View style={styles.hikeSection}>
          <Text style={styles.sectionTitle}>Current Hike</Text>
          <Text>Mountain: {hike.mountainName}</Text>
          <Text>Height: {hike.height} ft</Text>
        </View>
      )}

      <View style={styles.habitsSection}>
        <Text style={styles.sectionTitle}>Habits</Text>
        {habits.map((habit) => {
          const isCompleted = isHabitCompletedToday(habit);
          return (
            <View
              key={habit.id}
              style={[
                styles.habitItem,
                isCompleted && styles.completedHabitItem,
              ]}
            >
              <TouchableOpacity
                style={[styles.checkbox, isCompleted && styles.checkedCheckbox]}
                onPress={() => !isCompleted && completeHabit(habit.id)}
                disabled={isCompleted}
              >
                <Text style={styles.checkmark}>{isCompleted ? '✓' : ''}</Text>
              </TouchableOpacity>
              <View style={styles.habitInfo}>
                <Text style={styles.habitTitle}>{habit.title}</Text>
                {habit.description && (
                  <Text style={styles.habitDescription}>
                    {habit.description}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Button onPress={() => clearData()}>Revert Setup</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  hikeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  habitsSection: {
    width: '100%',
    marginBottom: 20,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#28a745',
    backgroundColor: '#28a745',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  checkmark: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  habitInfo: {
    flex: 1,
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
});
