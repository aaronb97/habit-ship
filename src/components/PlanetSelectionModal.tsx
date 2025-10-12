import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLandablePlanets } from '../hooks/usePlanets';
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
  const { setDestination } = useStore();
  const isTraveling = useIsTraveling();
  const planetsWithDistance = useLandablePlanets();

  const handleSetDestination = (planetName: string) => {
    if (isTraveling) {
      Alert.alert(
        'Change Destination',
        'You are currently traveling. Changing your destination will reset your progress toward the current destination. Are you sure you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Change Destination',
            style: 'destructive',
            onPress: () => {
              setDestination(planetName);
              onClose();
            },
          },
        ],
      );
    } else {
      Alert.alert('Set Destination', `Set ${planetName} as your destination?`, [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Set Destination',
          onPress: () => {
            setDestination(planetName);
            onClose();
          },
        },
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Planet</Text>
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
                disabledReason={disabledReason}
                isVisited={isVisited}
                onPress={() => handleSetDestination(planet.name)}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
});
