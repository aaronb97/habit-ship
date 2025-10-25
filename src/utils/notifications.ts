import * as Notifications from 'expo-notifications';
import { getCurrentDate } from './time';

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
 * Returns a Date set to 9:00 PM local time on the same calendar day as the input.
 *
 * date: The base date.
 */
function atNinePmLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(21, 0, 0, 0);
  return d;
}

/**
 * Compute a list of upcoming 9PM occurrences.
 * If includeToday is true and 9PM is still in the future, today is included; otherwise start from tomorrow.
 *
 * count: Number of 9PM dates to produce.
 * now: Reference time (usually current time).
 * includeToday: Whether to include today's 9pm if it's still upcoming.
 */
function getUpcomingNinePmDates(
  count: number,
  now: Date,
  includeToday: boolean,
): Date[] {
  const results: Date[] = [];
  const todayNine = atNinePmLocal(now);
  const tomorrowNine = atNinePmLocal(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  );
  const startDate =
    includeToday && todayNine.getTime() > now.getTime()
      ? todayNine
      : tomorrowNine;

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
async function cancelAllDailyReminders(): Promise<void> {
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
    daily.map((req) =>
      Notifications.cancelScheduledNotificationAsync(req.identifier),
    ),
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
      toCancel.map((req) =>
        Notifications.cancelScheduledNotificationAsync(req.identifier),
      ),
    );
  } catch (e) {
    console.warn('cancelTodayDailyReminder failed', e);
  } finally {
    await logScheduledNotifications();
  }
}

/**
 * Schedule daily reminder notifications for up to the next four days at 9PM local time.
 * If includeToday is true and it's before 9PM, includes today; otherwise starts from tomorrow.
 *
 * destination: Destination name to include in the notification body.
 * includeToday: Whether to include today's 9PM reminder (if it's still in the future).
 */
export async function scheduleDailyReminders(
  destination: string,
  includeToday: boolean,
): Promise<void> {
  const title = 'Complete your habits today?';
  const body = `Mark your habits as complete to continue your journey to ${destination}!`;

  const count = includeToday ? 4 : 3;
  const dates = getUpcomingNinePmDates(count, getCurrentDate(), includeToday);
  for (const date of dates) {
    const data: DailyReminderData = {
      type: 'dailyReminder',
      dateKey: formatDateKey(date),
    };
    const seconds = Math.max(
      1,
      Math.floor((date.getTime() - Date.now()) / 1000),
    );

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
 * Clear all existing daily reminders and schedule fresh ones, then log scheduled notifications.
 *
 * destination: Destination name to include in the notification body.
 * includeToday: Whether to include today's 9PM reminder (if it's still in the future).
 */
export async function rescheduleDailyReminders(
  destination: string,
  includeToday: boolean,
): Promise<void> {
  try {
    await cancelAllDailyReminders();
    await scheduleDailyReminders(destination, includeToday);
  } catch (e) {
    console.warn('rescheduleDailyReminders failed', e);
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
        if (!trigger) return 'unknown';
        if (trigger instanceof Date) return trigger.toString();
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

    console.log('Scheduled notifications:', summary);
  } catch (e) {
    console.warn('logScheduledNotifications failed', e);
  }
}
