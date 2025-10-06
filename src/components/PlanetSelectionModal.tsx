import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { planets } from '../planets';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useStore } from '../utils/store';
import { PlanetListItem } from './PlanetListItem';
import { Meter } from '../utils/units';

interface PlanetSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PlanetSelectionModal({
  visible,
  onClose,
}: PlanetSelectionModalProps) {
  const { journey, setJourney } = useStore();
  const [selectedPlanet, setSelectedPlanet] = useState(
    journey?.planetName || planets[0].name,
  );

  const handleStartNewJourney = () => {
    if (!journey) return;

    const currentPlanet = planets.find((p) => p.name === journey.planetName);
    const hasProgress =
      (journey.distance > 0 || journey.energy > 0) &&
      journey.distance < (currentPlanet?.distance || 0);

    if (hasProgress) {
      Alert.alert(
        'Start New Journey',
        'You have progress on your current journey. Starting a new journey will reset your progress to 0. Are you sure you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Start New Journey',
            style: 'destructive',
            onPress: () => {
              setJourney({
                distance: 0 as Meter,
                energy: 0,
                planetName: selectedPlanet,
              });

              onClose();
            },
          },
        ],
      );
    } else {
      setJourney({
        distance: 0 as Meter,
        energy: 0,
        planetName: selectedPlanet,
      });

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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Planet</Text>
          <TouchableOpacity onPress={handleStartNewJourney}>
            <Text style={styles.startButton}>Start</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {planets.map((planet) => (
            <PlanetListItem
              key={planet.name}
              planet={planet}
              isSelected={selectedPlanet === planet.name}
              onPress={() => setSelectedPlanet(planet.name)}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  cancelButton: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
  startButton: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
});
