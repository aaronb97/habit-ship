import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

export function SetupFirstHabit() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timerLength, setTimerLength] = useState('');

  const isFormComplete = title.trim() !== '';

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          disabled={!isFormComplete}
          title="Next"
          onPress={() => {
            const timer = parseInt(timerLength, 10) || 0;

            navigation.navigate('SetupFirstMountain', {
              habit: {
                title,
                description,
                timerLength: timer,
              },
            });
          }}
        />
      ),
    });

    return () => {
      navigation.setOptions({
        headerRight: undefined,
      });
    };
  }, [description, isFormComplete, navigation, timerLength, title]);

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
});
