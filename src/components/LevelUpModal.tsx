import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';

export type LevelUpModalProps = {
  visible: boolean;
  onClose: () => void;
  lines: (string | ReactNode)[];
  title?: string;
};

export function LevelUpModal({
  visible,
  onClose,
  lines,
  title = 'Level Up!',
}: LevelUpModalProps) {
  const animsRef = useRef<Animated.Value[]>([]);
  const titleAnimRef = useRef(new Animated.Value(0));
  const okAnimRef = useRef(new Animated.Value(0));
  const [showOk, setShowOk] = useState(false);

  // Ensure we have one Animated.Value per line BEFORE render so styles reference
  // the same objects that will be animated.
  if (animsRef.current.length !== lines.length) {
    animsRef.current = lines.map(() => new Animated.Value(0));
  }

  // Reset anim values whenever lines change or modal opens
  useEffect(() => {
    if (!visible) {
      return;
    }

    // reset anim values
    titleAnimRef.current.setValue(0);
    animsRef.current.forEach((v) => v.setValue(0));
    okAnimRef.current.setValue(0);
    setShowOk(false);

    const titleIn = Animated.timing(titleAnimRef.current, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    });

    const lineAnimations = animsRef.current.map((v) =>
      Animated.timing(v, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    );

    // Sequence: title -> first line (distance) -> remaining lines (bodies) staggered
    const hasLines = lineAnimations.length > 0;
    const hasBodies = lineAnimations.length > 1;
    const distanceAnim = hasLines ? lineAnimations[0] : undefined;
    const bodiesAnims = hasBodies ? lineAnimations.slice(1) : [];

    const sequence: Animated.CompositeAnimation[] = [titleIn];
    // Ensure 1s between title and distance
    if (distanceAnim) {
      sequence.push(Animated.delay(500), distanceAnim);
    }

    // Ensure 1s between distance and first body, and 1s between each body (based on previous end)
    if (bodiesAnims.length > 0) {
      const bodiesSeq: Animated.CompositeAnimation[] = [];
      bodiesAnims.forEach((anim, idx) => {
        if (idx === 0) {
          bodiesSeq.push(anim);
        } else {
          bodiesSeq.push(Animated.delay(500), anim);
        }
      });

      sequence.push(Animated.delay(500), ...bodiesSeq, Animated.delay(500));
    }

    Animated.sequence(sequence).start(() => {
      setShowOk(true);
    });
  }, [lines, visible]);

  // Animate OK button when it becomes visible
  useEffect(() => {
    if (!showOk) {
      return;
    }

    okAnimRef.current.setValue(0);
    Animated.timing(okAnimRef.current, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showOk]);

  const handleClose = () => {
    // Keep content as-is while the Modal fades out to avoid layout shrink
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleAnimRef.current,
                transform: [
                  {
                    translateY: titleAnimRef.current.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {title}
          </Animated.Text>

          <View style={styles.content}>
            {lines.map((line, i) => {
              const v = animsRef.current[i]!;
              const translateY = v.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              });

              return (
                <Animated.View
                  key={`lvl-line-${i}`}
                  style={{
                    opacity: v,
                    transform: [{ translateY }],
                    marginBottom: 10,
                  }}
                >
                  {typeof line === 'string' ? (
                    <Text style={styles.lineText}>{line}</Text>
                  ) : (
                    line
                  )}
                </Animated.View>
              );
            })}
          </View>

          {showOk ? (
            <View style={styles.footer}>
              <TouchableOpacity activeOpacity={0.8} onPress={handleClose}>
                <Animated.View
                  style={[
                    styles.okButton,
                    {
                      opacity: okAnimRef.current,
                      transform: [
                        {
                          translateY: okAnimRef.current.interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.okButtonText}>OK</Text>
                </Animated.View>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    minHeight: 200,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    minHeight: 300,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
  },
  lineText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.large,
    color: colors.primaryText,
    textAlign: 'center',
  },
  okButton: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  okButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
});
