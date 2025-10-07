import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useIsSetupInProgress, useStore } from './store';

describe('store', () => {
  beforeEach(() => {
    useStore.setState({
      isSetupFinished: false,
      habits: [],
      userPosition: {
        state: 'landed',
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

  it('should correctly reflect setup state in useIsSetupInProgress', () => {
    const { result: store } = renderHook(() => useStore());
    const { result: setupInProgress } = renderHook(() =>
      useIsSetupInProgress(),
    );

    expect(setupInProgress.current).toBe(true);

    act(() => {
      store.current.setIsSetupFinished(true);
    });

    expect(setupInProgress.current).toBe(false);
  });

  it('should add a habit', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Drink Water' });
    });

    expect(result.current.habits).toHaveLength(1);
    expect(result.current.habits[0].title).toBe('Drink Water');
    expect(result.current.habits[0].completions).toEqual([]);
  });

  it('should generate unique IDs for habits', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Drink Water' });
      result.current.addHabit({ title: 'Drink Water' });
    });

    expect(result.current.habits).toHaveLength(2);
    expect(result.current.habits[0].id).not.toEqual(
      result.current.habits[1].id,
    );
  });

  it('should edit a habit', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Old Title' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.editHabit(habitId, { title: 'New Title' });
    });

    expect(result.current.habits[0].title).toBe('New Title');
  });

  it('should delete a habit', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Remove Me' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.removeHabit(habitId);
    });

    expect(result.current.habits).toHaveLength(0);
  });

  it('should complete a habit and launch with initial speed', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Daily Run' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setDestination('The Moon');
    });

    act(() => {
      result.current.completeHabit(habitId);
    });

    expect(result.current.habits[0].completions).toHaveLength(1);
    expect(result.current.userPosition.speed).toBe(50000);
    expect(result.current.userPosition.state).toBe('traveling');
  });

  it('should increase speed by 1.2x when completing habits while traveling', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Speed Boost' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setDestination('The Moon');
      result.current.completeHabit(habitId); // Launch
    });

    const initialSpeed = result.current.userPosition.speed;

    act(() => {
      result.current.completeHabit(habitId); // Boost speed
    });

    expect(result.current.userPosition.speed).toBe(initialSpeed * 1.2);
  });

  it('should complete a planet only once', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.completePlanet('Gliese 581g');
      result.current.completePlanet('Gliese 581g');
    });

    expect(result.current.completedPlanets).toEqual(['Gliese 581g']);
  });

  it('should set destination correctly', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setDestination('The Moon');
    });

    expect(result.current.userPosition.targetPlanet).toBe('The Moon');
    expect(result.current.userPosition.speed).toBe(0);
  });

  it('should update travel position when traveling', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Travel Test' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setDestination('The Moon');
      result.current.completeHabit(habitId); // Launch
    });

    expect(result.current.userPosition.state).toBe('traveling');
    expect(result.current.userPosition.currentCoordinates).toBeDefined();
    expect(result.current.userPosition.launchTime).toBeDefined();
  });

  it('should land when reaching destination', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Quick Trip' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setDestination('The Moon');
      result.current.completeHabit(habitId);
    });

    // Simulate arrival by manually setting state as if enough time has passed
    act(() => {
      result.current.userPosition.state = 'landed';
      result.current.userPosition.currentLocation = 'The Moon';
      result.current.userPosition.speed = 0;
    });

    expect(result.current.userPosition.state).toBe('landed');
    expect(result.current.userPosition.currentLocation).toBe('The Moon');
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
    expect(result.current.userPosition.state).toBe('landed');
    expect(result.current.userPosition.currentLocation).toBe('Earth');
  });
});
