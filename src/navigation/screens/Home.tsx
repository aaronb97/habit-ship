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
import { JourneyDisplay } from '../../components/JourneyDisplay';
import { LevelProgressBar } from '../../components/LevelProgressBar';
import { PlanetSelectionModal } from '../../components/PlanetSelectionModal';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { Habit, HabitId, useStore } from '../../utils/store';

import { useIsFocused } from '@react-navigation/native';

export function Home() {
  const isFocused = useIsFocused();

  const {
    habits,
    editHabit,
    addHabit,
    resetAllSwipes,
    startTimer,
    completeHabit,
    userPosition,
    acknowledgeLandingOnHome,
  } = useStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const justLanded = useStore((s) => s.justLanded);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <LevelProgressBar />
      </View>
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
              onComplete={() =>
                completeHabit(item.id).catch((e) => {
                  console.error(e);
                })
              }
              onEdit={() => setEditingHabit(item)}
              onStartTimer={() => startTimer(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              <JourneyDisplay />
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Daily Habits</Text>
                {habits.length < 5 ? (
                  <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                    <Text style={styles.newHabitButtonText}>+ New Habit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
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

      <PlanetSelectionModal
        visible={!userPosition.target}
        onClose={() => undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'flex-end',
    marginBottom: -16,
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
});
