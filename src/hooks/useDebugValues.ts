import { useRef, useState } from 'react';
import { getCurrentTime } from '../utils/time';

export type DebugSeries = Record<string, { t: number; v: number }[]>;
export type DebugMinMax = Record<string, { min: number; max: number }>;

export function useDebugValues(options?: { windowMs?: number }) {
  const windowMs = options?.windowMs ?? 10000;

  const [values, setValues] = useState<Record<string, number>>({});
  const historyRef = useRef<DebugSeries>({});
  const minMaxRef = useRef<DebugMinMax>({});

  const publish = (vals: Record<string, number>) => {
    const now = getCurrentTime();

    for (const [k, v] of Object.entries(vals)) {
      // append sample
      const arr = historyRef.current[k] ?? (historyRef.current[k] = []);
      arr.push({ t: now, v });

      // prune to window
      const cutoff = now - windowMs;
      while (arr.length > 0 && (arr[0]?.t ?? Infinity) < cutoff) arr.shift();

      // track overall min/max
      const stats = minMaxRef.current[k];
      if (stats) {
        if (v < stats.min) stats.min = v;
        if (v > stats.max) stats.max = v;
      } else {
        minMaxRef.current[k] = { min: v, max: v };
      }
    }

    // trigger re-render consumers
    setValues(vals);
  };

  return {
    values,
    history: historyRef.current,
    minMax: minMaxRef.current,
    publish,
  } as const;
}
