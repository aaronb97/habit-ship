import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { earth, moon, cBodies } from '../planets';
import { schedulePushNotification } from './schedulePushNotification';
import { getCurrentTime, getCurrentDate } from './time';
import { Coordinates, UserPosition, XPGain } from '../types';
import { useShallow } from 'zustand/shallow';
import { XP_REWARDS, calculateLevel } from './experience';

// =================================================================
// TYPES
// =================================================================

export type HabitId = string & { __habitId: true };

export type Habit = {
  id: HabitId;
  title: string;
  description?: string;
  completions: string[];
  timerLength?: number; // in seconds
};

// =================================================================
// HELPER FUNCTIONS
// =================================================================

export function calculateDistance(a: Coordinates, b: Coordinates): number {
  return Math.sqrt(
    Math.pow(b[0] - a[0], 2) +
      Math.pow(b[1] - a[1], 2) +
      Math.pow(b[2] - a[2], 2),
  );
}

function randomColorInt(): number {
  // Generate a pastel color
  const base = Math.floor(Math.random() * 0x7f7f7f);
  const pastel = base + 0x7f7f7f;
  return pastel;
}

export function getPlanetPosition(planetName: string): Coordinates {
  const planet = cBodies.find((p) => p.name === planetName);
  if (!planet) throw new Error(`Planet ${planetName} not found`);

  return planet.getPosition();
}

// Distance awarded per habit completion based on level
function getHabitDistancePerCompletion(level: number): number {
  // 1,000,000 km base, scaled by 1.2^(level - 1)
  const L = Math.max(1, Math.floor(level));
  return 1_000_000 * Math.pow(1.2, L - 1);
}

// =================================================================
// STORE DEFINITION
// =================================================================

type Store = {
  isSetupFinished: boolean;
  habits: Habit[];
  userPosition: UserPosition;
  completedPlanets: string[];
  totalXP: number;
  xpHistory: XPGain[];
  idCount: number;
  activeTimer?: {
    habitId: HabitId;
    startTime: string;
    timerNotificationId: string;
  };
  swipedHabitId?: HabitId;
  lastUpdateTime?: number;
  timeOffset: number;
  // Render/debug toggles
  showTrails: boolean;
  showTextures: boolean;
  showDebugOverlay: boolean;

  // Tilt-shift (miniature) post-processing controls
  tiltShiftEnabled: boolean;
  // normalized [0..1] focus band center (vertical UV)
  tiltShiftFocus: number;
  // normalized [0..1] sharp half-width
  tiltShiftRange: number;
  // normalized [0..1] soft falloff beyond range
  tiltShiftFeather: number;
  // blur radius in pixels at maximum blur
  tiltShiftBlur: number;

  // Rocket appearance
  rocketColor: number;

  // Animation/landing flow flags
  // True when there is visual travel to animate between previousDistanceTraveled -> distanceTraveled
  pendingTravelAnimation: boolean;
  // True when user has reached target distance but landing should be finalized after the map animation
  pendingLanding: boolean;
  // True after landing has been finalized and Home should prompt/select next destination
  justLanded: boolean;
  // True while the Level Up modal is visible; used to sequence other modals
  isLevelUpModalVisible: boolean;

  // Actions
  setIsSetupFinished: (value: boolean) => void;
  setDestination: (planetName: string) => void;
  warpTo: (planetName: string) => void;
  // Mark that the user has visually seen the latest travel progress; sync prev->curr
  syncTravelVisuals: () => void;
  addHabit: (habit: {
    title: string;
    description?: string;
    timerLength?: number; // in seconds
  }) => void;

  editHabit: (
    habitId: HabitId,
    editedHabit: Partial<Omit<Habit, 'id'>>,
  ) => void;

  removeHabit: (habitId: HabitId) => void;
  setSwipedHabit: (habitId?: HabitId) => void;
  resetAllSwipes: () => void;
  addXP: (
    amount: number,
    source: 'habit_completion' | 'planet_completion',
  ) => void;
  quickReset: () => void;
  clearData: () => void;
  setShowTrails: (value: boolean) => void;
  setShowTextures: (value: boolean) => void;
  setShowDebugOverlay: (value: boolean) => void;
  setLevelUpModalVisible: (value: boolean) => void;

  // Tilt-shift setters
  setTiltShiftEnabled: (value: boolean) => void;
  setTiltShiftFocus: (value: number) => void;
  setTiltShiftRange: (value: number) => void;
  setTiltShiftFeather: (value: number) => void;
  setTiltShiftBlur: (value: number) => void;

  completeHabit: (habitId: HabitId) => Promise<void>;
  startTimer: (habitId: HabitId) => Promise<boolean>; // Returns true on success, false on failure
  cancelTimer: () => Promise<void>;
  expireTimer: () => void; // Sync action is sufficient here

  // Finalize landing after the SolarSystemMap finishes animating the last step
  finalizeLandingAfterAnimation: () => void;
  // Clear the justLanded flag after Home acknowledged the landing
  acknowledgeLandingOnHome: () => void;
};

