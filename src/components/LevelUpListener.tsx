import { useEffect, useRef } from 'react';
import { useStore, useUserLevel } from '../utils/store';
import { cBodies } from '../planets';
import { getDailyDistanceForLevel } from '../utils/experience';

/**
 * Subscribes to level changes and populates structured inline Level Up info
 * on the store. Sequencing with other flows is handled via store flags.
 * Returns: null (no UI rendered).
 */
export function LevelUpListener() {
  const currentLevel = useUserLevel();
  const prevLevelRef = useRef<number>(currentLevel);
  const showLevelUp = useStore((s) => s.showLevelUp);
  const lastLevelUpSeenLevel = useStore((s) => s.lastLevelUpSeenLevel);
  const unlockRandomRocketSkin = useStore((s) => s.unlockRandomRocketSkin);

  useEffect(() => {
    const prev = prevLevelRef.current;
    const curr = currentLevel;
    if (curr > prev) {
      prevLevelRef.current = curr;
      const fromLevel = lastLevelUpSeenLevel ?? prev;
      const prevDist = getDailyDistanceForLevel(fromLevel);
      const currDist = getDailyDistanceForLevel(curr);

      const newBodies = cBodies
        .filter((b) => b.minLevel && b.minLevel <= curr && b.minLevel > fromLevel)
        .map((b) => b.name);

      const awarded = unlockRandomRocketSkin();
      showLevelUp({
        prevLevel: fromLevel,
        currLevel: curr,
        prevDistanceKm: prevDist,
        currDistanceKm: currDist,
        discoveredBodies: newBodies,
        awardedSkinId: awarded,
      });
    } else if (curr < prev) {
      prevLevelRef.current = curr;
    }
  }, [currentLevel, showLevelUp, lastLevelUpSeenLevel, unlockRandomRocketSkin]);

  return null;
}
