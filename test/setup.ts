import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';

expect.extend(matchers);

// Ensure __DEV__ exists in test env
declare global {
  var __DEV__: boolean;
}
globalThis.__DEV__ = false;

// Mock React Native/Expo modules that are not available in Vitest/Node
vi.mock('expo', () => ({}));
vi.mock('expo/src/winter/runtime', () => ({}));
vi.mock('expo/src/async-require/setup', () => ({}));
vi.mock('expo/src/winner/ImportMetaRegistry', () => ({
  ImportMetaRegistry: class {},
}));

vi.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: class {},
}));

vi.mock('expo-notifications', () => {
  // In-memory scheduled notifications store for tests
  type Req = {
    identifier: string;
    content: { title?: string; body?: string; data?: unknown };
    trigger: unknown;
  };
  const scheduled: Req[] = [];

  return {
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
    setNotificationHandler: vi.fn(() => {}),
    addNotificationReceivedListener: vi.fn(() => ({ remove: () => {} })),
    addNotificationResponseReceivedListener: vi.fn(() => ({ remove: () => {} })),
    getNotificationChannelsAsync: vi.fn(async () => []),
    setNotificationChannelAsync: vi.fn(async () => {}),
    getPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
    requestPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
    getExpoPushTokenAsync: vi.fn(async () => ({ data: 'mock-token' })),
    scheduleNotificationAsync: vi.fn(async ({ content, trigger }) => {
      const id = `mock-notif-${scheduled.length + 1}`;
      scheduled.push({ identifier: id, content, trigger });
      return id;
    }),
    cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
      const idx = scheduled.findIndex((r) => r.identifier === id);
      if (idx >= 0) {
        scheduled.splice(idx, 1);
      }
    }),
    getAllScheduledNotificationsAsync: vi.fn(async () => scheduled.slice()),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
