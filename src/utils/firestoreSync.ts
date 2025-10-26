import firestore from '@react-native-firebase/firestore';
import { useStore } from './store';
import { generateName } from './generateName';

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
 * - totalXP
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
  let lastDataStr: string | undefined;

  // Establish state type for referencing keys below
  type StoreState = ReturnType<typeof useStore.getState>;
  // Single source of truth for which store fields to sync
  const SYNC_FIELDS = [
    'userPosition',
    'username',
    'selectedSkinId',
    'rocketColor',
    'totalXP',
  ] satisfies (keyof StoreState)[];
  type SyncKey = (typeof SYNC_FIELDS)[number];

  /**
   * Ensures the user has a unique username before the first sync.
   * Generates names until none exist in the `users` collection, then sets it in the store.
   *
   * Parameters: none
   * Returns: void
   */
  async function allocateUniqueUsernameIfMissing(): Promise<void> {
    const s = useStore.getState();
    if (s.username) return; // already assigned
    // Try a handful of candidates to find an unused username
    const MAX_TRIES = 8;
    for (let i = 0; i < MAX_TRIES; i++) {
      const candidate = generateName();
      console.log('Checking username', candidate);
      try {
        const snapshot = await firestore()
          .collection('users')
          .where('username', '==', candidate)
          .limit(1)
          .get();
        if (snapshot.empty) {
          s.setUsername(candidate);
          return;
        }
      } catch (e) {
        console.warn('[firestoreSync] Username uniqueness check failed', e);
        // On transient errors, try a different candidate
      }
    }
    // As a last resort, include a short suffix to reduce collision likelihood
    const fallback = `${generateName()}-${Math.random().toString(36).slice(2, 5)}`;
    s.setUsername(fallback);
  }

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

  // Ensure username uniqueness (if needed) and then perform initial write
  void (async () => {
    await allocateUniqueUsernameIfMissing();
    lastDataStr = JSON.stringify(buildPayload(useStore.getState()));
    scheduleWrite();
  })();

  // Subscribe to store updates and trigger writes only when relevant fields change
  const unsubscribeStore = useStore.subscribe((s) => {
    const nextStr = JSON.stringify(buildPayload(s));
    if (nextStr !== lastDataStr) {
      lastDataStr = nextStr;
      scheduleWrite();
    }
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
