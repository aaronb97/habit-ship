import { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Habit, HabitId } from '../utils/store';

interface EditHabitModalProps {
  habit: Habit | null;
  onClose: () => void;
  onSave: (
    habitId: HabitId,
    updates: { title: string; description: string; timerLength?: number },
  ) => void;
}

export function EditHabitModal({
  habit,
  onClose,
  onSave,
}: EditHabitModalProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTimerLength, setEditTimerLength] = useState('');

  const isFormValid = editTitle.trim() !== '';

  useEffect(() => {
    if (habit) {
      setEditTitle(habit.title || '');
      setEditDescription(habit.description || '');
      setEditTimerLength(habit.timerLength?.toString() || '');
    }
  }, [habit]);

  const handleSave = () => {
    if (habit && isFormValid) {
      onSave(habit.id, {
        title: editTitle,
        description: editDescription,
        timerLength: editTimerLength
          ? parseInt(editTimerLength, 10)
          : undefined,
      });
    }
  };

  return (
    <Modal
      visible={habit !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Edit Habit</Text>

          <TouchableOpacity disabled={!isFormValid} onPress={handleSave}>
            <Text
              style={[
                styles.headerButtonText,
                styles.headerButtonPrimary,
                !isFormValid && styles.headerButtonDisabled,
              ]}
            >
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder="Habit Title"
            placeholderTextColor={colors.grey}
            value={editTitle}
            onChangeText={setEditTitle}
          />

          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            placeholderTextColor={colors.grey}
            value={editDescription}
            onChangeText={setEditDescription}
          />

          <TextInput
            style={styles.input}
            placeholder="Timer in Minutes (optional)"
            placeholderTextColor={colors.grey}
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
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  modalTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  headerButtonText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
  headerButtonPrimary: {
    fontFamily: fonts.semiBold,
  },
  headerButtonDisabled: {
    color: colors.grey,
  },
  modalContent: {
    padding: 20,
  },
  input: {
    backgroundColor: colors.card,
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
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
