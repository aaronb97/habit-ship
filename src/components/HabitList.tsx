import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Habit, HabitId } from '../utils/store';
import { useGetCurrentDate } from '../utils/time';
import { MaterialIcons } from '@expo/vector-icons';

export type HabitListProps = {
  /** List of habits to render. */
  habits: Habit[];
  /** Called when the timer button is pressed for a habit. */
  onStartTimer: (habitId: HabitId) => void | Promise<boolean>;
  /** Called when the complete button is pressed for a habit. */
  onCompleteHabit: (habitId: HabitId) => void | Promise<void>;
};

/**
 * Renders the list of habits with their completion status, last completion info,
 * and actions for starting a timer or marking as complete.
 *
 * habits: List of habits to render.
 * onStartTimer: Invoked when the timer button is pressed for a habit.
 * onCompleteHabit: Invoked when the complete button is pressed for a habit.
 */
export function HabitList({ habits, onStartTimer, onCompleteHabit }: HabitListProps) {
  const getCurrentDate = useGetCurrentDate();

  /**
   * Determines whether a habit has been completed today based on its last completion timestamp.
   *
   * habit: The habit to evaluate.
   * @returns True if the last completion occurred today.
   */
  const isCompletedToday = (habit: Habit): boolean => {
    if (habit.completions.length === 0) {
      return false;
    }

    const lastCompletion = new Date(habit.completions[habit.completions.length - 1]!);
    const today = getCurrentDate();
    return lastCompletion.toDateString() === today.toDateString();
  };

  return (
    <>
      {habits.map((h, idx) => {
        const completed = isCompletedToday(h);
        const count = h.completions.length;

        // Precompute last completion strings if any
        const last = count > 0 ? new Date(h.completions[count - 1]!) : undefined;
        const today = getCurrentDate();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const lastStart = last
          ? new Date(last.getFullYear(), last.getMonth(), last.getDate())
          : undefined;
        const diffDays =
          lastStart !== undefined
            ? Math.round((todayStart.getTime() - lastStart.getTime()) / 86400000)
            : 0;
        const timeStr = last?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        const line1 =
          last === undefined
            ? undefined
            : diffDays === 0
              ? `completed today at ${timeStr}`
              : diffDays === 1
                ? 'completed yesterday'
                : `completed ${diffDays} days ago`;

        return (
          <View
            key={h.id}
            style={[
              styles.habitRow,
              idx < habits.length - 1 ? styles.habitRowDivider : null,
            ]}
          >
            <View style={styles.habitRowInfo}>
              <Text style={[styles.habitTitle, completed ? styles.completedHabitTitle : null]}>
                {h.title}
              </Text>
              {line1 ? (
                <>
                  <Text
                    style={[styles.habitDescription, completed ? styles.completedHabitTitle : null]}
                  >
                    {line1}
                  </Text>
                  {count > 1 ? (
                    <Text
                      style={[
                        styles.habitDescription,
                        completed ? styles.completedHabitTitle : null,
                      ]}
                    >
                      {`${count} completions`}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>

            <View style={styles.actionsRow}>
              {h.timerLength ? (
                <TimerButton habit={h} onPress={() => onStartTimer(h.id)} />
              ) : null}

              <CompleteButton
                isCompleted={completed}
                onPress={() => onCompleteHabit(h.id)}
              />
            </View>
          </View>
        );
      })}
    </>
  );
}

/**
 * Button to start a habit timer, showing the timer length in minutes.
 *
 * habit: Habit for which to start the timer.
 * onPress: Invoked when the button is pressed.
 */
function TimerButton({ habit, onPress }: { habit: Habit; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: colors.accent }]}
      onPress={onPress}
    >
      <MaterialIcons name="timer" size={20} color={colors.white} />
      <Text style={styles.actionButtonText}>{`${habit.timerLength! / 60} min`}</Text>
    </TouchableOpacity>
  );
}

/**
 * Button to mark a habit as complete. Shows a check icon and an optional label when completed.
 *
 * onPress: Invoked when the button is pressed.
 * isCompleted: Whether the habit has already been completed today.
 */
function CompleteButton({
  onPress,
  isCompleted,
}: {
  onPress: () => void;
  isCompleted: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={isCompleted}
      style={[
        styles.actionButton,
        { backgroundColor: isCompleted ? colors.darkGray : colors.primary },
      ]}
      onPress={onPress}
    >
      <MaterialIcons name="check" size={20} color={colors.white} />
      {isCompleted ? <Text style={styles.actionButtonText}>Done</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  habitRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  habitRowInfo: {
    flex: 1,
    paddingRight: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: '100%',
  },
  habitTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  completedHabitTitle: {
    color: colors.primaryText,
  },
  habitDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.white,
    opacity: 0.8,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  actionButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xsmall,
    color: colors.white,
  },
});
