import * as Notifications from 'expo-notifications';
import { getCurrentDate } from './time';
import * as Sentry from '@sentry/react-native';
import { useStore, type Habit } from './store';

/**
 * Data payload for daily reminder notifications to allow selective cancellation.
 *
 * - type: Discriminator to identify daily reminders.
 * - dateKey: Local date string (YYYY-MM-DD) for the scheduled reminder.
 */
export type DailyReminderData = {
  type: 'dailyReminder';
  dateKey: string;
};

/**
 * Format a Date into a local YYYY-MM-DD string used as a stable key per day.
 *
 * date: The Date to format.
 */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if and only if every habit has at least one completion on the
 * given local calendar day. If there are no habits, returns false so that we
 * continue to include today's reminder by default.
 *
 * habits: List of habits to evaluate.
 * now: Local reference date (usually current time).
 * Returns: True when all habits are completed today; false otherwise.
 */
export function areAllHabitsCompletedToday(habits: readonly Habit[], now: Date): boolean {
  if (habits.length === 0) {
    return false;
  }

  const todayKey = now.toDateString();
  return habits.every((h) => h.completions.some((ts) => new Date(ts).toDateString() === todayKey));
}

/**
 * Determines if we should include a reminder for today (i.e., schedule one for
 * the remaining part of today), based on whether all habits are already
 * completed today.
 *
 * habits: List of habits.
 * now: Local reference date.
 * Returns: True if we should include today's reminder; false if all habits are done.
 */
export function shouldIncludeTodayReminder(habits: readonly Habit[], now: Date): boolean {
  return !areAllHabitsCompletedToday(habits, now);
}

/**
 * Returns a Date set to a specific local time (hours:minutes) on the same
 * calendar day as the input.
 *
 * date: Base date to copy calendar fields from.
 * minutesSinceMidnight: Time-of-day to set, in local minutes since midnight (0..1439).
 * Returns: New Date instance at the requested local time for the same day.
 */
function atLocalTime(date: Date, minutesSinceMidnight: number): Date {
  const d = new Date(date);
  const hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Compute a list of upcoming local-time occurrences.
 * If includeToday is true and the local time is still in the future, today is
 * included; otherwise start from tomorrow.
 *
 * minutesSinceMidnight: Target local time in minutes since midnight.
 * count: Number of dates to produce.
 * now: Reference time (usually current time).
 * includeToday: Whether to include today's occurrence if it's still upcoming.
 * Returns: List of Date objects at the requested time for consecutive days.
 */
function getUpcomingLocalTimeDates(
  minutesSinceMidnight: number,
  count: number,
  now: Date,
  includeToday: boolean,
): Date[] {
  const results: Date[] = [];
  const todayAt = atLocalTime(now, minutesSinceMidnight);
  const tomorrowAt = atLocalTime(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    minutesSinceMidnight,
  );

  const startDate = includeToday && todayAt.getTime() > now.getTime() ? todayAt : tomorrowAt;

  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    results.push(d);
  }

  return results;
}

/**
 * Cancel all scheduled notifications created by the daily reminder system.
 * Uses the content.data.type discriminator to avoid touching unrelated notifications.
 */
/**
 * Cancel all scheduled notifications created by the daily reminder system.
 * Uses the content.data.type discriminator to avoid touching unrelated notifications.
 *
 * Returns: Promise that resolves after cancellations complete.
 */
export async function cancelAllDailyReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const daily = scheduled.filter((req) => {
    const data = req.content.data as unknown;
    if (data && typeof data === 'object') {
      const t = (data as Record<string, unknown>).type;
      return t === 'dailyReminder';
    }

    return false;
  });

  await Promise.all(
    daily.map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier)),
  );
}

/**
 * Cancel today's daily reminder (if any) and then log all scheduled notifications.
 */
export async function cancelTodayDailyReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const todayKey = formatDateKey(getCurrentDate());

    const toCancel = scheduled.filter((req) => {
      const data = req.content.data as unknown;
      if (data && typeof data === 'object') {
        const r = data as Record<string, unknown>;
        return r.type === 'dailyReminder' && r.dateKey === todayKey;
      }

      return false;
    });

    await Promise.all(
      toCancel.map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier)),
    );
  } catch (e) {
    console.warn('cancelTodayDailyReminder failed', e);
  } finally {
    await logScheduledNotifications();
  }
}

/**
 * Schedule daily reminder notifications for the next few days at a specific local time.
 * If includeToday is true and the time is in the future, today is included; otherwise start from tomorrow.
 *
 * destination: Destination name to include in the notification body.
 * minutesSinceMidnight: Local minutes since midnight [0..1439] for when the reminder should fire.
 * includeToday: Whether to include today's occurrence if still upcoming.
 */
export async function scheduleDailyRemindersAtLocalTime(
  destination: string,
  minutesSinceMidnight: number,
  includeToday: boolean,
): Promise<void> {
  const title = 'Complete your habits today?';
  const body = `Mark your habits as complete to continue your journey to ${destination}!`;

  const count = includeToday ? 4 : 3;
  const dates = getUpcomingLocalTimeDates(
    minutesSinceMidnight,
    count,
    getCurrentDate(),
    includeToday,
  );
  for (const date of dates) {
    const data: DailyReminderData = {
      type: 'dailyReminder',
      dateKey: formatDateKey(date),
    };

    const seconds = Math.max(1, Math.floor((date.getTime() - Date.now()) / 1000));

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
  }
}

/**
 * Clear all existing daily reminders and schedule fresh ones at the provided local time,
 * then log scheduled notifications.
 *
 * destination: Destination name to include in the notification body.
 * minutesSinceMidnight: Local minutes since midnight [0..1439] for when the reminder should fire.
 * includeToday: Whether to include today's occurrence if still upcoming.
 */
export async function rescheduleDailyRemindersAtLocalTime(
  destination: string,
  minutesSinceMidnight: number,
  includeToday: boolean,
): Promise<void> {
  try {
    await cancelAllDailyReminders();
    await scheduleDailyRemindersAtLocalTime(destination, minutesSinceMidnight, includeToday);
  } catch (e) {
    console.warn('rescheduleDailyRemindersAtLocalTime failed', e);
  } finally {
    await logScheduledNotifications();
  }
}

/**
 * Log all scheduled notifications (id, title, body, when, data) for debugging/visibility.
 */
export async function logScheduledNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    const summary = scheduled.map((req) => {
      const trigger = req.trigger as unknown;
      const when = (() => {
        if (!trigger) {
          return 'unknown';
        }

        if (trigger instanceof Date) {
          return trigger.toString();
        }

        if (typeof trigger === 'object') {
          const t = trigger as Record<string, unknown>;
          // Some platforms expose a `date` field for absolute triggers
          if (t.date !== undefined) {
            if (typeof t.date === 'number') {
              return new Date(t.date).toString();
            }

            if (typeof t.date === 'string') {
              const parsed = Date.parse(t.date);
              return new Date(parsed).toString();
            }
          }

          if (typeof t.seconds === 'number') {
            return `in ${t.seconds}s (interval)`;
          }
        }

        return 'unknown';
      })();

      return {
        id: req.identifier,
        title: req.content.title,
        body: req.content.body ?? '',
        when,
        data: req.content.data,
      };
    });

    Sentry.logger.info('Scheduled notifications', {
      messages: summary,
      user: useStore.getState().username,
    });
  } catch (e) {
    Sentry.captureException(e);
  }
}
