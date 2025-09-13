import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateHabitModal } from '../../components/CreateHabitModal';
import { EditHabitModal } from '../../components/EditHabitModal';
import { HabitItem } from '../../components/HabitItem';
import { ProgressBar } from '../../components/ProgressBar';
import { mountains } from '../../mountains';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { Habit, HabitId, useStore } from '../../utils/store';

function HikeDisplay() {
  const { hike, expendEnergy, clearData } = useStore();

  useEffect(() => {
    const interval = setInterval(() => {
      expendEnergy();
    }, 1000); // Updated to every second for smoother energy decay

    return () => clearInterval(interval);
  }, [expendEnergy]);

  const mountain = mountains.find((m) => m.name === hike?.mountainName);

  if (!mountain) {
    console.error('Encountered invalid mountain, resetting data');
    clearData();
    return null;
  }

  const heightPercentage = (hike?.height || 0) / mountain.height;
  const energyPercentage = (hike?.energy || 0) / 100;

  return (
    <View style={styles.hikeDisplayContainer}>
      <Text style={styles.mountainTitle}>{hike?.mountainName}</Text>
      <Text style={styles.mountainSubtitle}>{mountain.location}</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>
            {`${hike?.height
              .toFixed(1)
              .toLocaleString()} / ${mountain.height.toLocaleString()} ft`}
          </Text>
        </View>
        <ProgressBar progress={heightPercentage} color={colors.primary} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Energy</Text>
          <Text style={styles.progressValue}>
            {`${(energyPercentage * 100).toFixed(0)}%`}
          </Text>
        </View>
        <ProgressBar progress={energyPercentage} color={colors.accent} />
      </View>
    </View>
  );
}

export function Home() {
  const { habits, completeHabit, editHabit, addHabit, startTimer, clearData, resetAllSwipes } =
    useStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.backgroundTouchable}
        activeOpacity={1}
        onPress={resetAllSwipes}
      >
        <FlatList
          data={habits}
          renderItem={({ item }) => (
            <HabitItem
              habit={item}
              onComplete={() => completeHabit(item.id)}
              onEdit={() => setEditingHabit(item)}
              onStartTimer={() => startTimer(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              <HikeDisplay />
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Daily Habits</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                  <Text style={styles.newHabitButtonText}>+ New Habit</Text>
                </TouchableOpacity>
              </View>
            </>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.revertButton}
              onPress={() => clearData()}
            >
              <Text style={styles.revertButtonText}>Revert Setup</Text>
            </TouchableOpacity>
          }
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />
      </TouchableOpacity>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundTouchable: {
    flex: 1,
  },
  listContentContainer: {
    padding: 20,
  },
  hikeDisplayContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mountainTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xlarge,
    color: colors.text,
    textAlign: 'center',
  },
  mountainSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.text,
  },
  progressValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.text,
  },
  newHabitButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
  revertButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  revertButtonText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.grey,
  },
});
