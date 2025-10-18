import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore, useUserLevel } from '../utils/store';
import { cBodies } from '../planets';
import { LevelUpModal } from './LevelUpModal';
import { useIsFocused } from '@react-navigation/native';
import { getHabitDistanceForLevel } from '../utils/experience';

function formatNumber(n: number): string {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatKm(n: number): string {
  return `${formatNumber(n)} km`;
}

export function LevelUpListener() {
  const currentLevel = useUserLevel();
  const prevLevelRef = useRef<number>(currentLevel);

  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<(string | ReactNode)[]>([]);

  const isFocused = useIsFocused();
  const { setLevelUpModalVisible } = useStore();

  useEffect(() => {
    const prev = prevLevelRef.current;
    const curr = currentLevel;
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
      setLevelUpModalVisible(true);
    } else if (curr < prev) {
      prevLevelRef.current = curr;
    }
  }, [currentLevel, isFocused, setLevelUpModalVisible]);

  const close = () => {
    prevLevelRef.current = currentLevel;
    setVisible(false);
    setLevelUpModalVisible(false);
  };

  return <LevelUpModal visible={visible} onClose={close} lines={lines} />;
}
