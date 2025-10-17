import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useUserLevel } from '../utils/store';
import { cBodies } from '../planets';
import { getHabitDistanceForLevel } from '../types';
import { LevelUpModal } from './LevelUpModal';
import { useIsFocused } from '@react-navigation/native';

function formatNumber(n: number): string {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatKm(n: number): string {
  return `${formatNumber(n)} km`;
}

export function LevelUpListener() {
  const userLevel = useUserLevel();
  const prevLevelRef = useRef<number>(userLevel.level);

  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<(string | ReactNode)[]>([]);

  const isFocused = useIsFocused();

  useEffect(() => {
    const prev = prevLevelRef.current;
    const curr = userLevel.level;
    if (curr > prev && isFocused) {
      // Update ref immediately to avoid repeated triggers while modal is open
      prevLevelRef.current = curr;
      // Compute distance per habit change
      const prevDist = getHabitDistanceForLevel(prev);
      const currDist = getHabitDistanceForLevel(curr);

      const newBodies = cBodies.filter(
        (b) => b.minLevel && b.minLevel <= curr && b.minLevel > prev,
      );

      const bodyLines = newBodies.map((b) => `Discovered: ${b.name}`);

      const computedLines: (string | ReactNode)[] = [
        `Your level has increased from ${prev} to ${curr}`,
        `Habit completion travel length has increased from ${formatKm(
          prevDist,
        )} to ${formatKm(currDist)}`,
        ...bodyLines,
      ];

      setLines(computedLines);
      setVisible(true);
    } else if (curr < prev) {
      prevLevelRef.current = curr;
    }
  }, [userLevel.level, isFocused]);

  const close = () => {
    prevLevelRef.current = userLevel.level;
    setVisible(false);
  };

  return <LevelUpModal visible={visible} onClose={close} lines={lines} />;
}
