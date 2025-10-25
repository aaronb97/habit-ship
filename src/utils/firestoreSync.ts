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

  /**
   * Collects the selected fields into a Firestore-safe plain object.
   *
   * Parameters: none
   * Returns: Plain object suitable for Firestore `.set()`.
   */
  function snapshotSelected(): Record<string, unknown> {
    const s = useStore.getState();
    const data = {
      userPosition: s.userPosition,
      username: s.username,
      selectedSkinId: s.selectedSkinId,
      rocketColor: s.rocketColor,
    } as const;
    // JSON round-trip removes functions/undefined/symbols and ensures plain data
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
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
      const data = snapshotSelected();
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
    if (
      JSON.stringify(s.userPosition) !== JSON.stringify(prev.userPosition) ||
      s.username !== prev.username ||
      s.selectedSkinId !== prev.selectedSkinId ||
      s.rocketColor !== prev.rocketColor
    ) {
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
      const data = snapshotSelected();
      void docRef.set(data, { merge: true }).catch((e) => {
        console.warn('[firestoreSync] Failed to set users doc', e);
      });
      pending = false;
    }
  };

  return stop;
}
