import { Text } from '@react-navigation/elements';
import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Habit } from '../utils/store';

interface CreateHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (habit: { title: string; description: string; timerLength?: number }) => void;
}

export function CreateHabitModal({ visible, onClose, onCreate }: CreateHabitModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState('');

  const handleCreate = () => {
    if (title.trim()) {
      onCreate({
        title,
        description,
        timerLength: timerLength ? parseInt(timerLength, 10) : undefined,
      });
      setTitle('');
      setDescription('');
      setTimerLength('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Create New Habit</Text>

          <TouchableOpacity onPress={handleCreate}>
            <Text style={styles.modalSaveButton}>Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder="Habit Title"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <TextInput
            multiline
            style={styles.input}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
          />

          <TextInput
            style={styles.input}
            placeholder="Timer Length (minutes)"
            value={timerLength}
            keyboardType="numeric"
            onChangeText={setTimerLength}
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
