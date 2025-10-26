import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { earth, moon, cBodies } from '../planets';
import { schedulePushNotification } from './schedulePushNotification';
import {
  cancelTodayDailyReminder,
  rescheduleDailyReminders,
} from './notifications';
import { getCurrentTime, getCurrentDate, setTimeOffsetProvider } from './time';
import { Coordinates, UserPosition, XPGain } from '../types';
import { useShallow } from 'zustand/shallow';
import { calculateLevel, getDailyDistanceForLevel } from './experience';
import { hasSkinForBody, ALL_SKIN_IDS, ROCKET_SKIN_IDS } from './skins';
// username is assigned during initial Firestore sync to ensure uniqueness
import { signOutForDevResets } from './firebaseAuth';

// =================================================================
// TYPES
// =================================================================

export type HabitId = string & { __habitId: true };

export type TabName = 'HomeTab' | 'MapTab' | 'ProfileTab' | 'DevTab';

/**
 * Structured information to present when a user levels up.
 * Includes the previous and current levels, travel distances per completion,
 * and the names of any newly discovered celestial bodies.
 */
export type LevelUpInfo = {
  prevLevel: number;
  currLevel: number;
  prevDistanceKm: number;
  currDistanceKm: number;
  discoveredBodies: string[];
  /** Optional rocket skin id awarded on this level-up (if any). */
  awardedSkinId?: string;
};

export type LandingReward = {
  planetName: string;
  xp: number;
  money: number;
};

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
  if (!planet) {
    throw new Error(`Planet ${planetName} not found`);
  }

  return planet.getPosition();
}

// =================================================================
// STORE DEFINITION
// =================================================================

type Store = {
  isSetupFinished: boolean;
  habits: Habit[];
  userPosition: UserPosition;
  completedPlanets: string[];
  // Skins
  unlockedSkins: string[]; // skin ids
  unseenUnlockedSkins: string[]; // newly unlocked since last Profile view
  selectedSkinId?: string; // currently applied skin id
  totalXP: number;
  xpHistory: XPGain[];
  money: number;
  lastLandingReward?: LandingReward;
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
  outlinesBodiesEnabled: boolean;
  outlinesRocketEnabled: boolean;

  username?: string;

  firebaseId?: string;

  skipRocketAnimation: boolean;

  showJourneyRemaining: boolean;
  showFuelCapacity: boolean;

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
  setRocketColor: (color: number) => void;

  // Animation/landing flow flags
  // True when user has reached target distance but landing should be finalized after the map animation
  pendingLanding: boolean;
  // True after landing has been finalized and Home should prompt/select next destination
  justLanded: boolean;
  // True while the Level Up modal is visible; used to sequence other modals
  isLevelUpModalVisible: boolean;
  // Structured data to render inline level-up content on the Dashboard
  levelUpInfo?: LevelUpInfo;
  // The most recent level the user has acknowledged via the Level Up UI
  lastLevelUpSeenLevel?: number;

  // Navigation state
  activeTab: TabName;

  fuelKm: number;
  fuelEarnedTodayKm: number;
  fuelEarnedDate?: string;

  xpEarnedToday: number;
  xpEarnedDate?: string;

  // Actions
  setIsSetupFinished: (value: boolean) => void;
  setDestination: (planetName: string) => void;
  warpTo: (planetName: string) => void;
  // Mark that the user has visually seen the latest travel progress; sync prev->curr
  syncTravelVisuals: () => void;
  applyFuelToTravel: () => void;
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
  addXP: (
    amount: number,
    source: 'habit_completion' | 'planet_completion',
  ) => void;
  /**
   * Adds a specified amount of money to the user's balance.
   * amount: Positive integer amount of money to add.
   */
  addMoney: (amount: number) => void;
  quickReset: () => void;
  clearData: () => void;
  setShowTrails: (value: boolean) => void;
  setShowTextures: (value: boolean) => void;
  setShowDebugOverlay: (value: boolean) => void;
  setOutlinesBodiesEnabled: (value: boolean) => void;
  setOutlinesRocketEnabled: (value: boolean) => void;
  setLevelUpModalVisible: (value: boolean) => void;
  /**
   * Show the inline Level Up content with provided details and set
   * `isLevelUpModalVisible` for sequencing other flows.
   *
   * info: Structured level-up data to display.
   * Returns: void
   */
  showLevelUp: (info: LevelUpInfo) => void;
  /**
   * Hide the inline Level Up content and clear stored details, unblocking
   * other flows (like planet selection after landing).
   *
   * Returns: void
   */
  hideLevelUp: () => void;
  /**
   * Persist the most recent level the user has acknowledged in the Level Up UI.
   *
   * level: Level that has been acknowledged.
   * Returns: void
   */
  setLastLevelUpSeenLevel: (level: number) => void;
  setActiveTab: (tab: TabName) => void;
  // Skins actions
  setSelectedSkinId: (skinId?: string) => void;
  markSkinsSeen: () => void;
  unlockAllSkins: () => void;
  lockSkinsToDefault: () => void;
  /**
   * Unlocks a random rocket skin that the user does not already own.
   * Returns the awarded skin id, or undefined if none available.
   */
  unlockRandomRocketSkin: () => string | undefined;

  // Tilt-shift setters
  setTiltShiftEnabled: (value: boolean) => void;
  setTiltShiftFocus: (value: number) => void;
  setTiltShiftRange: (value: number) => void;
  setTiltShiftFeather: (value: number) => void;
  setTiltShiftBlur: (value: number) => void;

  setSkipRocketAnimation: (value: boolean) => void;
  setShowJourneyRemaining: (value: boolean) => void;
  setShowFuelCapacity: (value: boolean) => void;

  completeHabit: (habitId: HabitId) => Promise<void>;
  startTimer: (habitId: HabitId) => Promise<boolean>; // Returns true on success, false on failure
  cancelTimer: () => Promise<void>;
  expireTimer: () => void; // Sync action is sufficient here

  // Finalize landing after the SolarSystemMap finishes animating the last step
  finalizeLandingAfterAnimation: () => void;
  // Clear the justLanded flag after Home acknowledged the landing
  acknowledgeLandingOnHome: () => void;

  /**
   * Sets the Firebase UID for this device/profile. Pass undefined to clear.
   * id: UID string to persist, or undefined to clear.
   */
  setFirebaseId: (id?: string) => void;

  /**
   * Sets the user's unique username. Pass undefined to clear.
   * name: Username string to persist, or undefined to clear.
   */
  setUsername: (name?: string) => void;
};

