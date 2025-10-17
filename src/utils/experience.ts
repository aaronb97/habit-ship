// XP thresholds (total XP required) are computed via math:
// - First level-up requires 100 XP (Level 1 -> 2)
// - Then increase the per-level requirement by 50 for each subsequent level until
//   the total XP threshold reaches 1000 (which occurs at Level 6)
// - After that, the total XP threshold increases by a flat 100 per level
//
// Let T(L) be total XP required to reach level L (T(1) = 0):
//   For L <= 6: T(L) = sum_{i=1}^{L-1} [100 + (i-1)*50] = n/2 * (2*100 + (n-1)*50), where n = L-1
//   For L >= 7: T(L) = 1000 + 100*(L - 6)
const FIRST_LEVEL_DELTA = 100; // XP needed from level 1 -> 2
const PRE_STEP_INCREMENT = 50; // Increase in XP needed per level before reaching 1000 total
const PRE_MAX_STEPS = 5; // Number of steps from L1 to L6 (since T(6) = 1000)
const PRE_THRESHOLD_TOTAL = 1000; // T(6)
const POST_STEP_DELTA = 100; // Flat increase in total threshold per level after T >= 1000

function xpTotalThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1; // number of level-up steps completed
  if (n <= PRE_MAX_STEPS) {
    // Arithmetic series sum: n/2 * [2a + (n-1)d]
    return (n * (2 * FIRST_LEVEL_DELTA + (n - 1) * PRE_STEP_INCREMENT)) / 2;
  }
  // After reaching 1000 total XP at level 6, add 100 total XP per additional level
  return PRE_THRESHOLD_TOTAL + POST_STEP_DELTA * (n - PRE_MAX_STEPS);
}

export function xpCurrentThresholdForLevel(level: number): number {
  return xpTotalThresholdForLevel(level + 1) - xpTotalThresholdForLevel(level);
}

// XP rewards
export const XP_REWARDS = {
  HABIT_COMPLETION: 25,
  PLANET_COMPLETION: 200,
} as const;

// Helper functions for level calculations
export function calculateLevel(totalXP: number): number {
  let level = 1;
  // Increase level until totalXP is less than the next level's threshold
  while (totalXP >= xpTotalThresholdForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function getXPForNextLevel(currentLevel: number): number {
  return xpTotalThresholdForLevel(currentLevel + 1);
}

export function getCurrentLevelXP(totalXP: number): number {
  const level = calculateLevel(totalXP);
  return totalXP - xpTotalThresholdForLevel(level);
}

export function getXPToNextLevel(totalXP: number): number {
  const level = calculateLevel(totalXP);
  const nextLevelXP = getXPForNextLevel(level);
  return nextLevelXP - totalXP;
}

export function getLevelProgress(totalXP: number): number {
  const level = calculateLevel(totalXP);
  const currentLevelXP = xpTotalThresholdForLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const progressXP = totalXP - currentLevelXP;
  const totalNeeded = nextLevelXP - currentLevelXP;

  return Math.min(progressXP / totalNeeded, 1);
}

// Distance gained per habit completion for a given level
export function getHabitDistanceForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  const distance = 1_000_000 * Math.pow(1.2, L - 1);
  return Math.round(distance / 100_000) * 100_000;
}
