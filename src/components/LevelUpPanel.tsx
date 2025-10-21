import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import type { LevelUpInfo } from '../utils/store';
import { cBodies } from '../planets';
import { colors, fonts, fontSizes } from '../styles/theme';
import { FadingTextList, FadingLine } from './FadingTextList';

// Delays for title fade-in and text list rendering
const TITLE_FADE_IN_START_DELAY_MS = 500;
const TEXT_LIST_DELAY_MS = 750;

/**
 * Creates a hex color string from a 24-bit integer color.
 *
 * color: 24-bit integer color (e.g., 0xff00aa)
 * Returns: CSS hex string in the form '#rrggbb'.
 */
function intColorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Lightens a hex color by blending it toward white.
 *
 * hex: Color string in the form '#rrggbb'.
 * amount: Blend factor [0..1], where 0 is original and 1 is white.
 * Returns: Lightened CSS hex string '#rrggbb'.
 */
function lightenHex(hex: string, amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lr = clamp(r + (255 - r) * amount);
  const lg = clamp(g + (255 - g) * amount);
  const lb = clamp(b + (255 - b) * amount);

  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
}

/**
 * Formats a distance in kilometers with thousand separators.
 *
 * km: Distance in kilometers.
 * Returns: Formatted string like '1,234 km'.
 */
function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

/**
 * Displays Level Up content with line-by-line fade-in and an OK button that
 * fades in once the text finishes animating. The title "Level Up!" fades in
 * starting 500 ms after the component mounts, and the `FadingTextList` is
 * rendered 750 ms after the title fade starts.
 *
 * info: Structured level-up data to display.
 * onOk: Called when user confirms the Level Up view.
 * intervalMs: Optional per-line stagger interval.
 * Returns: JSX for the panel content.
 */
export function LevelUpPanel({
  info,
  onOk,
}: {
  info: LevelUpInfo;
  onOk: () => void;
}) {
  const okOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const [showList, setShowList] = useState(false);

  // Reset OK opacity whenever content changes to ensure animation runs every time
  useEffect(() => {
    okOpacity.setValue(0);
  }, [okOpacity, info.prevLevel, info.currLevel]);

  // Orchestrate title fade-in and delayed rendering of the text list
  useEffect(() => {
    titleOpacity.setValue(0);
    setShowList(false);

    let listTimer: ReturnType<typeof setTimeout> | undefined;
    const startTitleTimer = setTimeout(() => {
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      listTimer = setTimeout(() => {
        setShowList(true);
      }, TEXT_LIST_DELAY_MS);
    }, TITLE_FADE_IN_START_DELAY_MS);

    return () => {
      clearTimeout(startTitleTimer);
      if (listTimer) clearTimeout(listTimer);
    };
  }, [info.prevLevel, info.currLevel, titleOpacity]);

  const baseLines: FadingLine[] = [
    `Your level has increased from ${info.prevLevel} to ${info.currLevel}`,
    `Your daily travel length has increased from ${formatKm(info.prevDistanceKm)} to ${formatKm(info.currDistanceKm)}`,
  ];

  const fullDiscovered = info.discoveredBodies
    .map((name) => cBodies.find((b) => b.name === name))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map((b) => ({
      name: b.name,
      minLevel: (b.minLevel ?? 0) as number,
      colorHex: intColorToHex(b.color),
    }))
    .sort((a, b) => b.minLevel - a.minLevel);

  const top = fullDiscovered.slice(0, 4);
  const restCount = Math.max(0, fullDiscovered.length - top.length);
  const lightenAmt = 0.55;

  const discoveredLines: FadingLine[] = top.map((b) => ({
    content: (
      <Text style={styles.line}>
        <Text style={{ color: colors.white }}>Discovered: </Text>
        <Text style={{ color: lightenHex(b.colorHex, lightenAmt) }}>
          {b.name}
        </Text>
      </Text>
    ),
  }));

  const lines: FadingLine[] = [
    ...baseLines,
    ...discoveredLines,
    ...(restCount > 0 ? [`and ${restCount} others`] : []),
  ];

  return (
    <View>
      <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
        Level Up!
      </Animated.Text>
      {showList && (
        <FadingTextList
          key={`lvl-${info.prevLevel}-${info.currLevel}`}
          lines={lines}
          textStyle={styles.line}
          intervalMs={TEXT_LIST_DELAY_MS}
          onAllVisible={() => {
            setTimeout(() => {
              Animated.timing(okOpacity, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              }).start();
            }, 500);
          }}
        />
      )}
      <Animated.View style={{ opacity: okOpacity }}>
        <TouchableOpacity
          style={[styles.okBtn, styles.okBtnPrimary, { marginTop: 12 }]}
          onPress={onOk}
        >
          <Text style={styles.okText}>OK</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xlarge,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  line: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.white,
    textAlign: 'center',
    marginTop: 4,
  },
  okBtn: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  okBtnPrimary: {
    backgroundColor: colors.primary,
  },
  okText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
  },
});
