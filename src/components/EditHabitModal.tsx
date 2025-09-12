import { Text } from '@react-navigation/elements';
import { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Habit, HabitId } from '../utils/store';

interface EditHabitModalProps {
  habit: Habit | null;
  onClose: () => void;
  onSave: (
    habitId: HabitId,
    updates: { title: string; description: string; timerLength?: number },
  ) => void;
}

export function EditHabitModal({ habit, onClose, onSave }: EditHabitModalProps) {
  const [editTitle, setEditTitle] = useState(habit?.title || '');
  const [editDescription, setEditDescription] = useState(
    habit?.description || '',
  );

  const [editTimerLength, setEditTimerLength] = useState(
    habit?.timerLength?.toString() || '',
  );

  useEffect(() => {
    setEditTitle(habit?.title || '');
    setEditDescription(habit?.description || '');
    setEditTimerLength(habit?.timerLength?.toString() || '');
  }, [habit]);

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

const styles = StyleSheet.create({
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
