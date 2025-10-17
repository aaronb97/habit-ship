import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';

expect.extend(matchers);

// Ensure __DEV__ exists in test env
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
globalThis.__DEV__ = false;

// Mock React Native/Expo modules that are not available in Vitest/Node
vi.mock('expo', () => ({}));
vi.mock('expo/src/winter/runtime', () => ({}));
vi.mock('expo/src/async-require/setup', () => ({}));
vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn(async () => 'mock-notif-id'),
  cancelScheduledNotificationAsync: vi.fn(async () => {}),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
