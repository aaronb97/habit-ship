import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useIsSetupInProgress, useStore } from './store';
import { Meter } from './units';

describe('store', () => {
  beforeEach(() => {
    useStore.setState({
      isSetupFinished: false,
      habits: [],
      journey: undefined,
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

  it('should complete a habit and increase energy', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Daily Run' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setJourney({
        distance: 0 as Meter,
        planetName: 'Gliese 581g',
        energy: 0,
      });
    });

    act(() => {
      result.current.completeHabit(habitId);
    });

    expect(result.current.habits[0].completions).toHaveLength(1);
    expect(result.current.journey?.energy).toBe(10);
  });

  it('should cap energy at 100 when completing habits', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Cap Energy' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setJourney({
        distance: 0 as Meter,
        planetName: 'Gliese 581g',
        energy: 95,
      });
    });

    act(() => {
      result.current.completeHabit(habitId);
    });

    expect(result.current.journey?.energy).toBe(100);
  });

  it('should complete a planet only once', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.completePlanet('Gliese 581g');
      result.current.completePlanet('Gliese 581g');
    });

    expect(result.current.completedPlanets).toEqual(['Gliese 581g']);
  });

  it('should set journey correctly', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setJourney({
        distance: 0 as Meter,
        planetName: 'Gliese 581g',
        energy: 50,
      });
    });

    expect(result.current.journey?.planetName).toBe('Gliese 581g');
    expect(result.current.journey?.energy).toBe(50);
  });

  it('should expend energy and update distance', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setJourney({
        distance: 0 as Meter,
        planetName: 'Gliese 581g',
        energy: 50,
      });
    });

    act(() => {
      result.current.expendEnergy();
    });

    expect(result.current.journey?.energy).toBeLessThan(50);
    expect(result.current.journey?.distance).toBeGreaterThan(0);
    expect(result.current.journey?.lastEnergyUpdate).toBeDefined();
  });

  it('should not exceed planet distance when expending energy', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setJourney({
        distance: (189000000000000 - 1000) as Meter,
        planetName: 'Gliese 581g',
        energy: 100,
      });
    });

    act(() => {
      result.current.expendEnergy();
    });

    const planetDistance = result.current.journey?.distance ?? 0;
    expect(planetDistance).toBeLessThanOrEqual(189000000000000); // Gliese 581g distance
  });

  it('should clear all data', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setIsSetupFinished(true);
      result.current.addHabit({ title: 'Temp Habit' });
      result.current.setJourney({
        distance: 10 as Meter,
        planetName: 'Gliese 581g',
        energy: 50,
      });
    });

    act(() => {
      result.current.clearData();
    });

    expect(result.current.isSetupFinished).toBe(false);
    expect(result.current.habits).toEqual([]);
    expect(result.current.journey).toBeUndefined();
  });
});
