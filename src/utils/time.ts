/**
 * Lightweight time utilities that can optionally use a host-provided time offset.
 * This module intentionally does not import the app store to avoid require cycles.
 * The store should call `setTimeOffsetProvider()` at startup to wire in offset state.
 */
type TimeOffsetProvider = {
  /**
   * Returns the current time offset in milliseconds.
   */
  get: () => number;
  /**
   * Sets the current time offset in milliseconds.
   */
  set: (next: number) => void;
};

let provider: TimeOffsetProvider | undefined;

/**
 * Configures how this module reads/writes the time offset.
 * Call from the store module to bridge to Zustand without creating a cycle.
 *
 * @param p Provider with `get()` and `set()` accessors for the offset in ms.
 * @returns void
 */
export function setTimeOffsetProvider(p: TimeOffsetProvider): void {
  provider = p;
}

/**
 * Gets the current time as a timestamp (milliseconds), accounting for dev time offset.
 * Use this instead of Date.now() throughout the app.
 */
export function getCurrentTime(): number {
  const offset = provider?.get() ?? 0;
  return Date.now() + offset;
}

/**
 * Gets the current date as a Date object, accounting for dev time offset.
 * Use this instead of new Date() throughout the app.
 */
export function getCurrentDate(): Date {
  return new Date(getCurrentTime());
}

/**
 * Should be preferred to getCurrentTime() in React components or hooks
 */
export function useGetCurrentTime() {
  return () => Date.now() + (provider?.get() ?? 0);
}

/**
 * Should be preferred to getCurrentDate() in React components or hooks
 */
export function useGetCurrentDate() {
  return () => new Date(Date.now() + (provider?.get() ?? 0));
}

/**
 * Advances the system time by the specified number of milliseconds.
 * This is useful for testing time-based features.
 */
export function advanceTime(milliseconds: number): void {
  const currentOffset = provider?.get() ?? 0;
  provider?.set(currentOffset + milliseconds);
}
