import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditHabitModal } from '../../components/EditHabitModal';
import { Habit, HabitId, useStore } from '../../utils/store';

import { useIsFocused } from '@react-navigation/native';
import { LevelUpListener } from '../../components/LevelUpListener';

export function Home() {
  const isFocused = useIsFocused();

  const { editHabit, acknowledgeLandingOnHome } = useStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const justLanded = useStore((s) => s.justLanded);

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
        <EditHabitModal
          habit={editingHabit}
          onSave={handleEditSave}
          onClose={() => setEditingHabit(null)}
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
