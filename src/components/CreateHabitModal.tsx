import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import TimerSelection from './TimerSelection';

interface CreateHabitModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (habit: {
    title: string;
    description: string;
    timerLength?: number; // in seconds
  }) => void;
}

export function CreateHabitModal({
  visible,
  onClose,
  onCreate,
}: CreateHabitModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState(0);

  const isFormValid = title.trim() !== '';

  const handleCreate = () => {
    if (isFormValid) {
      onCreate({
        title,
        description,
        timerLength: timerLength > 0 ? timerLength : undefined,
      });

      // Clear state and close modal
      setTitle('');
      setDescription('');
      setTimerLength(0);
      onClose();
    }
  };

  const handleClose = () => {
    // Clear state before closing
    setTitle('');
    setDescription('');
    setTimerLength(0);
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
            placeholderTextColor={colors.grey}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            placeholderTextColor={colors.grey}
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Timer</Text>
            <Text style={styles.subLabel}>(optional) </Text>
          </View>

          <TimerSelection onTimerChange={setTimerLength} />
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
    borderBottomColor: colors.darkGray,
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
  labelContainer: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  subLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
  modalContent: {
    padding: 20,
  },
  input: {
    backgroundColor: colors.card,
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.text,
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
