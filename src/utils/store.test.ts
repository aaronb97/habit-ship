import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HabitId, useIsSetupInProgress, useStore } from './store';

describe('store', () => {
  beforeEach(() => {
    useStore.setState({
      isSetupFinished: false,
      habits: [],
      hike: undefined,
      completedMountains: [],
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

  it('should remove a habit', () => {
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
      result.current.setHike({
        height: 0,
        mountainName: 'Mount Everest',
        energy: 0,
      });
    });

    act(() => {
      result.current.completeHabit(habitId);
    });

    expect(result.current.habits[0].completions).toHaveLength(1);
    expect(result.current.hike?.energy).toBe(10);
  });

  it('should cap energy at 100 when completing habits', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addHabit({ title: 'Cap Energy' });
    });

    const habitId = result.current.habits[0].id;

    act(() => {
      result.current.setHike({
        height: 0,
        mountainName: 'Mount Everest',
        energy: 95,
      });
    });

    act(() => {
      result.current.completeHabit(habitId);
    });

    expect(result.current.hike?.energy).toBe(100);
  });

  it('should complete a mountain only once', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.completeMountain('Mount Everest');
      result.current.completeMountain('Mount Everest');
    });

    expect(result.current.completedMountains).toEqual(['Mount Everest']);
  });

  it('should set hike correctly', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setHike({
        height: 0,
        mountainName: 'Mount Everest',
        energy: 50,
      });
    });

    expect(result.current.hike?.mountainName).toBe('Mount Everest');
    expect(result.current.hike?.energy).toBe(50);
  });

  it('should expend energy and update height', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setHike({
        height: 0,
        mountainName: 'Mount Everest',
        energy: 50,
        lastEnergyUpdate: new Date(Date.now() - 3600000).toISOString(), // 1h ago
      });
      result.current.expendEnergy();
    });

    expect(result.current.hike?.energy).toBeLessThan(50);
    expect(result.current.hike?.height).toBeGreaterThan(0);
    expect(result.current.hike?.lastEnergyUpdate).toBeDefined();
  });

  it('should not exceed mountain height when expending energy', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setHike({
        height: 8840,
        mountainName: 'Mount Everest',
        energy: 100,
        lastEnergyUpdate: new Date(Date.now() - 36000000).toISOString(), // 10h ago
      });
      result.current.expendEnergy();
    });

    const mountainHeight = result.current.hike?.height ?? 0;
    expect(mountainHeight).toBeLessThanOrEqual(8848); // Everest height
  });

  it('should clear all data', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setIsSetupFinished(true);
      result.current.addHabit({ title: 'Temp Habit' });
      result.current.setHike({
        height: 10,
        mountainName: 'Mount Everest',
        energy: 50,
      });
      result.current.clearData();
    });

    expect(result.current.isSetupFinished).toBe(false);
    expect(result.current.habits).toEqual([]);
    expect(result.current.hike).toBeUndefined();
  });
});
