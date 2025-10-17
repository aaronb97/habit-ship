/**
 * Returns the total XP threshold for the given level.
 */
function xpTotalThresholdForLevel(level: number): number {
  // Sum per-level requirements up to the given level (1-indexed)
  if (!Number.isFinite(level) || level <= 0) return 0;
  const L = Math.floor(level);
  let total = 0;
  for (let i = 1; i <= L; i++) total += xpCurrentThresholdForLevel(i);
  return total;
}

// Tweakable config for XP requirements
export const XP_CONFIG = {
  // Per-level (1-indexed) requirement for level 1
  baseRequirement: 100,
  // Increment added for each next level up to and including switchIncrementLevel
  firstIncrement: 50,
  // Levels up to this level use firstIncrement; from the next level onward use secondIncrement
  switchIncrementLevel: 19,
  // Increment added per level after switchIncrementLevel
  secondIncrement: 100,
} as const;

/**
 * Returns the XP requirement for the given level (per-level threshold, not cumulative).
 */
export function xpCurrentThresholdForLevel(level: number): number {
  const {
    baseRequirement,
    firstIncrement,
    switchIncrementLevel,
    secondIncrement,
  } = XP_CONFIG;

  const L = Math.max(1, Math.floor(level));
  if (L === 1) return baseRequirement;

  if (L <= switchIncrementLevel) {
    // Linear growth with first increment
    return baseRequirement + firstIncrement * (L - 1);
  }

  // After the switch, continue growth using second increment
  const atSwitch = baseRequirement + firstIncrement * (switchIncrementLevel - 1);
  return atSwitch + secondIncrement * (L - switchIncrementLevel);
}

// Compute current level and boundaries using a simple linear scan.
// Level is defined as the smallest L such that cumulative(L) > totalXP.
function getLevelBounds(totalXP: number): {
  level: number;
  startXP: number; // cumulative XP at the start of current level
  endXP: number; // cumulative XP needed to reach the next level
} {
  const t = Math.max(0, totalXP);
  let level = 1;
  let startXP = 0;
  let need = xpCurrentThresholdForLevel(level);
  // Advance while we've met or exceeded the end of the current level
  while (t >= startXP + need) {
    startXP += need;
    level += 1;
    need = xpCurrentThresholdForLevel(level);
  }
  return { level, startXP, endXP: startXP + need };
}

// XP rewards
export const XP_REWARDS = {
  HABIT_COMPLETION: 25,
  PLANET_COMPLETION: 200,
} as const;

// Helper functions for level calculations
export function calculateLevel(totalXP: number): number {
  return getLevelBounds(totalXP).level;
}

export function getXPForNextLevel(currentLevel: number): number {
  return xpTotalThresholdForLevel(currentLevel + 1);
}

export function getCurrentLevelXP(totalXP: number): number {
  const { startXP } = getLevelBounds(totalXP);
  return Math.max(0, totalXP - startXP);
}

export function getXPToNextLevel(totalXP: number): number {
  const { endXP } = getLevelBounds(totalXP);
  return Math.max(0, endXP - totalXP);
}

/**
 * Returns the progress of the current level as a percentage.
 * Should return 0 when the totalXP is right on the threshold for the current level. (empty level progress bar)
 */
export function getLevelProgress(totalXP: number): number {
  const { startXP, endXP } = getLevelBounds(totalXP);
  const denom = endXP - startXP;
  if (denom <= 0) return 0;
  const ratio = (totalXP - startXP) / denom;
  // Clamp to [0, 1]; exact threshold will map to 0 when level increments
  return Math.max(0, Math.min(1, ratio));
}

// Distance gained per habit completion for a given level
export function getHabitDistanceForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  const distance = 1_000_000 * Math.pow(1.2, L - 1);
  return Math.round(distance / 100_000) * 100_000;
}
