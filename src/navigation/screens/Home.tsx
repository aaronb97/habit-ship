import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateHabitModal } from '../../components/CreateHabitModal';
import { EditHabitModal } from '../../components/EditHabitModal';
import { PlanetSelectionModal } from '../../components/PlanetSelectionModal';
import { Habit, HabitId, useStore } from '../../utils/store';

import { useIsFocused } from '@react-navigation/native';
import { LevelUpListener } from '../../components/LevelUpListener';
import { UnifiedGlassPanel } from '../../components/UnifiedGlassPanel';

export function Home() {
  const isFocused = useIsFocused();

  const { editHabit, addHabit, userPosition, acknowledgeLandingOnHome } =
    useStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlanetModal, setShowPlanetModal] = useState(false);
  const justLanded = useStore((s) => s.justLanded);
  const isLevelUpModalVisible = useStore((s) => s.isLevelUpModalVisible);

  const handleCreate = (habit: {
    title: string;
    description: string;
    timerLength?: number;
  }) => {
    addHabit(habit);
    setShowCreateModal(false);
  };

  const handleEditSave = (
    habitId: HabitId,
    updates: { title: string; description: string; timerLength?: number },
  ) => {
    editHabit(habitId, updates);
    setEditingHabit(null);
  };

  // When user visits Home after landing, acknowledge to clear the Home tab badge
  useEffect(() => {
    if (isFocused && justLanded) {
      acknowledgeLandingOnHome();
    }
  }, [isFocused, justLanded, acknowledgeLandingOnHome]);

  return (
    <>
      <LevelUpListener />
      <SafeAreaView style={styles.container}>
        <View style={styles.centerWrapper}>
          <UnifiedGlassPanel
            onPressPlanetTitle={() => setShowPlanetModal(true)}
            onPressNewHabit={() => setShowCreateModal(true)}
          />
        </View>

        <EditHabitModal
          habit={editingHabit}
          onSave={handleEditSave}
          onClose={() => setEditingHabit(null)}
        />

        <CreateHabitModal
          visible={showCreateModal}
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />

        <PlanetSelectionModal
          visible={
            showPlanetModal || (!userPosition.target && !isLevelUpModalVisible)
          }
          onClose={() => setShowPlanetModal(false)}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
