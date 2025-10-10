import { useStore } from './store';

/**
 * Gets the current time as a timestamp (milliseconds), accounting for dev time offset.
 * Use this instead of Date.now() throughout the app.
 */
export function getCurrentTime(): number {
  const timeOffset = useStore.getState().timeOffset;
  return Date.now() + timeOffset;
}

/**
 * Gets the current date as a Date object, accounting for dev time offset.
 * Use this instead of new Date() throughout the app.
 */
export function getCurrentDate(): Date {
  return new Date(getCurrentTime());
}

/**
 * Advances the system time by the specified number of milliseconds.
 * This is useful for testing time-based features.
 */
export function advanceTime(milliseconds: number): void {
  const currentOffset = useStore.getState().timeOffset;
  useStore.setState({ timeOffset: currentOffset + milliseconds });
}
