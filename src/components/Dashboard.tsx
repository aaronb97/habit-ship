import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { GlassView, GlassViewProps } from 'expo-glass-effect';
import { colors, fonts, fontSizes } from '../styles/theme';
import { useIsTraveling, useStore, useUserLevel } from '../utils/store';
import { cBodies } from '../planets';
import { ProgressBar } from './ProgressBar';
import TimerSelection from './TimerSelection';
import { PlanetListItem } from './PlanetListItem';
import { useVisibleLandablePlanets } from '../hooks/usePlanets';
import {
  getLevelProgress,
  xpCurrentThresholdForLevel,
  getCurrentLevelXP,
  getDailyDistanceForLevel,
} from '../utils/experience';
import { useTimer } from 'react-timer-hook';
import { useGetCurrentDate } from '../utils/time';
import { LevelUpPanel } from './LevelUpPanel';
import { OnboardingPanel } from './OnboardingPanel';
import { HSTextInput } from './HSTextInput';
import { HabitList } from './HabitList';

export function Dashboard() {
  const {
    userPosition,
    clearData,
    habits,
    activeTimer,
    timeOffset,
    cancelTimer,
    startTimer,
    expireTimer,
    completeHabit,
    setDestination,
  } = useStore();

  const isSetupFinished = useStore((s) => s.isSetupFinished);
  const setIsSetupFinished = useStore((s) => s.setIsSetupFinished);
  const addHabit = useStore((s) => s.addHabit);

  const getCurrentDate = useGetCurrentDate();
  const fuelKm = useStore((s) => s.fuelKm);
  const showJourneyRemaining = useStore((s) => s.showJourneyRemaining);
  const setShowJourneyRemaining = useStore((s) => s.setShowJourneyRemaining);
  const showFuelCapacity = useStore((s) => s.showFuelCapacity);
  const setShowFuelCapacity = useStore((s) => s.setShowFuelCapacity);

  const isTraveling = useIsTraveling();
  const isLevelUpModalVisible = useStore((s) => s.isLevelUpModalVisible);
  const levelUpInfo = useStore((s) => s.levelUpInfo);
  const hideLevelUp = useStore((s) => s.hideLevelUp);
  const setLastLevelUpSeenLevel = useStore((s) => s.setLastLevelUpSeenLevel);
  const activeTab = useStore((s) => s.activeTab);

  const [mode, setMode] = useState<
    'default' | 'addHabit' | 'selectDestination'
  >('default');
  const [canCancelSelection, setCanCancelSelection] = useState<boolean>(true);

  // Add Habit state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTimer, setNewTimer] = useState(0);
  const titleInputRef = useRef<TextInput | null>(null);

  // Available destinations
  const visiblePlanets = useVisibleLandablePlanets();

  useEffect(() => {
    // Auto-open destination selection inline if no target and Home is focused
    if (
      activeTab === 'HomeTab' &&
      !isLevelUpModalVisible &&
      !userPosition.target
    ) {
      setCanCancelSelection(false);
      setMode('selectDestination');
    }
  }, [activeTab, isLevelUpModalVisible, userPosition.target]);

  // Auto-focus title when entering Add Habit mode
  useEffect(() => {
    if (mode === 'addHabit') {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 0);
    }
  }, [mode]);

  const displayLocation = isTraveling
    ? userPosition.target?.name
    : userPosition.startingLocation;

  const planet = cBodies.find((p) => p.name === displayLocation);
  const bodyHex = planet
    ? `#${planet.color.toString(16).padStart(6, '0')}`
    : colors.white;

  useEffect(() => {
    if (!planet) {
      clearData();
    }
  }, [planet, clearData]);

  let distancePercentage = 0;
  let distanceRemaining = 0;

  if (userPosition.target) {
    const { initialDistance, previousDistanceTraveled } = userPosition;
    if (typeof initialDistance === 'number' && initialDistance > 0) {
      const traveled = previousDistanceTraveled ?? 0;
      distancePercentage = Math.min(1, Math.max(0, traveled / initialDistance));
      distanceRemaining = Math.max(0, initialDistance - traveled);
    }
  }

  const level = useUserLevel();
  const { totalXP } = useStore();
  const levelProgress = getLevelProgress(totalXP);
  const levelThreshold = xpCurrentThresholdForLevel(level);
  const currentXP = getCurrentLevelXP(totalXP);
  const dailyFuelCap = getDailyDistanceForLevel(level);
  const fuelProgress =
    dailyFuelCap > 0 ? Math.min(1, fuelKm / dailyFuelCap) : 0;

  const timerHabit = activeTimer
    ? habits.find((h) => h.id === activeTimer.habitId)
    : undefined;

  const initialExpiryTimestamp = activeTimer
    ? new Date(
        new Date(activeTimer.startTime).getTime() -
          timeOffset +
          (timerHabit?.timerLength ?? 0) * 1000,
      )
    : getCurrentDate();

  const { minutes, seconds, hours, restart, pause } = useTimer({
    expiryTimestamp: initialExpiryTimestamp,
    autoStart: false,
    onExpire: () => expireTimer(),
  });

  useEffect(() => {
    if (activeTimer) {
      const habit = habits.find((h) => h.id === activeTimer.habitId);
      const timerLen = habit?.timerLength ?? 0;
      const expiry = new Date(
        new Date(activeTimer.startTime).getTime() -
          timeOffset +
          timerLen * 1000,
      );

      restart(expiry);
    } else {
      pause();
    }
  }, [activeTimer, timeOffset, habits, restart, pause]);

  const glassViewProps: GlassViewProps = {
    glassEffectStyle: 'clear',
    tintColor: 'rgba(0, 0, 0, 0.8)',
  };

  // --- Onboarding flow rendered inside the panel until setup finishes ---
  if (!isSetupFinished) {
    return (
      <GlassView
        style={[styles.container, styles.centered]}
        {...glassViewProps}
      >
        <OnboardingPanel
          onCreateFirstHabit={(title) => addHabit({ title })}
          onComplete={() => setIsSetupFinished(true)}
        />
      </GlassView>
    );
  }

  if (isLevelUpModalVisible && levelUpInfo && activeTab === 'HomeTab') {
    return (
      <GlassView style={styles.container} {...glassViewProps}>
        <LevelUpPanel
          info={levelUpInfo}
          onOk={() => {
            setLastLevelUpSeenLevel(levelUpInfo.currLevel);
            hideLevelUp();
          }}
        />
      </GlassView>
    );
  }

  // Timer screen shows when active and not blocked by Level Up view
  if (activeTimer && timerHabit) {
    return (
      <GlassView
        style={[styles.container, styles.centered]}
        {...glassViewProps}
      >
        <Text style={styles.timerTitle}>{timerHabit.title}</Text>
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{`${hours * 60 + minutes}:${seconds
            .toString()
            .padStart(2, '0')}`}</Text>
        </View>
        <TouchableOpacity style={styles.cancelButton} onPress={cancelTimer}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </GlassView>
    );
  }

  /**
   * Handles confirming and setting a new destination, preserving current
   * alert behaviors when already traveling.
   *
   * planetName: Target planet name to set as destination.
   * Returns: void
   */
  function handleSetDestination(planetName: string) {
    if (isTraveling) {
      Alert.alert(
        'Change Destination',
        'You are currently traveling. Changing your destination will reset your progress toward the current destination. Are you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Change Destination',
            style: 'destructive',
            onPress: () => {
              setDestination(planetName);
              setMode('default');
            },
          },
        ],
      );
    } else {
      Alert.alert('Set Destination', `Set ${planetName} as your destination?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Destination',
          onPress: () => {
            setDestination(planetName);
            setMode('default');
          },
        },
      ]);
    }
  }

  // Inline Add Habit flow
  if (mode === 'addHabit') {
    const isFormValid = newTitle.trim().length > 0;
    return (
      <GlassView style={styles.container} {...glassViewProps}>
        <View style={styles.flowHeader}>
          <TouchableOpacity
            onPress={() => {
              setNewTitle('');
              setNewDescription('');
              setNewTimer(0);
              setMode('default');
            }}
          >
            <Text style={styles.flowHeaderButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.flowHeaderTitle}>New Habit</Text>
          <TouchableOpacity
            disabled={!isFormValid}
            onPress={() => {
              if (!isFormValid) return;
              addHabit({
                title: newTitle.trim(),
                description: newDescription.trim() || undefined,
                timerLength: newTimer > 0 ? newTimer : undefined,
              });
              setNewTitle('');
              setNewDescription('');
              setNewTimer(0);
              setMode('default');
            }}
          >
            <Text
              style={[
                styles.flowHeaderButton,
                styles.flowHeaderPrimary,
                !isFormValid && styles.flowHeaderDisabled,
              ]}
            >
              Create
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flowContent}>
          <HSTextInput
            ref={titleInputRef}
            autoFocus
            placeholder="Habit Title (e.g., Morning Run)"
            value={newTitle}
            onChangeText={setNewTitle}
          />

          <HSTextInput
            placeholder="Description (optional)"
            value={newDescription}
            onChangeText={setNewDescription}
          />

          <View style={styles.labelRow}>
            <Text style={styles.labelText}>Timer</Text>
            <Text style={styles.subLabelText}>(optional)</Text>
          </View>
          <TimerSelection onTimerChange={setNewTimer} initialTimer={newTimer} />
        </View>
      </GlassView>
    );
  }

  // Inline Select Destination flow
  if (mode === 'selectDestination') {
    return (
      <GlassView style={styles.container} {...glassViewProps}>
        <View style={styles.flowHeader}>
          {canCancelSelection ? (
            <TouchableOpacity
              onPress={() => {
                setMode('default');
              }}
            >
              <Text style={styles.flowHeaderButton}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.flowHeaderButton, { opacity: 0 }]}>
              Cancel
            </Text>
          )}
          <View style={styles.flowHeaderTitleContainer}>
            <Text style={styles.flowHeaderTitle}>
              {!canCancelSelection
                ? 'Select Next Destination'
                : 'Change Destination'}
            </Text>
            {!canCancelSelection ? (
              <Text style={styles.flowHeaderSubTitle}>
                You can change this later by tapping the destination name.
              </Text>
            ) : null}
          </View>
          {/* Spacer to balance layout */}
          <Text style={[styles.flowHeaderButton, { opacity: 0 }]}>Cancel</Text>
        </View>
        <ScrollView
          style={styles.flowScroll}
          contentContainerStyle={styles.flowScrollContent}
        >
          {visiblePlanets.map(
            ({ planet: body, distance, disabledReason, isVisited }) => (
              <PlanetListItem
                key={body.name}
                planet={body}
                distance={distance}
                disabledReason={disabledReason}
                isVisited={isVisited}
                onPress={() => handleSetDestination(body.name)}
              />
            ),
          )}
        </ScrollView>
      </GlassView>
    );
  }

  const renderProgressItem = (
    left: string,
    right: string,
    progress: number,
    barColor: string,
  ) => (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{left}</Text>
        <Text style={styles.progressValue}>{right}</Text>
      </View>
      <ProgressBar
        progress={progress}
        color={barColor}
        backgroundColor={'rgba(255,255,255,0.2)'}
      />
    </View>
  );

  return (
    <GlassView style={styles.container} {...glassViewProps}>
      {!!planet && (
        <View style={styles.journeySection}>
          <View style={styles.planetInfoContainer}>
            {!isTraveling && (
              <Text style={[styles.statusText, { color: bodyHex }]}>
                Welcome to
              </Text>
            )}
            {isTraveling && (
              <Text style={[styles.statusText, { color: bodyHex }]}>
                En route to
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setCanCancelSelection(true);
                setMode('selectDestination');
              }}
            >
              <Text style={[styles.planetTitle, { color: bodyHex }]}>
                {planet.name}
              </Text>
            </TouchableOpacity>
            {!isTraveling && userPosition.target && fuelKm > 0 ? (
              <Text style={[styles.statusText, { color: bodyHex }]}>
                Open the map tab to launch to {userPosition.target.name}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowJourneyRemaining(!showJourneyRemaining)}
          >
            {renderProgressItem(
              showJourneyRemaining ? 'Distance Remaining' : 'Journey Progress',
              showJourneyRemaining
                ? `${distanceRemaining.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })} km`
                : `${(distancePercentage * 100).toFixed(1)}%`,
              distancePercentage,
              colors.primary,
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.levelSection}>
        {renderProgressItem(
          `Level ${level}`,
          `${currentXP} / ${levelThreshold} XP`,
          levelProgress,
          colors.accent,
        )}
      </View>

      <View style={styles.levelSection}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowFuelCapacity(!showFuelCapacity)}
        >
          {renderProgressItem(
            'Fuel',
            showFuelCapacity
              ? `${fuelKm.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} km / ${dailyFuelCap.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} km`
              : `${fuelKm.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} km`,
            fuelProgress,
            '#90EE90',
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.habitsHeaderRow}>
        <TouchableOpacity onPress={() => setMode('addHabit')}>
          <Text style={styles.newHabitText}>+ New Habit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.habitsList}
        contentContainerStyle={styles.habitsListContent}
      >
        <HabitList
          habits={habits}
          onStartTimer={startTimer}
          onCompleteHabit={completeHabit}
        />
      </ScrollView>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  centered: {
    alignItems: 'center',
  },
  onboardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xlarge,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  levelSection: {
    marginBottom: 12,
  },
  levelText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  levelSubText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 6,
  },
  journeySection: {
    marginBottom: 12,
  },
  planetInfoContainer: {
    marginBottom: 12,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.small,
    color: colors.white,
    opacity: 0.85,
    textAlign: 'center',
    marginTop: 2,
  },
  planetTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.white,
    textAlign: 'center',
  },
  progressContainer: {
    // marginVertical: 6,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
  },
  progressValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.medium,
    color: colors.white,
    opacity: 0.9,
  },
  habitsHeaderRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  newHabitText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
  habitsList: {
    maxHeight: 320,
  },
  habitsListContent: {
    paddingBottom: 4,
  },
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
  rowButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowButtonSpacing: {
    marginLeft: 8,
  },
  rowButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.small,
    color: colors.white,
  },
  rowButtonLabel: {
    marginLeft: 6,
  },
  timerTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxlarge,
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  timerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  timerText: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.white,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cancelButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
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
  // Inline flows (Add Habit, Select Destination)
  flowHeader: {},
  flowHeaderButton: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.primaryText,
  },
  flowHeaderPrimary: {
    fontFamily: fonts.semiBold,
  },
  flowHeaderDisabled: {
    color: colors.grey,
  },
  flowHeaderTitleContainer: {
    gap: 4,
  },
  flowHeaderTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
    textAlign: 'center',
  },
  flowHeaderSubTitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: colors.white,
    textAlign: 'center',
  },
  flowContent: {
    paddingTop: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  labelText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.white,
  },
  subLabelText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  flowScroll: {
    maxHeight: 450,
  },
  flowScrollContent: {
    paddingBottom: 8,
  },
});
export default Dashboard;
