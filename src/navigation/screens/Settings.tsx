import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useStore } from '../../utils/store';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Device from 'expo-device';

/**
 * Settings screen for app preferences.
 * Includes a daily notification toggle and editable local time.
 *
 * Returns: JSX element representing the Settings page.
 */
export function Settings() {
  const { dailyReminderMinutesLocal, setDailyReminderMinutesLocal } = useStore();

  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [requesting, setRequesting] = useState<boolean>(false);

  // Read current permissions to reflect accurate switch state.
  useEffect(() => {
    let cancelled = false;
    void Notifications.getPermissionsAsync()
      .then((p) => {
        if (!cancelled) {
          setPermissionGranted(p.status === 'granted');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionGranted(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Format minutes since midnight into a user-friendly local time string.
   * m: Minutes since midnight [0..1439].
   * Returns: Formatted time like "9:00 PM".
   */
  const fmtTime = (m: number): string => {
    const mm = ((m % 1440) + 1440) % 1440;
    const h24 = Math.floor(mm / 60);
    const mins = mm % 60;
    const am = h24 < 12;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const smins = String(mins).padStart(2, '0');
    return `${h12}:${smins} ${am ? 'AM' : 'PM'}`;
  };

  /**
   * Attempt to enable reminders. Prompts for permissions if needed. Sets
   * default time to 9:00 PM when enabling from off.
   */
  const enableReminders = async () => {
    setRequesting(true);
    try {
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }

      const granted = status === 'granted';
      setPermissionGranted(granted);

      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          Platform.OS === 'ios'
            ? 'Enable notifications in Settings to receive daily reminders.'
            : 'Enable notifications to receive daily reminders.',
        );
        return;
      }

      // Default to 9:00 PM when turning on from off
      const next =
        typeof dailyReminderMinutesLocal === 'number' ? dailyReminderMinutesLocal : 21 * 60;
      await setDailyReminderMinutesLocal(next);
    } finally {
      setRequesting(false);
    }
  };

  /**
   * Disable reminders and cancel any scheduled notifications.
   */
  const disableReminders = async () => {
    await setDailyReminderMinutesLocal('off');
  };

  /**
   * Adjust reminder time by a delta in minutes, wrapping within 0..1439.
   * delta: Signed minutes to add to current time.
   */
  const nudge = async (delta: number) => {
    const base =
      typeof dailyReminderMinutesLocal === 'number' ? dailyReminderMinutesLocal : 21 * 60;
    const next = (((base + delta) % 1440) + 1440) % 1440;
    await setDailyReminderMinutesLocal(next);
  };

  const effectiveOn = permissionGranted && typeof dailyReminderMinutesLocal === 'number';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Daily Reminder</Text>
        <Switch
          value={effectiveOn}
          onValueChange={async (v) => {
            if (v) {
              await enableReminders();
            } else {
              await disableReminders();
            }
          }}
          disabled={requesting}
        />
      </View>

      {effectiveOn && (
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Reminder Time</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Decrease time"
              style={styles.timeBtn}
              onPress={() => {
                void nudge(-15);
              }}
            >
              <FontAwesome5
                name="minus"
                size={14}
                color={colors.accent}
              />
            </TouchableOpacity>

            <Text style={styles.timeValue}>{fmtTime(dailyReminderMinutesLocal!)}</Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Increase time"
              style={styles.timeBtn}
              onPress={() => {
                void nudge(15);
              }}
            >
              <FontAwesome5
                name="plus"
                size={14}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.help}>
            Reminders will not send if you completed all your habits for the day.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingTop: Device.deviceType === Device.DeviceType.TABLET ? 60 : 24,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xxlarge,
    color: colors.primaryText,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.primaryText,
  },
  timeCard: {
    marginTop: 12,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  timeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  timeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  timeValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.accent,
    minWidth: 100,
    textAlign: 'center',
  },
  help: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.text,
    textAlign: 'center',
  },
});
