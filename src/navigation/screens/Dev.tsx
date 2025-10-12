import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { colors, fonts } from '../../styles/theme';
import { useStore } from '../../utils/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { advanceTime, getCurrentDate } from '../../utils/time';
import { cBodies, Planet } from '../../planets';

export function Dev() {
  const store = useStore();
  const { clearData, quickReset, updateTravelPosition, warpTo } = useStore();

  const handleAdvanceTime = (hours: number) => {
    const { userPosition } = useStore.getState();

    if (!userPosition.target) {
      alert('Not currently traveling. Start a journey first!');
      return;
    }

    // Advance the system time (note: time no longer affects travel distance)
    const millisecondsToAdvance = hours * 3600000;
    advanceTime(millisecondsToAdvance);

    // Keep call for compatibility (now a no-op)
    updateTravelPosition();
  };

  const handleQuickReset = () => {
    quickReset();
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
          <Text style={styles.sectionTitle}>Warp To Planet</Text>
          <View style={styles.buttonGrid}>
            {cBodies
              .filter((b) => b instanceof Planet)
              .map((p) => (
                <TouchableOpacity
                  key={p.name}
                  style={styles.warpButton}
                  onPress={() => warpTo(p.name)}
                >
                  <Text style={styles.warpButtonText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rendering Toggles</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Planet Trails</Text>
            <Switch
              value={!!store.showTrails}
              onValueChange={(v) => store.setShowTrails(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Planet Textures</Text>
            <Switch
              value={!!store.showTextures}
              onValueChange={(v) => store.setShowTextures(v)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Advancement</Text>
          <View style={styles.timeDisplay}>
            <Text style={styles.timeLabel}>Real System Time:</Text>
            <Text style={styles.timeValue}>{new Date().toLocaleString()}</Text>
            <Text style={styles.timeLabel}>Offset Time:</Text>
            <Text style={styles.timeValue}>
              {getCurrentDate().toLocaleString()}
            </Text>
            <Text style={styles.timeLabel}>Time Offset:</Text>
            <Text style={styles.timeValue}>
              {store.timeOffset === 0
                ? 'None'
                : `+${(store.timeOffset / 3600000).toFixed(2)} hours`}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleAdvanceTime(1)}
            >
              <Text style={styles.timeButtonText}>+1h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleAdvanceTime(6)}
            >
              <Text style={styles.timeButtonText}>+6h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleAdvanceTime(12)}
            >
              <Text style={styles.timeButtonText}>+12h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleAdvanceTime(24)}
            >
              <Text style={styles.timeButtonText}>+1d</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleAdvanceTime(8760)}
            >
              <Text style={styles.timeButtonText}>+1y</Text>
            </TouchableOpacity>
          </View>
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
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.white,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeButton: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  warpButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warpButtonText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  timeDisplay: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.primaryText,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginTop: 4,
  },
  timeValue: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.primaryText,
    marginBottom: 4,
  },
});
