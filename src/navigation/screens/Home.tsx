import { Button, Text } from '@react-navigation/elements';
import { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { mountains } from '../../mountains';
import { Habit, HabitId , useStore } from '../../utils/store';

interface EditHabitModalProps {
  habit: Habit | null;
  onClose: () => void;
  onSave: (
    habitId: HabitId,
    updates: { title: string; description: string; timerLength?: number },
  ) => void;
}

function EditHabitModal({ habit, onClose, onSave }: EditHabitModalProps) {
  const [editTitle, setEditTitle] = useState(habit?.title || '');
  const [editDescription, setEditDescription] = useState(
    habit?.description || '',
  );

  const [editTimerLength, setEditTimerLength] = useState(
    habit?.timerLength?.toString() || '',
  );

  const handleSave = () => {
    if (habit) {
      onSave(habit.id, {
        title: editTitle,
        description: editDescription,
        timerLength: editTimerLength
          ? parseInt(editTimerLength, 10)
          : undefined,
      });
    }
  };

  const handleClose = () => {
    setEditTitle('');
    setEditDescription('');
    setEditTimerLength('');
    onClose();
  };

  return (
    <Modal
      visible={habit !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Edit Habit</Text>

          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.modalSaveButton}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder="Habit Title"
            value={editTitle}
            onChangeText={setEditTitle}
          />

          <TextInput
            multiline
            style={styles.input}
            placeholder="Description"
            value={editDescription}
            onChangeText={setEditDescription}
          />

          <TextInput
            style={styles.input}
            placeholder="Timer Length (minutes)"
            value={editTimerLength}
            keyboardType="numeric"
            onChangeText={setEditTimerLength}
          />
        </View>
      </View>
    </Modal>
  );
}

function HikeDisplay() {
  const { hike, expendEnergy } = useStore();

  useEffect(() => {
    const interval = setInterval(() => {
      expendEnergy();
    }, 100);

    return () => clearInterval(interval);
  }, [expendEnergy]);

  const mountainHeight = mountains.find(
    (mountain) => mountain.name === hike?.mountainName,
  )!.height;

  return (
    <View style={styles.hikeSection}>
      <Text style={styles.sectionTitle}>Current Hike</Text>

      <Text>Mountain: {hike?.mountainName}</Text>

      <Text>
        Height: {((hike?.height || 0) * 3.28084).toFixed(1)} ft (

        {(((hike?.height || 0) / mountainHeight) * 100).toFixed(1)}%)
      </Text>

      <Text>Energy: {hike?.energy.toFixed(1)}</Text>
    </View>
  );
}

export function Home() {
  const { clearData, habits, completeHabit, editHabit } = useStore();
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const isHabitCompletedToday = (habit: Habit) => {
    if (habit.completions.length === 0) return false;
    const lastCompletion = new Date(
      habit.completions[habit.completions.length - 1],
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return lastCompletion > yesterday;
  };

  const handleEditSave = (
    habitId: HabitId,
    updates: { title: string; description: string; timerLength?: number },
  ) => {
    editHabit(habitId, updates);
    setEditingHabit(null);
  };

  return (
    <View style={styles.container}>
      <HikeDisplay />

      <View style={styles.habitsSection}>
        <Text style={styles.sectionTitle}>Habits</Text>

        {habits.map((habit) => {
          const isCompleted = isHabitCompletedToday(habit);
          return (
            <TouchableOpacity
              key={habit.id}
              style={[
                styles.habitItem,
                isCompleted && styles.completedHabitItem,
              ]}
              onLongPress={() => setEditingHabit(habit)}
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
                  onPress={() => completeHabit(habit.id)}
                >
                  <Text style={styles.buttonText}>✓ Complete</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Button onPress={() => clearData()}>Revert Setup</Button>

      <EditHabitModal
        habit={editingHabit}
        onClose={() => setEditingHabit(null)}
        onSave={handleEditSave}
      />
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
  completedButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  completedButtonText: {
    color: 'white',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalSaveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
});
