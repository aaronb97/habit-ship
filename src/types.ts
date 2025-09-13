export type UserLevel = {
  level: number;
  currentXP: number;
  totalXP: number;
};

export type XPSource = 'habit_completion' | 'mountain_completion';

export type XPGain = {
  amount: number;
  source: XPSource;
  timestamp: string;
};

// XP required for each level (exponential growth)
export const XP_REQUIREMENTS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1350,
  8: 1750,
  9: 2200,
  10: 2700,
  11: 3250,
  12: 3850,
  13: 4500,
  14: 5200,
  15: 5950,
  16: 6750,
  17: 7600,
  18: 8500,
  19: 9450,
  20: 10450,
};

// XP rewards
export const XP_REWARDS = {
  HABIT_COMPLETION: 25,
  MOUNTAIN_COMPLETION: 200,
} as const;

// Helper functions for level calculations
export function calculateLevel(totalXP: number): number {
  let level = 1;
  for (let i = 2; i <= 20; i++) {
    if (totalXP >= XP_REQUIREMENTS[i]) {
      level = i;
    } else {
      break;
    }
  }

  return level;
}

export function getXPForNextLevel(currentLevel: number): number {
  return XP_REQUIREMENTS[currentLevel + 1] || XP_REQUIREMENTS[20];
}

export function getCurrentLevelXP(totalXP: number): number {
  const level = calculateLevel(totalXP);
  return totalXP - XP_REQUIREMENTS[level];
}

export function getXPToNextLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  const nextLevelXP = getXPForNextLevel(level);
  return nextLevelXP - totalXP;
}

export function getLevelProgress(totalXP: number): number {
  const level = calculateLevel(totalXP);
  const currentLevelXP = XP_REQUIREMENTS[level];
  const nextLevelXP = getXPForNextLevel(level);
  const progressXP = totalXP - currentLevelXP;
  const totalNeeded = nextLevelXP - currentLevelXP;

  return Math.min(progressXP / totalNeeded, 1);
}
