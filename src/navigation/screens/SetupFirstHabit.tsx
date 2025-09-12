import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../../utils/store';

export function SetupFirstHabit() {
  const { addHabit } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState('');

  const navigate = useNavigation();

  const handleAddHabit = () => {
    const timer = parseInt(timerLength, 10) || 0;
    addHabit({
      title,
      description,
      timerLength: timer,
    });
  };

  const isFormComplete = title.trim() !== '';

  const handleAddHabitAndNext = () => {
    if (isFormComplete) {
      handleAddHabit();
      navigate.reset({
        index: 0,
        routes: [{ name: 'SetupFirstMountain' }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>
        Begin by setting up your first habit to track.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Habit Title"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
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

      <View style={styles.button}>
        <Button
          disabled={!isFormComplete}
          title="Next"
          onPress={handleAddHabitAndNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paragraph: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '80%',
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  button: {
    marginTop: 10,
  },
});
