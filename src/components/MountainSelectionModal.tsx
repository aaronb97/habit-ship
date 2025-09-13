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
import { mountains } from '../mountains';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useStore } from '../utils/store';
import { MountainListItem } from './MountainListItem';
import { Meter } from '../utils/units';

interface MountainSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MountainSelectionModal({
  visible,
  onClose,
}: MountainSelectionModalProps) {
  const { hike, setHike } = useStore();
  const [selectedMountain, setSelectedMountain] = useState(
    hike?.mountainName || mountains[0].name,
  );

  const handleStartNewHike = () => {
    if (!hike) return;

    const currentMountain = mountains.find((m) => m.name === hike.mountainName);
    const hasProgress =
      (hike.height > 0 || hike.energy > 0) &&
      hike.height < (currentMountain?.height || 0);

    if (hasProgress) {
      Alert.alert(
        'Start New Hike',
        'You have progress on your current hike. Starting a new hike will reset your progress to 0. Are you sure you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Start New Hike',
            style: 'destructive',
            onPress: () => {
              setHike({
                height: 0 as Meter,
                energy: 0,
                mountainName: selectedMountain,
              });

              onClose();
            },
          },
        ],
      );
    } else {
      setHike({
        height: 0 as Meter,
        energy: 0,
        mountainName: selectedMountain,
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
          <Text style={styles.title}>Select Mountain</Text>
          <TouchableOpacity onPress={handleStartNewHike}>
            <Text style={styles.startButton}>Start</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {mountains.map((mountain) => (
            <MountainListItem
              key={mountain.name}
              mountain={mountain}
              isSelected={selectedMountain === mountain.name}
              onPress={() => setSelectedMountain(mountain.name)}
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
