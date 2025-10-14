// Coordinate system types
export type Coordinates = [number, number, number];

export type DailyPosition = {
  date: string; // YYYY-MM-DD format
  coordinates: Coordinates;
};

export type UserPosition = {
  startingLocation: string; // Planet/moon name if landed or the starting position if traveling
  target?: {
    name: string;
    position: Coordinates;
  };
  launchTime?: string; // ISO timestamp
  initialDistance?: number; // Initial distance in km at launch
  distanceTraveled?: number; // Distance traveled in km since launch
  previousDistanceTraveled?: number; // Last displayed distance used for animations
};

export type UserLevel = {
  level: number;
  currentXP: number;
  totalXP: number;
};

export type XPSource = 'habit_completion' | 'planet_completion';

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
  PLANET_COMPLETION: 200,
} as const;

// Helper functions for level calculations
export function calculateLevel(totalXP: number): number {
  let level = 1;
  for (let i = 2; i <= 20; i++) {
    if (totalXP >= XP_REQUIREMENTS[i]!) {
      level = i;
    } else {
      break;
    }
  }

  return level;
}

export function getXPForNextLevel(currentLevel: number): number {
  return XP_REQUIREMENTS[currentLevel + 1]! || XP_REQUIREMENTS[20]!;
}

export function getCurrentLevelXP(totalXP: number): number {
  const level = calculateLevel(totalXP);
  return totalXP - XP_REQUIREMENTS[level]!;
}

export function getXPToNextLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  const nextLevelXP = getXPForNextLevel(level);
  return nextLevelXP - totalXP;
}

export function getLevelProgress(totalXP: number): number {
  const level = calculateLevel(totalXP);
  const currentLevelXP = XP_REQUIREMENTS[level]!;
  const nextLevelXP = getXPForNextLevel(level);
  const progressXP = totalXP - currentLevelXP;
  const totalNeeded = nextLevelXP - currentLevelXP;

  return Math.min(progressXP / totalNeeded, 1);
}

// Distance gained per habit completion for a given level
export function getHabitDistanceForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return 1_000_000 * Math.pow(1.2, L - 1);
}