const initialData = {
  isSetupFinished: false,
  habits: [],
  userPosition: {
    startingLocation: 'Earth',
  },
  completedPlanets: ['Earth'],
  totalXP: 0,
  xpHistory: [],
  idCount: 5,
  swipedHabitId: undefined,
  activeTimer: undefined,
  lastUpdateTime: undefined,
  timeOffset: 0,
  showTrails: true,
  showTextures: true,
  showDebugOverlay: false,
  tiltShiftEnabled: true,
  // tiltShiftFocus: 0.55,
  // tiltShiftRange: 0,
  // tiltShiftFeather: 0.4,
  // tiltShiftBlur: 1.5,
  tiltShiftFocus: 0.53,
  tiltShiftRange: 0.16,
  tiltShiftFeather: 0.04,
  tiltShiftBlur: 1,
  rocketColor: randomColorInt(),
  pendingTravelAnimation: false,
  pendingLanding: false,
  justLanded: false,
  isLevelUpModalVisible: false,
} satisfies Partial<Store>;

export const useStore = create<Store>()(
  persist(
    immer((set, get) => ({
      ...initialData,

      setIsSetupFinished: (value) => set({ isSetupFinished: value }),
      addHabit: (habit) => {
        set((state) => {
          state.habits.push({
            ...habit,
            timerLength: habit.timerLength || undefined,
            id: state.idCount.toString() as HabitId,
            completions: [],
          });

          state.idCount++;
        });
      },

      editHabit: (habitId, editedHabit) => {
        set((state) => {
          const habitToEdit = state.habits.find((h) => h.id === habitId);
          if (habitToEdit) {
            Object.assign(habitToEdit, editedHabit);
          }
        });
      },

      removeHabit: (habitId) => {
        set((state) => {
          const habitIndex = state.habits.findIndex((h) => h.id === habitId);
          if (habitIndex !== -1) {
            state.habits.splice(habitIndex, 1);
          }
        });
      },

      setDestination: (planetName) => {
        set((state) => {
          state.userPosition.target = {
            name: planetName,
            position: getPlanetPosition(planetName),
          };

          // Initialize travel metrics toward target
          const startPos = getPlanetPosition(
            state.userPosition.startingLocation,
          );

          const targetPos = getPlanetPosition(planetName);
          const centerDistance = calculateDistance(startPos, targetPos);
          const startBody = cBodies.find(
            (b) => b.name === state.userPosition.startingLocation,
          );

          const targetBody = cBodies.find((b) => b.name === planetName);
          const radiusBuffer =
            (startBody?.radiusKm ?? 0) + (targetBody?.radiusKm ?? 0);

          state.userPosition.initialDistance = Math.max(
            0,
            centerDistance - radiusBuffer,
          );

          state.userPosition.distanceTraveled = 0;
          state.userPosition.previousDistanceTraveled = 0;
          state.userPosition.launchTime = undefined;
          state.lastUpdateTime = undefined;
        });
      },
      warpTo: (planetName) => {
        set((state) => {
          // Instantly move to the specified planet and clear any travel state
          state.userPosition.startingLocation = planetName;
          state.userPosition.target = undefined;
          state.userPosition.launchTime = undefined;
          state.userPosition.initialDistance = undefined;
          state.userPosition.distanceTraveled = undefined;
          state.userPosition.previousDistanceTraveled = undefined;
          state.lastUpdateTime = undefined;
        });
      },
      setSwipedHabit: (habitId) => set({ swipedHabitId: habitId }),
      resetAllSwipes: () => set({ swipedHabitId: undefined }),
      setShowTrails: (value) => set({ showTrails: value }),
      setShowTextures: (value) => set({ showTextures: value }),
      setShowDebugOverlay: (value) => set({ showDebugOverlay: value }),
      setLevelUpModalVisible: (value) => set({ isLevelUpModalVisible: value }),

      // --- Tilt-shift setters ---
      setTiltShiftEnabled: (value) => set({ tiltShiftEnabled: value }),
      setTiltShiftFocus: (value) =>
        set({ tiltShiftFocus: Math.min(1, Math.max(0, value)) }),
      setTiltShiftRange: (value) =>
        set({ tiltShiftRange: Math.min(1, Math.max(0, value)) }),
      setTiltShiftFeather: (value) =>
        set({ tiltShiftFeather: Math.min(1, Math.max(0, value)) }),
      setTiltShiftBlur: (value) =>
        set({ tiltShiftBlur: Math.max(0, Math.min(64, value)) }),
      quickReset: () => {
        //preserve debug values
        const {
          showDebugOverlay,
          showTextures,
          showTrails,
          tiltShiftEnabled,
          tiltShiftFocus,
          tiltShiftRange,
          tiltShiftFeather,
          tiltShiftBlur,
        } = get();
        set({
          ...initialData,
          showDebugOverlay,
          showTextures,
          showTrails,
          tiltShiftEnabled,
          tiltShiftFocus,
          tiltShiftRange,
          tiltShiftFeather,
          tiltShiftBlur,
          isSetupFinished: true,
          habits: [
            {
              id: '0' as HabitId,
              title: 'Morning Meditation',
              description: 'Sample description',
              completions: [],
              timerLength: 600,
            },
            {
              id: '1' as HabitId,
              title: 'Evening Meditation',
              description: 'Sample description',
              completions: [],
              timerLength: 600,
            },
            {
              id: '2' as HabitId,
              title: 'Evening Meditation',
              description: 'Sample description',
              completions: [],
              timerLength: 600,
            },
            {
              id: '3' as HabitId,
              title: 'Evening Meditation',
              description: 'Sample description',
              completions: [],
              timerLength: 600,
            },
          ],
          userPosition: {
            startingLocation: 'Earth',
            target: {
              name: 'The Moon',
              position: moon.getPosition(),
            },
            initialDistance: Math.max(
              0,
              calculateDistance(
                getPlanetPosition('Earth'),
                moon.getPosition(),
              ) -
                (earth.radiusKm + moon.radiusKm),
            ),
            distanceTraveled: 0,
            previousDistanceTraveled: 0,
          },
          idCount: 1,
        });
      },
      clearData: () => set(initialData),

      // --- Complex/Async Actions ---

      /**
       * Completes a habit, awards XP, and advances travel by a fixed distance based on level.
       */
      completeHabit: async (habitId) => {
        get().addXP(XP_REWARDS.HABIT_COMPLETION, 'habit_completion');

        set((state) => {
          const habitToComplete = state.habits.find((h) => h.id === habitId);
          if (habitToComplete) {
            habitToComplete.completions.push(getCurrentDate().toISOString());
          }

          const target = state.userPosition.target;
          if (
            target &&
            typeof state.userPosition.initialDistance === 'number'
          ) {
            // First movement establishes launch time
            if (!state.userPosition.launchTime) {
              state.userPosition.launchTime = getCurrentDate().toISOString();
            }

            const level = calculateLevel(state.totalXP);
            const moveKm = getHabitDistancePerCompletion(level);
            const prev = state.userPosition.distanceTraveled ?? 0;
            const next = Math.min(
              state.userPosition.initialDistance,
              prev + moveKm,
            );

            // Record update time; do NOT update previousDistanceTraveled here.
            state.userPosition.distanceTraveled = next;
            state.lastUpdateTime = getCurrentTime();
            state.pendingTravelAnimation = true;

            // If we've reached the destination distance, mark landing as pending.
            // Finalization (updating startingLocation, awarding XP) will occur
            // after the SolarSystemMap finishes animating this step.
            if (next >= (state.userPosition.initialDistance ?? 0)) {
              state.pendingLanding = true;
            }
          }
        });
      },

      /**
       * Starts a timer for a specific habit if one isn't already running.
       * @returns `true` if the timer was started successfully, `false` otherwise.
       */
      startTimer: async (habitId) => {
        const { activeTimer, habits } = get();

        if (activeTimer) {
          console.warn(
            'Timer Already Active: Another timer is already running.',
          );

          return false; // Indicate failure
        }

        const habit = habits.find((h) => h.id === habitId);
        if (!habit || !habit.timerLength) {
          console.error('Timer Error: Habit not found or timer length not set');
          return false; // Indicate failure
        }

        try {
          const timerId = await schedulePushNotification({
            title: `Your timer for ${habit.title} is up!`,
            seconds: habit.timerLength,
          });

          set({
            activeTimer: {
              habitId,
              startTime: getCurrentDate().toISOString(),
              timerNotificationId: timerId,
            },
          });

          return true; // Indicate success
        } catch (e) {
          console.error('Failed to schedule timer notification', e);
          return false; // Indicate failure
        }
      },

      /**
       * Cancels the currently active timer and its scheduled notification.
       */
      cancelTimer: async () => {
        const { activeTimer } = get();
        if (activeTimer?.timerNotificationId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              activeTimer.timerNotificationId,
            );
          } catch (e) {
            console.warn('Failed to cancel timer notification', e);
          }
        }

        set({ activeTimer: undefined });
      },

      /**
       * Clears the active timer from state without trying to cancel the notification.
       * (Used after a notification has already fired).
       */
      expireTimer: () => {
        set({ activeTimer: undefined });
      },

      /**
       * Sync visual travel progress after user has seen the animation.
       * This sets previousDistanceTraveled = distanceTraveled.
       */
      syncTravelVisuals: () => {
        set((state) => {
          if (
            state.userPosition.distanceTraveled !== undefined &&
            state.userPosition.target
          ) {
            state.userPosition.previousDistanceTraveled =
              state.userPosition.distanceTraveled;
          }

          console.log('Synced travel visuals');
          state.pendingTravelAnimation = false;
        });
      },

      finalizeLandingAfterAnimation: () => {
        const state = get();
        const target = state.userPosition.target;
        const initialDistance = state.userPosition.initialDistance ?? 0;
        const traveled = state.userPosition.distanceTraveled ?? 0;
        if (!target) return;
        // Only finalize if marked pending or if traveled >= initialDistance
        if (!state.pendingLanding && traveled < initialDistance) return;

        const destinationName = target.name;
        const isNewPlanet = !state.completedPlanets.includes(destinationName);

        if (isNewPlanet) {
          // Award XP for planet completion using per-body configured reward
          const body = cBodies.find((b) => b.name === destinationName);
          const reward = body?.xpReward ?? 0;
          if (reward > 0) {
            state.addXP(reward, 'planet_completion');
          }
        }

        set((nextState) => {
          nextState.userPosition.startingLocation = destinationName;
          nextState.userPosition.target = undefined;
          nextState.userPosition.launchTime = undefined;
          nextState.userPosition.initialDistance = undefined;
          nextState.userPosition.distanceTraveled = undefined;
          nextState.userPosition.previousDistanceTraveled = undefined;
          nextState.lastUpdateTime = undefined;

          if (isNewPlanet) {
            nextState.completedPlanets.push(destinationName);
          }

          nextState.pendingLanding = false;
          nextState.justLanded = true;
        });
      },

      acknowledgeLandingOnHome: () => {
        set((state) => {
          state.justLanded = false;
        });
      },

      /**
       * Adds a specified amount of XP to the user's total.
       */
      addXP: (amount, source) => {
        set((state) => {
          state.xpHistory.push({
            amount,
            source,
            timestamp: getCurrentDate().toISOString(),
          });

          state.totalXP += amount;
        });
      },
    })),
    {
      name: 'space-explorer-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      migrate: (persistedState, _version) => {
        const s = (persistedState || {}) as Partial<Store> & {
          // For backwards compatibility with older persisted shapes
          userLevel?: { level?: number; currentXP?: number; totalXP?: number };
        };
        if (s.rocketColor === undefined) {
          s.rocketColor = randomColorInt();
        }

        // Migrate userLevel -> totalXP (preserve existing totalXP if present)
        if (s.totalXP === undefined) {
          const prevTotal = s.userLevel?.totalXP;
          s.totalXP = typeof prevTotal === 'number' ? prevTotal : 0;
        }
        // Remove legacy key if present
        (s as Partial<Store> & { userLevel?: unknown }).userLevel = undefined;

        // Defaults for newly added flags
        if (s.pendingTravelAnimation === undefined)
          s.pendingTravelAnimation = false;
        if (s.pendingLanding === undefined) s.pendingLanding = false;
        if (s.justLanded === undefined) s.justLanded = false;
        if (s.showDebugOverlay === undefined) s.showDebugOverlay = false;
        if (s.isLevelUpModalVisible === undefined)
          s.isLevelUpModalVisible = false;

        // Defaults for tilt-shift controls
        if (s.tiltShiftEnabled === undefined) s.tiltShiftEnabled = true;
        if (s.tiltShiftFocus === undefined) s.tiltShiftFocus = 0.55;
        if (s.tiltShiftRange === undefined) s.tiltShiftRange = 0.18;
        if (s.tiltShiftFeather === undefined) s.tiltShiftFeather = 0.22;
        if (s.tiltShiftBlur === undefined) s.tiltShiftBlur = 8;
        return s as Store;
      },
    },
  ),
);

