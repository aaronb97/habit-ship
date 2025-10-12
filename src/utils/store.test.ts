// Mocks must be defined before importing the store (persist/notifications)
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  let storage: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn(async (key: string) => storage[key] ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn(async (key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(async () => {
        storage = {};
      }),
    },
  };
});

vi.mock('expo-notifications', () => {
  return {
    scheduleNotificationAsync: vi.fn(async () => 'mock-notification-id'),
    cancelScheduledNotificationAsync: vi.fn(async () => undefined),
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  };
});

import {
  useIsSetupFinished,
  useIsTraveling,
  useTimeRemaining,
  useStore,
} from './store';
import { advanceTime } from './time';

describe('store', () => {
  beforeEach(() => {
    useStore.setState({
      isSetupFinished: false,
      habits: [],
      userPosition: {
        currentLocation: 'Earth',
        speed: 0,
      },
      completedPlanets: [],
    });
  });

  it('should initialize with isSetupFinished as false', () => {
    const { result } = renderHook(() => useStore());
    expect(result.current.isSetupFinished).toBe(false);
  });

  it('should update isSetupFinished when setIsSetupFinished is called', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setIsSetupFinished(true);
    });

    expect(result.current.isSetupFinished).toBe(true);
  });

  it('should correctly reflect setup state in useIsSetupFinished', () => {
    const { result: store } = renderHook(() => useStore());
    const { result: setupFinished } = renderHook(() => useIsSetupFinished());

    expect(setupFinished.current).toBe(false);

    act(() => {
      store.current.setIsSetupFinished(true);
    });

    expect(setupFinished.current).toBe(true);
  });

  it('should add a habit', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Drink Water' });
    });

    expect(result.current.habits).toHaveLength(1);
    expect(result.current.habits[0]!.title).toBe('Drink Water');
    expect(result.current.habits[0]!.completions).toEqual([]);
  });

  it('should generate unique IDs for habits', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Drink Water' });
      result.current.addHabit({ title: 'Drink Water' });
    });

    expect(result.current.habits).toHaveLength(2);
    expect(result.current.habits[0]!.id).not.toEqual(
      result.current.habits[1]!.id,
    );
  });

  it('should edit a habit', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Old Title' });
    });

    const habitId = result.current.habits[0]!.id;

    act(() => {
      result.current.editHabit(habitId, { title: 'New Title' });
    });

    expect(result.current.habits[0]!.title).toBe('New Title');
  });

  it('should delete a habit', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Remove Me' });
    });

    const habitId = result.current.habits[0]!.id;

    act(() => {
      result.current.removeHabit(habitId);
    });

    expect(result.current.habits).toHaveLength(0);
  });

  it('should complete a habit and launch with initial speed', async () => {
    const { result } = renderHook(() => useStore());
    const { result: traveling } = renderHook(() => useIsTraveling());

    act(() => {
      result.current.addHabit({ title: 'Daily Run' });
    });

    const habitId = result.current.habits[0]!.id;

    act(() => {
      result.current.setDestination('The Moon');
    });

    await act(async () => {
      await result.current.completeHabit(habitId);
    });

    expect(result.current.habits[0]!.completions).toHaveLength(1);
    expect(result.current.userPosition.speed).toBe(50000);
    expect(traveling.current).toBe(true);
  });

  it('should increase speed by 1.2x when completing habits while traveling', async () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Speed Boost' });
    });

    const habitId = result.current.habits[0]!.id;

    await act(async () => {
      result.current.setDestination('The Moon');
      await result.current.completeHabit(habitId); // Launch
    });

    const initialSpeed = result.current.userPosition.speed;

    await act(async () => {
      await result.current.completeHabit(habitId); // Boost speed
    });

    expect(result.current.userPosition.speed).toBe(initialSpeed * 1.2);
  });

  it('should set destination correctly', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setDestination('The Moon');
    });

    expect(result.current.userPosition.target?.name).toBe('The Moon');
    expect(result.current.userPosition.speed).toBe(0);
  });

  it('should update travel position when traveling', () => {
    const { result } = renderHook(() => useStore());
    const { result: traveling } = renderHook(() => useIsTraveling());

    act(() => {
      result.current.addHabit({ title: 'Travel Test' });
    });

    const habitId = result.current.habits[0]!.id;

    act(() => {
      result.current.setDestination('The Moon');
    });
    // Use async act since completeHabit is async

    return (async () => {
      await act(async () => {
        await result.current.completeHabit(habitId);
      });

      const prevDistance = result.current.userPosition.distanceTraveled;
      expect(traveling.current).toBe(true);
      expect(prevDistance).toBeDefined();
      expect(prevDistance).toBe(0);
      expect(result.current.userPosition.launchTime).toBeDefined();

      // Advance time and update position
      act(() => {
        advanceTime(60 * 60 * 1000); // +1 hour
        result.current.updateTravelPosition();
      });

      expect(result.current.userPosition.distanceTraveled).toBeGreaterThan(0);
    })();
  });

  it('should land when reaching destination', async () => {
    const { result } = renderHook(() => useStore());
    const { result: traveling } = renderHook(() => useIsTraveling());
    const { result: timeRemaining } = renderHook(() => useTimeRemaining());

    act(() => {
      result.current.addHabit({ title: 'Quick Trip' });
    });

    const habitId = result.current.habits[0]!.id;

    await act(async () => {
      result.current.setDestination('The Moon');
      await result.current.completeHabit(habitId);
    });

    // Advance virtual time past the remaining travel time and update position
    act(() => {
      const remainingSeconds = timeRemaining.current;
      advanceTime((remainingSeconds + 1) * 1000);
      result.current.updateTravelPosition();
    });

    expect(traveling.current).toBe(false);
    expect(result.current.userPosition.currentLocation).toBe('The Moon');
    expect(result.current.userPosition.target).toBeUndefined();
    expect(result.current.userPosition.speed).toBe(0);
    expect(result.current.completedPlanets.includes('The Moon')).toBe(true);
  });

  it('should clear all data', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setIsSetupFinished(true);
      result.current.addHabit({ title: 'Temp Habit' });
      result.current.setDestination('The Moon');
    });

    act(() => {
      result.current.clearData();
    });

    expect(result.current.isSetupFinished).toBe(false);
    expect(result.current.habits).toEqual([]);
    expect(result.current.userPosition.currentLocation).toBe('Earth');
    expect(result.current.userPosition.speed).toBe(0);
    expect(result.current.userPosition.target).toBeUndefined();
    expect(result.current.completedPlanets).toEqual(['Earth']);
  });
});
