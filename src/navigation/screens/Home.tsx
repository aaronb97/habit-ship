import { Button, Text } from '@react-navigation/elements';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CreateHabitModal } from '../../components/CreateHabitModal';
import { EditHabitModal } from '../../components/EditHabitModal';
import { HabitItem } from '../../components/HabitItem';
import { mountains } from '../../mountains';
import { Habit, HabitId, useStore } from '../../utils/store';

function HikeDisplay() {
  const { hike, expendEnergy, clearData } = useStore();

  useEffect(() => {
    const interval = setInterval(() => {
      expendEnergy();
    }, 100);

    return () => clearInterval(interval);
  }, [expendEnergy]);

  const mountainHeight = mountains.find(
    (mountain) => mountain.name === hike?.mountainName,
  )?.height;

  if (!mountainHeight) {
    console.error('encountered invalid mountain height, resetting data');
    clearData();
    return;
  }

  const heightInFeet = ((hike?.height || 0) * 3.28084).toFixed(1);
  const heightPercentage = (
    ((hike?.height || 0) / mountainHeight) *
    100
  ).toFixed(1);

  const heightString = `${heightInFeet} ft (${heightPercentage}%)`;

  return (
    <View style={styles.hikeSection}>
      <Text style={styles.sectionTitle}>Current Hike</Text>

      <Text>Mountain: {hike?.mountainName}</Text>

      <Text>{heightString}</Text>

      <Text>Energy: {hike?.energy.toFixed(1)}</Text>
    </View>
  );
}

export function Home() {
  const { clearData, habits, completeHabit, editHabit, addHabit, startTimer } =
    useStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateNewHabit = () => {
    setShowCreateModal(true);
  };

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

  const handleTimerStart = (habitId: HabitId) => {
    startTimer(habitId);
  };

  return (
    <View style={styles.container}>
      <HikeDisplay />

      <View style={styles.habitsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Habits</Text>

          <Button onPress={handleCreateNewHabit}>+ New Habit</Button>
        </View>

        {habits.map((habit) => (
          <HabitItem
            key={habit.id}
            habit={habit}
            onComplete={() => completeHabit(habit.id)}
            onEdit={() => setEditingHabit(habit)}
            onStartTimer={() => handleTimerStart(habit.id)}
          />
        ))}
      </View>

      <Button onPress={() => clearData()}>Revert Setup</Button>

      <EditHabitModal
        habit={editingHabit}
        onClose={() => setEditingHabit(null)}
        onSave={handleEditSave}
      />

      <CreateHabitModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  hikeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  habitsSection: {
    width: '100%',
    marginBottom: 20,
  },
});