// =================================================================
// SELECTOR HOOKS (for reading state)
// =================================================================

function getCurrentPosition(position: UserPosition) {
  // If in-flight with distance tracking, interpolate between the
  // CURRENT positions of the start and target bodies using traveled ratio.
  if (
    position.target &&
    position.initialDistance !== undefined &&
    position.distanceTraveled !== undefined
  ) {
    const start = getPlanetPosition(position.startingLocation);
    const target = getPlanetPosition(position.target.name);
    const denom = position.initialDistance === 0 ? 1 : position.initialDistance;
    const t = Math.min(1, Math.max(0, position.distanceTraveled / denom));

    return [
      start[0] + (target[0] - start[0]) * t,
      start[1] + (target[1] - start[1]) * t,
      start[2] + (target[2] - start[2]) * t,
    ] as Coordinates;
  }

  // Otherwise, use the current body's true position
  return (
    cBodies.find((p) => p.name === position.startingLocation) ?? earth
  ).getPosition();
}

export function useCurrentPosition() {
  return useStore(
    useShallow((state) => getCurrentPosition(state.userPosition)),
  );
}

export const useIsSetupFinished = () =>
  useStore((state) => state.isSetupFinished);

export const useUserLevel = () =>
  useStore((state) => calculateLevel(state.totalXP));

export function isTraveling(store: Store) {
  return (
    !!store.userPosition.target &&
    (store.userPosition.distanceTraveled ?? 0) > 0
  );
}

export function useIsTraveling() {
  return useStore((state) => isTraveling(state));
}
