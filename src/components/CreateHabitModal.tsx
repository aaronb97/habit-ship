import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../styles/theme';

interface CreateHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (habit: {
    title: string;
    description: string;
    timerLength?: number;
  }) => void;
}

export function CreateHabitModal({
  visible,
  onClose,
  onCreate,
}: CreateHabitModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState('');

  const isFormValid = title.trim() !== '';

  const handleCreate = () => {
    if (isFormValid) {
      onCreate({
        title,
        description,
        timerLength: timerLength ? parseInt(timerLength, 10) : undefined,
      });

      // Clear state and close modal
      setTitle('');
      setDescription('');
      setTimerLength('');
      onClose();
    }
  };

  const handleClose = () => {
    // Clear state before closing
    setTitle('');
    setDescription('');
    setTimerLength('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>New Habit</Text>

          <TouchableOpacity disabled={!isFormValid} onPress={handleCreate}>
            <Text
              style={[
                styles.headerButtonText,
                styles.headerButtonPrimary,
                !isFormValid && styles.headerButtonDisabled,
              ]}
            >
              Create
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder="Habit Title (e.g., Morning Run)"
            placeholderTextColor={theme.colors.grey}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            placeholderTextColor={theme.colors.grey}
            value={description}
            onChangeText={setDescription}
          />

          <TextInput
            style={styles.input}
            placeholder="Timer in Minutes (optional)"
            placeholderTextColor={theme.colors.grey}
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
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGrey,
  },
  modalTitle: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.fontSizes.large,
    color: theme.colors.text,
  },
  headerButtonText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.medium,
    color: theme.colors.primary,
  },
  headerButtonPrimary: {
    fontFamily: theme.fonts.semiBold,
  },
  headerButtonDisabled: {
    color: theme.colors.grey,
  },
  modalContent: {
    padding: 20,
  },
  input: {
    backgroundColor: theme.colors.card,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.medium,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
});