const initialData = {
  isSetupFinished: false,
  habits: [],
  userPosition: {
    startingLocation: 'Earth',
    target: {
      name: 'The Moon',
      position: moon.getPosition(),
    },
    initialDistance: Math.max(
      0,
      calculateDistance(getPlanetPosition('Earth'), moon.getPosition()) -
        (earth.radiusKm + moon.radiusKm),
    ),
    distanceTraveled: 0,
    previousDistanceTraveled: 0,
  },
  completedPlanets: ['Earth'],
  unlockedSkins: ['Earth'],
  unseenUnlockedSkins: [],
  selectedSkinId: undefined,
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
  outlinesBodiesEnabled: false,
  outlinesRocketEnabled: true,
  skipRocketAnimation: false,
  showJourneyRemaining: false,
  showFuelCapacity: false,
  tiltShiftEnabled: true,
  // tiltShiftFocus: 0.55,
  // tiltShiftRange: 0,
  // tiltShiftFeather: 0.4,
  // tiltShiftBlur: 1.5,
  // tiltShiftFocus: 0.53,
  // tiltShiftRange: 0.16,
  // tiltShiftFeather: 0.04,
  // tiltShiftBlur: 1,
  tiltShiftFocus: 0.53,
  tiltShiftRange: 0.22,
  tiltShiftFeather: 0.2,
  tiltShiftBlur: 1,
  rocketColor: randomColorInt(),
  pendingLanding: false,
  justLanded: false,
  isLevelUpModalVisible: false,
  levelUpInfo: undefined,
  lastLevelUpSeenLevel: undefined,
  fuelKm: 0,
  fuelEarnedTodayKm: 0,
  fuelEarnedDate: undefined,
  xpEarnedToday: 0,
  xpEarnedDate: undefined,
  money: 0,
  lastLandingReward: undefined,
  username: undefined,
  firebaseId: undefined,
} satisfies Partial<Store>;

