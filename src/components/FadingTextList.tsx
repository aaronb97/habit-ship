import React, { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, TextStyle, View, StyleSheet } from 'react-native';
import { fonts, fontSizes, colors } from '../styles/theme';

export type FadingLine =
  | string
  | ReactNode
  | { content: string | ReactNode; style?: TextStyle };

/**
 * Type guard to detect a styled fading line object.
 *
 * l: Candidate value to test.
 * Returns: True if the value has a 'content' field.
 */
function isStyledLine(
  l: unknown,
): l is { content: string | ReactNode; style?: TextStyle } {
  return (
    typeof l === 'object' &&
    l !== null &&
    'content' in (l as Record<string, unknown>)
  );
}

/**
 * Renders a list of lines that fade in sequentially. Accepts either simple strings
 * (backwards compatible) or per-line objects with custom style or ReactNode content.
 *
 * lines: Array of strings, ReactNodes, or objects with { content, style }.
 * intervalMs: Delay between each line's fade-in start, in milliseconds.
 * textStyle: Default text style applied to string lines.
 * onAllVisible: Callback invoked after the last line finishes animating.
 *
 * Returns: JSX element containing the animated lines.
 */
export function FadingTextList({
  lines,
  intervalMs = 2000,
  textStyle = styles.line,
  onAllVisible,
}: {
  lines: FadingLine[];
  intervalMs?: number;
  textStyle?: TextStyle;
  onAllVisible?: () => void;
}) {
  const normalized = lines.map((l) =>
    isStyledLine(l)
      ? l
      : ({ content: l } as { content: string | ReactNode; style?: TextStyle }),
  );

  const opacitiesRef = useRef<Animated.Value[]>([]);
  if (opacitiesRef.current.length !== normalized.length) {
    opacitiesRef.current = normalized.map(() => new Animated.Value(0));
  }
  const opacities = opacitiesRef.current;

  useEffect(() => {
    const animations = opacities.map((o) =>
      Animated.timing(o, { toValue: 1, duration: 400, useNativeDriver: true }),
    );
    const stagger = Animated.stagger(intervalMs, animations);
    stagger.start(() => {
      onAllVisible?.();
    });
    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [intervalMs, onAllVisible, opacities]);

  return (
    <View>
      {normalized.map((item, idx) => {
        const key = `line-${idx}`;
        if (typeof item.content === 'string') {
          return (
            <Animated.Text
              key={key}
              style={[textStyle, item.style, { opacity: opacities[idx] }]}
            >
              {item.content}
            </Animated.Text>
          );
        }

        // Center ReactNode lines automatically
        return (
          <Animated.View
            key={key}
            style={{
              opacity: opacities[idx],
              alignItems: 'center',
              width: '100%',
            }}
          >
            {item.content}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.white,
    textAlign: 'center',
    marginTop: 6,
  },
});
