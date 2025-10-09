import * as Notifications from 'expo-notifications';
import { Hour } from './units';

export async function schedulePushNotification({
  title,
  body,
  hours,
}: {
  title: string;
  body?: string;
  hours: Hour;
}) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: body || '',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: hours * 60 * 60,
    },
  });
}
