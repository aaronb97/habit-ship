import { describe, expect, it } from 'vitest';
import {
  xpCurrentThresholdForLevel,
  getLevelProgress,
  calculateLevel,
  getDailyDistanceForLevel,
} from './experience';

describe('xpCurrentThresholdForLevel', () => {
  it('should calculate total XP thresholds correctly', () => {
    expect(xpCurrentThresholdForLevel(1)).toBe(150);
    expect(xpCurrentThresholdForLevel(2)).toBe(200);
    expect(xpCurrentThresholdForLevel(3)).toBe(250);
    expect(xpCurrentThresholdForLevel(4)).toBe(300);
    expect(xpCurrentThresholdForLevel(5)).toBe(350);
    expect(xpCurrentThresholdForLevel(6)).toBe(400);
    expect(xpCurrentThresholdForLevel(7)).toBe(450);
    expect(xpCurrentThresholdForLevel(8)).toBe(500);
    expect(xpCurrentThresholdForLevel(9)).toBe(550);
    expect(xpCurrentThresholdForLevel(10)).toBe(600);
    expect(xpCurrentThresholdForLevel(11)).toBe(650);
    expect(xpCurrentThresholdForLevel(12)).toBe(700);
    expect(xpCurrentThresholdForLevel(13)).toBe(750);
    expect(xpCurrentThresholdForLevel(14)).toBe(800);
    expect(xpCurrentThresholdForLevel(15)).toBe(850);
    expect(xpCurrentThresholdForLevel(16)).toBe(900);
    expect(xpCurrentThresholdForLevel(17)).toBe(950);
    expect(xpCurrentThresholdForLevel(18)).toBe(1000);
    expect(xpCurrentThresholdForLevel(19)).toBe(1100);
    expect(xpCurrentThresholdForLevel(20)).toBe(1200);
    expect(xpCurrentThresholdForLevel(21)).toBe(1300);
    expect(xpCurrentThresholdForLevel(22)).toBe(1400);
    expect(xpCurrentThresholdForLevel(23)).toBe(1500);
    expect(xpCurrentThresholdForLevel(24)).toBe(1600);
  });
});

describe('getLevelProgress', () => {
  it('should calculate level progress correctly', () => {
    const level1Xp = xpCurrentThresholdForLevel(1);
    const level2Xp = xpCurrentThresholdForLevel(2);

    expect(getLevelProgress(0)).toBe(0);
    expect(getLevelProgress(level1Xp * 0.5)).toBe(0.5);
    expect(getLevelProgress(level1Xp * 0.75)).toBe(0.75);
    expect(getLevelProgress(level1Xp)).toBe(0);

    expect(getLevelProgress(level1Xp + level2Xp * 0.5)).toBe(0.5);
    expect(getLevelProgress(level1Xp + level2Xp * 0.75)).toBe(0.75);
    expect(getLevelProgress(level1Xp + level2Xp)).toBe(0);
  });
});

describe('calculateLevel', () => {
  it('should calculate level correctly', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(101)).toBe(2);
  });
});

describe('getDailyDistanceForLevel', () => {
  it('should calculate daily distance correctly', () => {
    expect(getDailyDistanceForLevel(1)).toBe(10_000_000);
    expect(getDailyDistanceForLevel(2)).toBe(13_000_000);
    expect(getDailyDistanceForLevel(3)).toBeCloseTo(14_300_000);
  });
});
