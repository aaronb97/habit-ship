import { GlassView } from 'expo-glass-effect';
import { useState, useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';

// ----- Debug Overlay Component -----
export function DebugOverlay(props: {
  values: { [k: string]: number };
  expanded: boolean;
  onToggle: () => void;
  history: Record<string, { t: number; v: number }[]>;
  minMax: Record<string, { min: number; max: number }>;
}) {
  const [, setLastRender] = useState<number>(0);

  useEffect(() => {
    const intervalId = setInterval(
      () => setLastRender((count) => count + 1),
      500,
    );

    return () => clearInterval(intervalId);
  }, []);

  const { values, expanded, onToggle, history, minMax } = props;
  const entries = Object.entries(values);

  return (
    <GlassView style={styles.glassView} glassEffectStyle="clear">
      <Pressable style={styles.debugOverlay} onPress={onToggle}>
        {entries.map(([k, v]) => (
          <View key={k} style={styles.debugRow}>
            <Text style={styles.debugText}>
              {k}: {Number.isFinite(v) ? v.toFixed(3) : '—'}
            </Text>
          </View>
        ))}
        {expanded ? (
          <View style={styles.debugGraphs}>
            {entries.map(([k]) => {
              const stats = minMax[k];
              const min = stats?.min ?? 0;
              const max = stats?.max ?? 1;
              return (
                <View key={`g-${k}`} style={styles.debugGraphBlock}>
                  <Text style={styles.debugGraphLabel}>{k}</Text>
                  <MiniBarGraph
                    data={history[k] ?? []}
                    height={20}
                    width={220}
                    min={min}
                    max={max}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </Pressable>
    </GlassView>
  );
}

function MiniBarGraph(props: {
  data: { t: number; v: number }[];
  width: number;
  height: number;
  min: number;
  max: number;
}) {
  const { data, width, height, min, max } = props;
  // Use last 10s already pruned; cap bars for perf
  const cap = 120;
  const len = data.length;
  const sampled = data.length < cap ? data : data.slice(len - cap, len);

  const range = Math.max(1e-6, max - min);

  return (
    <View style={[styles.graphContainer, { width, height }]}>
      <View style={styles.graphBars}>
        {sampled.map((sample) => {
          const h = ((sample.v - min) / range) * height;
          return (
            <View
              key={sample.t}
              style={{
                width: 1,
                height: Math.max(1, Math.floor(h)),
                backgroundColor: 'rgba(0,200,255,0.9)',
                marginRight: 1,
                alignSelf: 'flex-end',
              }}
            />
          );
        })}
      </View>
      <View style={styles.graphAxisLabels}>
        <Text style={styles.graphAxisText}>{max.toFixed(2)}</Text>
        <Text style={styles.graphAxisText}>{min.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassView: {
    borderRadius: 8,
  },
  debugOverlay: {
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
    maxWidth: 260,
  },
  debugHeader: {
    color: '#9BE7FF',
    fontSize: 12,
    marginBottom: 4,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
  },
  debugGraphs: {
    marginTop: 8,
  },
  debugGraphBlock: {
    marginBottom: 8,
  },
  debugGraphLabel: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 4,
  },
  graphContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    padding: 4,
  },
  graphBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
  },
  graphAxisLabels: {
    position: 'absolute',
    top: 2,
    right: 4,
    bottom: 2,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  graphAxisText: {
    color: '#9BE7FF',
    fontSize: 9,
  },
});
