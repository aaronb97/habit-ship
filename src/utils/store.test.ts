// Mocks must be defined before importing the store (persist/notifications)
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsSetupFinished, useIsTraveling, useStore } from './store';
import { calculateLevel, getHabitDistanceForLevel } from './experience';
import { advanceTime } from './time';
import { moon } from '../planets';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

describe('store', () => {
  beforeEach(async () => {
    // Ensure persisted state does not leak between tests
    await AsyncStorage.clear();
    // Reset store to initial baseline, then align with previous test assumptions
    useStore.getState().clearData();
    useStore.setState({
      isSetupFinished: false,
      habits: [],
      userPosition: {
        startingLocation: 'Earth',
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

  it('should accrue fuel on completion and advance when fuel is applied', async () => {
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
    const per = getHabitDistanceForLevel(
      calculateLevel(result.current.totalXP),
    );

    // Fuel accrued, but no travel yet
    expect(result.current.fuelKm).toBe(per);
    expect(result.current.userPosition.distanceTraveled).toBe(0);
    expect(traveling.current).toBe(false);

    // Apply fuel to initiate travel
    act(() => {
      result.current.applyFuelToTravel();
    });

    const initialDist = result.current.userPosition.initialDistance!;
    expect(result.current.userPosition!.distanceTraveled).toBe(
      Math.min(initialDist, per),
    );
    expect(traveling.current).toBe(true);
  });

  it('should scale distance per habit by 1.2^(level-1) and cap daily fuel', async () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Speed Boost' });
    });

    const habitId = result.current.habits[0]!.id;

    await act(async () => {
      result.current.setDestination('The Moon');
      await result.current.completeHabit(habitId); // First completion (fuel)
    });
    const level = calculateLevel(result.current.totalXP);
    const firstMove = getHabitDistanceForLevel(level);

    act(() => {
      result.current.applyFuelToTravel();
    });

    const distAfterFirst = result.current.userPosition.distanceTraveled!;
    expect(distAfterFirst).toBe(
      Math.min(result.current.userPosition.initialDistance!, firstMove),
    );

    await act(async () => {
      await result.current.completeHabit(habitId); // Second completion (fuel)
    });
    const secondMove = getHabitDistanceForLevel(level);
    expect(secondMove).toBeCloseTo(firstMove);

    // Applying fuel again the same day should not increase beyond the daily cap total
    act(() => {
      result.current.applyFuelToTravel();
    });

    expect(result.current.userPosition.distanceTraveled).toBe(distAfterFirst);
  });

  it('should set destination correctly', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setDestination('The Moon');
    });

    expect(result.current.userPosition.target?.name).toBe('The Moon');
    expect(result.current.userPosition.initialDistance).toBeGreaterThan(0);
  });

  it('should track distanceTraveled when applying fuel after a completion', () => {
    const { result } = renderHook(() => useStore());
    const { result: traveling } = renderHook(() => useIsTraveling());

    act(() => {
      result.current.addHabit({ title: 'Travel Test' });
    });

    const habitId = result.current.habits[0]!.id;

    act(() => {
      result.current.setDestination('The Moon');
    });

    return (async () => {
      await act(async () => {
        await result.current.completeHabit(habitId);
      });

      // No travel yet until fuel is applied
      expect(result.current.userPosition.distanceTraveled ?? 0).toBe(0);
      expect(traveling.current).toBe(false);

      act(() => {
        result.current.applyFuelToTravel();
      });

      const moved = result.current.userPosition.distanceTraveled ?? 0;
      expect(traveling.current).toBe(true);
      expect(moved).toBeGreaterThan(0);
      expect(result.current.userPosition.launchTime).toBeDefined();
    })();
  });

  it('should land when reaching destination after enough completions (finalized after animation)', async () => {
    const { result } = renderHook(() => useStore());
    const { result: traveling } = renderHook(() => useIsTraveling());

    act(() => {
      result.current.addHabit({ title: 'Quick Trip' });
    });

    const habitId = result.current.habits[0]!.id;

    await act(async () => {
      result.current.setDestination('The Moon');
      await result.current.completeHabit(habitId);
    });

    // Apply fuel for the first completion
    act(() => {
      result.current.applyFuelToTravel();
    });

    // Loop completing habits across days and applying fuel until arrival
    const initialDist = result.current.userPosition.initialDistance!;
    const perHabit = getHabitDistanceForLevel(
      calculateLevel(result.current.totalXP),
    );
    const needed = Math.ceil(initialDist / perHabit);
    for (let i = 1; i < needed; i++) {
      await act(async () => {
        await result.current.completeHabit(habitId);
      });
      act(() => {
        result.current.applyFuelToTravel();
      });
      // Move to the next day to allow more fuel accrual
      act(() => {
        advanceTime(24 * 60 * 60 * 1000);
      });
    }

    // Landing is now finalized after the map animation via finalizeLandingAfterAnimation
    act(() => {
      result.current.finalizeLandingAfterAnimation();
    });

    expect(traveling.current).toBe(false);
    expect(result.current.userPosition.startingLocation).toBe('The Moon');
    expect(result.current.userPosition.target).toBeUndefined();
    expect(result.current.completedPlanets.includes('The Moon')).toBe(true);
    const last = result.current.xpHistory[result.current.xpHistory.length - 1]!;
    expect(last.amount).toBe(moon.xpReward);
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
    expect(result.current.userPosition.startingLocation).toBe('Earth');
    expect(result.current.userPosition.target).toBeUndefined();
    expect(result.current.completedPlanets).toEqual(['Earth']);
  });
});
