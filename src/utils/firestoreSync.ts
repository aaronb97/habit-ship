import firestore from '@react-native-firebase/firestore';
import { useStore } from './store';

/**
 * Starts a one-way Firestore sync of select Zustand fields to
 * the document `users/{firebaseId}`. The device is the source of truth;
 * no reads are performed from Firestore.
 *
 * Synced fields:
 * - userPosition (entire object)
 * - username
 * - selectedSkinId
 * - rocketColor
 *
 * Parameters:
 * - firebaseId: UID string of the authenticated Firebase user; used as the document id.
 *
 * Returns: Unsubscribe function that stops the sync and flushes any pending write.
 */
export function startFirestoreSync(firebaseId: string): () => void {
  const docRef = firestore().collection('users').doc(firebaseId);

  // Debounce writes to reduce frequency during rapid state changes
  const DEBOUNCE_MS = 1000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let pending = false;

  // Single source of truth for which store fields to sync
  const SYNC_FIELDS = [
    'userPosition',
    'username',
    'selectedSkinId',
    'rocketColor',
    'totalXP',
  ] satisfies (keyof StoreState)[];
  type SyncKey = (typeof SYNC_FIELDS)[number];
  type StoreState = ReturnType<typeof useStore.getState>;

  /**
   * Builds the Firestore document payload from the selected store fields.
   *
   * Parameters: s - current store state snapshot
   * Returns: Plain object containing only the synced fields.
   */
  function buildPayload(s: StoreState): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of SYNC_FIELDS) {
      out[k] = (s as Record<SyncKey, unknown>)[k];
    }
    // Ensure plain data (no functions/undefined) and deep clone
    return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
  }

  /**
   * Determines if any of the synced fields changed between snapshots.
   *
   * Parameters: s - current state; prev - previous state
   * Returns: true if a relevant field changed; false otherwise.
   */
  function hasRelevantChange(s: StoreState, prev: StoreState): boolean {
    for (const k of SYNC_FIELDS) {
      // Deep compare via JSON for robustness across objects/primitives
      if (
        JSON.stringify((s as Record<SyncKey, unknown>)[k]) !==
        JSON.stringify((prev as Record<SyncKey, unknown>)[k])
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Schedules a debounced write of the current state to Firestore.
   * Subsequent calls within the debounce window will coalesce into one write.
   */
  function scheduleWrite() {
    if (stopped) return;
    pending = true;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(async () => {
      if (stopped) return;
      const data = buildPayload(useStore.getState());
      try {
        await docRef.set(data, { merge: true });
      } catch (e) {
        console.warn('[firestoreSync] Failed to set users doc', e);
      } finally {
        pending = false;
      }
    }, DEBOUNCE_MS);
  }

  // Initial write once we start syncing
  scheduleWrite();

  // Subscribe to store updates and trigger writes only when relevant fields change
  const unsubscribeStore = useStore.subscribe((s, prev) => {
    if (hasRelevantChange(s, prev)) scheduleWrite();
  });

  /**
   * Stops the sync by unsubscribing and flushing any pending debounced update.
   */
  const stop = () => {
    stopped = true;
    unsubscribeStore();
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    // If a write is pending, do a final immediate flush for best-effort consistency
    if (pending) {
      const data = buildPayload(useStore.getState());
      void docRef.set(data, { merge: true }).catch((e) => {
        console.warn('[firestoreSync] Failed to set users doc', e);
      });
      pending = false;
    }
  };

  return stop;
}
