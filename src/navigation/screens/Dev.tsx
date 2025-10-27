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
import { advanceTime, useGetCurrentDate } from '../../utils/time';
import { cBodies } from '../../planets';
import { getXPToNextLevel } from '../../utils/experience';
import { ALL_SKIN_IDS } from '../../utils/skins';

export function Dev() {
  const store = useStore();
  const { clearData, quickReset, warpTo } = useStore();
  const getCurrentDate = useGetCurrentDate();

  const handleAdvanceTime = (hours: number) => {
    // Advance the system time (note: time no longer affects travel distance)
    const millisecondsToAdvance = hours * 3600000;
    advanceTime(millisecondsToAdvance);
  };

  const handleQuickReset = () => {
    quickReset();
  };

  const handleLevelUpOnce = () => {
    const { totalXP, addXP } = useStore.getState();
    const xpNeeded = getXPToNextLevel(totalXP);
    if (xpNeeded > 0) {
      addXP(xpNeeded, 'habit_completion');
    }
  };

  const handleLevelUpBy = (levels: number) => {
    let { totalXP } = useStore.getState();
    const { addXP } = useStore.getState();
    for (let i = 0; i < levels; i++) {
      const xpNeeded = getXPToNextLevel(totalXP);
      if (xpNeeded <= 0) break;
      addXP(xpNeeded, 'habit_completion');
      totalXP += xpNeeded;
    }
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
            style={styles.button}
            onPress={() => store.unlockAllSkins()}
          >
            <Text style={styles.buttonText}>Unlock All Skins</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleLevelUpOnce}>
            <Text style={styles.buttonText}>Level +1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleLevelUpBy(5)}
          >
            <Text style={styles.buttonText}>Level +5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleLevelUpBy(10)}
          >
            <Text style={styles.buttonText}>Level +10</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleLevelUpBy(20)}
          >
            <Text style={styles.buttonText}>Level +20</Text>
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
            {cBodies.map((p) => (
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
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Planet/Body Outlines</Text>
            <Switch
              value={!!store.outlinesBodiesEnabled}
              onValueChange={(v) => store.setOutlinesBodiesEnabled(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Rocket Outline</Text>
            <Switch
              value={!!store.outlinesRocketEnabled}
              onValueChange={(v) => store.setOutlinesRocketEnabled(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show All Rockets (DB)</Text>
            <Switch
              value={!!store.showAllRockets}
              onValueChange={(v) => store.setShowAllRockets(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Skip Rocket Animation</Text>
            <Switch
              value={!!store.skipRocketAnimation}
              onValueChange={(v) => store.setSkipRocketAnimation(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Debug Overlay</Text>
            <Switch
              value={!!store.showDebugOverlay}
              onValueChange={(v) => store.setShowDebugOverlay(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Unlock All Skins</Text>
            <Switch
              value={store.unlockedSkins.length === ALL_SKIN_IDS.length}
              onValueChange={(v) =>
                v ? store.unlockAllSkins() : store.lockSkinsToDefault()
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tilt-Shift (Miniature)</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enabled</Text>
            <Switch
              value={!!store.tiltShiftEnabled}
              onValueChange={(v) => store.setTiltShiftEnabled(v)}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              Focus: {store.tiltShiftFocus.toFixed(2)}
            </Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  store.setTiltShiftFocus(store.tiltShiftFocus - 0.02)
                }
              >
                <Text style={styles.stepperText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  store.setTiltShiftFocus(store.tiltShiftFocus + 0.02)
                }
              >
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              Range: {store.tiltShiftRange.toFixed(2)}
            </Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  store.setTiltShiftRange(store.tiltShiftRange - 0.02)
                }
              >
                <Text style={styles.stepperText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  store.setTiltShiftRange(store.tiltShiftRange + 0.02)
                }
              >
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              Feather: {store.tiltShiftFeather.toFixed(2)}
            </Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  store.setTiltShiftFeather(store.tiltShiftFeather - 0.02)
                }
              >
                <Text style={styles.stepperText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  store.setTiltShiftFeather(store.tiltShiftFeather + 0.02)
                }
              >
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Blur: {store.tiltShiftBlur}</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => store.setTiltShiftBlur(store.tiltShiftBlur - 1)}
              >
                <Text style={styles.stepperText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => store.setTiltShiftBlur(store.tiltShiftBlur + 1)}
              >
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 16,
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