export const useStore = create<Store>()(
  persist(
    immer((set, get) => ({
      ...initialData,
      activeTab: 'HomeTab' as TabName,
      setRocketColor: (color) => set({ rocketColor: color }),
      setIsSetupFinished: (value) => set({ isSetupFinished: value }),
      setFirebaseId: (id) => set({ firebaseId: id }),
      setUsername: (name) => set({ username: name }),
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
        // Keep reminders' copy in sync with destination and skip today's reminder if already completed
        {
          const s = get();
          const todayKey = getCurrentDate().toDateString();
          const anyCompletedToday = s.habits.some((h) =>
            h.completions.some(
              (ts) => new Date(ts).toDateString() === todayKey,
            ),
          );
          void rescheduleDailyReminders(planetName, !anyCompletedToday);
        }
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
      setShowTrails: (value) => set({ showTrails: value }),
      setShowTextures: (value) => set({ showTextures: value }),
      setShowDebugOverlay: (value) => set({ showDebugOverlay: value }),
      setOutlinesBodiesEnabled: (value) =>
        set({ outlinesBodiesEnabled: value }),
      setOutlinesRocketEnabled: (value) =>
        set({ outlinesRocketEnabled: value }),
      setLevelUpModalVisible: (value) => set({ isLevelUpModalVisible: value }),
      showLevelUp: (info) =>
        set({ isLevelUpModalVisible: true, levelUpInfo: info }),
      hideLevelUp: () =>
        set({ isLevelUpModalVisible: false, levelUpInfo: undefined }),
      setLastLevelUpSeenLevel: (level) => set({ lastLevelUpSeenLevel: level }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      // Skins
      setSelectedSkinId: (skinId) => {
        set((state) => {
          state.selectedSkinId = skinId;
        });
      },
      markSkinsSeen: () => set({ unseenUnlockedSkins: [] }),
      unlockAllSkins: () =>
        set((state) => {
          state.unlockedSkins = [...ALL_SKIN_IDS];
          state.unseenUnlockedSkins = [];
          // If a selected skin is not in unlocked (shouldn't happen after unlock), keep it
        }),
      lockSkinsToDefault: () =>
        set((state) => {
          state.unlockedSkins = ['Earth'];
          state.unseenUnlockedSkins = [];
          if (state.selectedSkinId && state.selectedSkinId !== 'Earth') {
            state.selectedSkinId = undefined;
          }
        }),
      unlockRandomRocketSkin: () => {
        const state = get();
        const owned = new Set(state.unlockedSkins);
        const pool = ROCKET_SKIN_IDS.filter((id) => !owned.has(id));
        if (pool.length === 0) return undefined;
        const idx = Math.floor(Math.random() * pool.length);
        const awarded = pool[idx]!;
        set((s) => {
          s.unlockedSkins.push(awarded);
          s.unseenUnlockedSkins.push(awarded);
        });
        return awarded;
      },
      setSkipRocketAnimation: (value) => set({ skipRocketAnimation: value }),
      setShowJourneyRemaining: (value) => set({ showJourneyRemaining: value }),
      setShowFuelCapacity: (value) => set({ showFuelCapacity: value }),

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
        // Sign out so a new anonymous user is created on next app tick
        void signOutForDevResets();
        //preserve debug values
        const {
          showDebugOverlay,
          showTextures,
          showTrails,
          outlinesBodiesEnabled,
          outlinesRocketEnabled,
          skipRocketAnimation,
          tiltShiftEnabled,
          tiltShiftFocus,
          tiltShiftRange,
          tiltShiftFeather,
          tiltShiftBlur,
          showJourneyRemaining,
          showFuelCapacity,
        } = get();

        set({
          ...initialData,
          showDebugOverlay,
          showTextures,
          showTrails,
          outlinesBodiesEnabled,
          outlinesRocketEnabled,
          skipRocketAnimation,
          tiltShiftEnabled,
          tiltShiftFocus,
          tiltShiftRange,
          tiltShiftFeather,
          tiltShiftBlur,
          showJourneyRemaining,
          showFuelCapacity,
          isSetupFinished: true,
          fuelKm: 0,
          fuelEarnedTodayKm: 0,
          fuelEarnedDate: getCurrentDate().toDateString(),
          xpEarnedToday: 0,
          xpEarnedDate: getCurrentDate().toDateString(),
          habits: [
            {
              id: '0' as HabitId,
              title: 'Dev',
              description: 'Sample description',
              completions: [],
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
          // Clear firebase identity so the bootstrap flow re-authenticates
          firebaseId: undefined,
        });
      },
      clearData: () => {
        // Ensure next session starts with a brand new anonymous identity
        void signOutForDevResets();
        set(initialData);
      },

      // --- Complex/Async Actions ---

      completeHabit: async (habitId) => {
        const s = get();
        const todayKey = getCurrentDate().toDateString();
        const habitsCount = Math.max(1, s.habits.length);
        const perHabitXP = Math.max(100 / habitsCount, 20);
        const earnedToday = s.xpEarnedDate === todayKey ? s.xpEarnedToday : 0;
        const remainingXPAllowance = Math.max(0, 100 - earnedToday);
        const xpGrant = Math.min(perHabitXP, remainingXPAllowance);

        if (xpGrant > 0) {
          get().addXP(xpGrant, 'habit_completion');
        }

        set((state) => {
          const habitToComplete = state.habits.find((h) => h.id === habitId);
          if (habitToComplete) {
            habitToComplete.completions.push(getCurrentDate().toISOString());
          }

          if (state.xpEarnedDate !== todayKey) {
            state.xpEarnedDate = todayKey;
            state.xpEarnedToday = 0;
          }

          state.xpEarnedToday += xpGrant;

          // Accrue fuel for today, divided by number of habits; cap at daily limit
          if (state.fuelEarnedDate !== todayKey) {
            state.fuelEarnedDate = todayKey;
            state.fuelEarnedTodayKm = 0;
          }

          const level = calculateLevel(state.totalXP);
          const dailyCap = getDailyDistanceForLevel(level);
          const fuelHabitsCount = Math.max(1, state.habits.length);
          const perCompletion = dailyCap / fuelHabitsCount;
          const remainingAllowance = Math.max(
            0,
            dailyCap - state.fuelEarnedTodayKm,
          );

          const grant = Math.min(perCompletion, remainingAllowance);

          state.fuelKm += grant;
          state.fuelEarnedTodayKm += grant;
        });

        // Remove today's reminder once any habit is completed
        await cancelTodayDailyReminder();
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
        });
      },

      /**
       * Applies available fuel to advance toward the current target.
       * - If landing occurs, leftover fuel is preserved (fuel - remaining).
       * - If not landing, all fuel is spent.
       * - This updates distanceTraveled but leaves previousDistanceTraveled unchanged,
       *   so the rocket tab can animate the delta.
       */
      applyFuelToTravel: () => {
        set((state) => {
          const target = state.userPosition.target;
          const initialDistance = state.userPosition.initialDistance;
          if (!target || typeof initialDistance !== 'number') {
            return;
          }

          const prev = state.userPosition.distanceTraveled ?? 0;
          const remaining = Math.max(0, initialDistance - prev);
          if (remaining <= 0) {
            return;
          }

          const available = Math.max(0, state.fuelKm);
          if (available <= 0) {
            return;
          }

          const spend = Math.min(available, remaining);
          const next = Math.min(initialDistance, prev + spend);

          state.userPosition.distanceTraveled = next;
          state.lastUpdateTime = getCurrentTime();
          if (!state.userPosition.launchTime) {
            state.userPosition.launchTime = getCurrentDate().toISOString();
          }

          // Landing if we've reached or exceeded the needed distance
          if (next >= initialDistance) {
            state.pendingLanding = true;
            // Preserve leftover fuel beyond the remaining distance
            state.fuelKm = available - remaining;
          } else {
            // Not landing: expend all available fuel
            state.fuelKm = 0;
          }
        });
      },

      finalizeLandingAfterAnimation: () => {
        const state = get();
        const target = state.userPosition.target;
        const initialDistance = state.userPosition.initialDistance ?? 0;
        const traveled = state.userPosition.distanceTraveled ?? 0;
        if (!target) {
          return;
        }

        // Only finalize if marked pending or if traveled >= initialDistance
        if (!state.pendingLanding && traveled < initialDistance) {
          return;
        }

        const destinationName = target.name;
        const isNewPlanet = !state.completedPlanets.includes(destinationName);
        // Determine rewards (XP may only be on first landing)
        const body = cBodies.find((b) => b.name === destinationName);
        const xpReward = isNewPlanet ? (body?.xpReward ?? 0) : 0;
        const moneyReward = isNewPlanet ? (body?.moneyReward ?? 0) : 0;
        if (xpReward > 0) {
          state.addXP(xpReward, 'planet_completion');
        }
        if (moneyReward > 0) {
          state.addMoney(moneyReward);
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

          // Unlock a skin if this body has a dedicated image and wasn't unlocked yet
          if (hasSkinForBody(destinationName)) {
            const id = destinationName;
            if (!nextState.unlockedSkins.includes(id)) {
              nextState.unlockedSkins.push(id);
              // Mark as unseen so Profile tab can badge; ignore 'Earth' default
              if (id !== 'Earth') {
                nextState.unseenUnlockedSkins.push(id);
              }
            }
          }

          // Record last landing reward to show in the landing alert
          if (xpReward > 0 || moneyReward > 0) {
            nextState.lastLandingReward = {
              planetName: destinationName,
              xp: xpReward,
              money: moneyReward,
            };
          } else {
            nextState.lastLandingReward = undefined;
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
      /**
       * Adds a specified amount of money to the user's balance.
       * amount: Positive integer amount to add to the balance.
       */
      addMoney: (amount) => {
        if (amount <= 0) return;
        set((state) => {
          state.money += amount;
        });
      },
    })),
    {
      name: 'space-explorer-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

setTimeOffsetProvider({
  get: () => useStore.getState().timeOffset,
  set: (next) => useStore.setState({ timeOffset: next }),
});

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
