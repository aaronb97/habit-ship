import { useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { mountains } from '../../mountains';
import { useStore } from '../../utils/store';

export function SetupFirstMountain() {
  const { setIsSetupFinished } = useStore();
  const [selectedMountain, setSelectedMountain] = useState(mountains[0].name);

  const setHike = useStore((state) => state.setHike);

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>Select your first mountain to climb:</Text>

      <ScrollView style={styles.scrollView}>
        {mountains.map((mountain) => (
          <TouchableOpacity
            key={mountain.name}
            style={[
              styles.mountainBox,
              selectedMountain === mountain.name && styles.selectedMountainBox,
            ]}
            onPress={() => setSelectedMountain(mountain.name)}
          >
            <Text style={styles.mountainName}>{mountain.name}</Text>

            <Text style={styles.mountainInfo}>
              Location: {mountain.location}
            </Text>

            <Text style={styles.mountainInfo}>
              Height:{' '}

              {(mountain.height * 3.28084).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{' '}
              ft
            </Text>

            <Text style={styles.mountainInfo}>{mountain.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Button
        title="Finish setup"
        onPress={() => {
          setHike({
            height: 0,
            energy: 0,
            mountainName: selectedMountain,
          });

          setIsSetupFinished(true);
        }}
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
  scrollView: {
    width: '100%',
    marginBottom: 20,
  },
  mountainBox: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    margin: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectedMountainBox: {
    borderColor: '#007bff',
    borderWidth: 2,
  },
  mountainName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  mountainInfo: {
    fontSize: 14,
    marginBottom: 3,
  },
});
