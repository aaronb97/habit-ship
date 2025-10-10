import * as Notifications from 'expo-notifications';

export async function schedulePushNotification({
  title,
  body,
  seconds,
}: {
  title: string;
  body?: string;
  seconds: number;
}) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: body || '',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}
