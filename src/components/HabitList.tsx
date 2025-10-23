import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { Habit, HabitId } from '../utils/store';
import { useGetCurrentDate } from '../utils/time';
import { MaterialIcons } from '@expo/vector-icons';
import { HSButton } from './HSButton';

export type HabitListProps = {
  /** List of habits to render. */
  habits: Habit[];
  /** Called when the timer button is pressed for a habit. */
  onStartTimer: (habitId: HabitId) => void | Promise<boolean>;
  /** Called when the complete button is pressed for a habit. */
  onCompleteHabit: (habitId: HabitId) => void | Promise<void>;
  onLongPressHabit?: (habitId: HabitId) => void;
};

/**
 * Renders the list of habits with their completion status, last completion info,
 * and actions for starting a timer or marking as complete.
 *
 * habits: List of habits to render.
 * onStartTimer: Invoked when the timer button is pressed for a habit.
 * onCompleteHabit: Invoked when the complete button is pressed for a habit.
 */
export function HabitList({
  habits,
  onStartTimer,
  onCompleteHabit,
  onLongPressHabit,
}: HabitListProps) {
  const getCurrentDate = useGetCurrentDate();
  const now = getCurrentDate();

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

    const lastCompletion = new Date(
      habit.completions[habit.completions.length - 1]!,
    );

    const today = getCurrentDate();
    return lastCompletion.toDateString() === today.toDateString();
  };

  return (
    <>
      {habits.map((h, idx) => {
        const completed = isCompletedToday(h);
        const line1 = getCompletionText(h, now);
        const hasDivider = idx < habits.length - 1;
        const showCount = h.completions.length > 1;
        return (
          <HabitRow
            key={h.id}
            habit={h}
            completed={completed}
            line1={line1}
            showCount={showCount}
            hasDivider={hasDivider}
            onStartTimer={onStartTimer}
            onCompleteHabit={onCompleteHabit}
            onLongPressHabit={onLongPressHabit}
          />
        );
      })}
    </>
  );
}

type HabitMetaTextProps = { completed: boolean; children: React.ReactNode };

function HabitMetaText({ completed, children }: HabitMetaTextProps) {
  return (
    <Text
      style={[
        styles.habitDescription,
        completed ? styles.completedHabitTitle : null,
      ]}
    >
      {children}
    </Text>
  );
}

type HabitRowProps = {
  habit: Habit;
  completed: boolean;
  line1?: string;
  showCount: boolean;
  hasDivider: boolean;
  onStartTimer: (habitId: HabitId) => void | Promise<boolean>;
  onCompleteHabit: (habitId: HabitId) => void | Promise<void>;
  onLongPressHabit?: (habitId: HabitId) => void;
};

function HabitRow({
  habit,
  completed,
  line1,
  showCount,
  hasDivider,
  onStartTimer,
  onCompleteHabit,
  onLongPressHabit,
}: HabitRowProps) {
  return (
    <View style={[styles.habitRow, hasDivider ? styles.habitRowDivider : null]}>
      <TouchableOpacity
        style={styles.habitRowInfo}
        onLongPress={
          onLongPressHabit ? () => onLongPressHabit(habit.id) : undefined
        }
      >
        <Text
          style={[
            styles.habitTitle,
            completed ? styles.completedHabitTitle : null,
          ]}
        >
          {habit.title}
        </Text>
        {line1 ? (
          <HabitMetaText completed={completed}>{line1}</HabitMetaText>
        ) : null}
        {showCount ? (
          <HabitMetaText completed={completed}>
            {`${habit.completions.length} completions`}
          </HabitMetaText>
        ) : null}
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        {habit.timerLength ? (
          <TimerButton habit={habit} onPress={() => onStartTimer(habit.id)} />
        ) : null}

        <CompleteButton
          isCompleted={completed}
          onPress={() => onCompleteHabit(habit.id)}
        />
      </View>
    </View>
  );
}

function getCompletionText(habit: Habit, now: Date): string | undefined {
  const count = habit.completions.length;
  if (count === 0) {
    return undefined;
  }

  const last = new Date(habit.completions[count - 1]!);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastStart = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate(),
  );

  const diffDays = Math.round(
    (todayStart.getTime() - lastStart.getTime()) / 86400000,
  );

  if (diffDays === 0) {
    const timeStr = last.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `completed today at ${timeStr}`;
  }

  if (diffDays === 1) {
    return 'completed yesterday';
  }

  return `completed ${diffDays} days ago`;
}

/**
 * Button to start a habit timer, showing the timer length in minutes.
 *
 * habit: Habit for which to start the timer.
 * onPress: Invoked when the button is pressed.
 */
function TimerButton({
  habit,
  onPress,
}: {
  habit: Habit;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: colors.accent }]}
      onPress={onPress}
    >
      <MaterialIcons name="timer" size={20} color={colors.white} />
      <Text
        style={styles.actionButtonText}
      >{`${habit.timerLength! / 60} min`}</Text>
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
    <HSButton
      disabled={isCompleted}
      style={[styles.actionButton]}
      onPress={onPress}
    >
      <MaterialIcons name="check" size={20} color={colors.white} />
      {isCompleted ? <Text style={styles.actionButtonText}>Done</Text> : null}
    </HSButton>
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
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  actionButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xsmall,
    color: colors.white,
  },
});
