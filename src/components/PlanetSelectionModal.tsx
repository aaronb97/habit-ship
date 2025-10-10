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
import { usePlanets } from '../hooks/usePlanets';
import { planets } from '../planets';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useIsTraveling, useStore } from '../utils/store';
import { PlanetListItem } from './PlanetListItem';

interface PlanetSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PlanetSelectionModal({
  visible,
  onClose,
}: PlanetSelectionModalProps) {
  const { userPosition, setDestination } = useStore();
  const [selectedPlanet, setSelectedPlanet] = useState(
    userPosition.target?.name || planets[0].name,
  );

  const isTraveling = useIsTraveling();

  const planetsWithDistance = usePlanets();

  const handleStartNewJourney = () => {
    if (isTraveling) {
      Alert.alert(
        'Change Destination',
        'You are currently traveling. Changing your destination will reset your journey. Are you sure you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Change Destination',
            style: 'destructive',
            onPress: () => {
              setDestination(selectedPlanet);
              onClose();
            },
          },
        ],
      );
    } else {
      setDestination(selectedPlanet);
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
          {planetsWithDistance.map(
            ({ planet, distance, disabledReason, isVisited }) => (
              <PlanetListItem
                key={planet.name}
                planet={planet}
                distance={distance}
                isSelected={selectedPlanet === planet.name}
                disabledReason={disabledReason}
                isVisited={isVisited}
                onPress={() => setSelectedPlanet(planet.name)}
              />
            ),
          )}
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
