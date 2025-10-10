import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, fonts } from '../../styles/theme';
import { useStore, HabitId } from '../../utils/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { moon } from '../../planets';

export function Dev() {
  const store = useStore();
  const { clearData } = useStore();

  const handleQuickReset = () => {
    useStore.setState({
      isSetupFinished: true,
      habits: [
        {
          id: '0' as HabitId,
          title: 'Morning Meditation',
          description: 'Sample description',
          completions: [],
          timerLength: 600,
        },
      ],
      userPosition: {
        currentLocation: 'Earth',
        speed: 0,
        target: {
          name: 'The Moon',
          position: moon.getCurrentPosition(),
        },
      },
      completedPlanets: ['Earth'],
      userLevel: {
        level: 1,
        currentXP: 0,
        totalXP: 0,
      },
      xpHistory: [],
      idCount: 1,
      swipedHabitId: undefined,
      activeTimer: undefined,
      lastUpdateTime: undefined,
      planetLandedNotificationId: undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Development Tools</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.button} onPress={handleQuickReset}>
            <Text style={styles.buttonText}>
              Quick Reset (Home with Default Habit)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={() => clearData()}
          >
            <Text style={[styles.buttonText, styles.dangerButtonText]}>
              Revert Setup (Clear All Data)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store State</Text>
          <Text style={styles.code}>{JSON.stringify(store, null, 2)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.primaryText,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.primaryText,
    marginBottom: 10,
  },
  code: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.card,
    padding: 15,
    borderRadius: 8,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.white,
  },
});
