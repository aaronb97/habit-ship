import { useStore } from './store';
import { generateUsername } from './names/generateName';
import {
  usernameExists,
  writeUser,
  UsersDoc,
  userDoc,
  UsersPrivateDoc,
  userPrivateDoc,
  writeUserPrivate,
} from './db';
import * as Sentry from '@sentry/react-native';

const IS_DEV = process.env.APP_VARIANT === 'development';

/**
 * Starts two-way Firestore sync between the local store and:
 * - Public doc: `users/{firebaseId}` (friend-visible; unchanged shape)
 * - Private doc: `users_private/{firebaseId}` (personal/critical; not friend-visible)
 *
 * Reads: Both docs are observed and applied to the local store.
 * Writes: Local changes to selected fields are debounced and merged into their docs.
 *
 * Safeguards:
 * - Significant debounce to limit writes
 * - Write-echo suppression via last-seen snapshots
 * - Initial backfill for missing docs/fields using local values
 *
 * Parameters:
 * - firebaseId: UID string of the authenticated Firebase user; used as the document id.
 *
 * Returns: Unsubscribe function that stops the sync and flushes any pending write.
 */
export function startFirestoreSync(firebaseId: string): () => void {
  // Debounce windows
  const PUBLIC_DEBOUNCE_MS = IS_DEV ? 1000 : 3000;
  const PRIVATE_DEBOUNCE_MS = IS_DEV ? 3000 : 10_000;

  // State flags
  let stopped = false;

  // Public write debounce
  let publicTimeout: ReturnType<typeof setTimeout> | undefined;
  let publicPending = false;
  let lastPublicSeenStr: string | undefined; // last snapshot seen
  let lastPublicWrittenStr: string | undefined; // last payload written successfully
  // no-op flag removed (was unused)

  // Private write debounce
  let privateTimeout: ReturnType<typeof setTimeout> | undefined;
  let privatePending = false;
  let lastPrivateSeenStr: string | undefined; // last snapshot seen
  let lastPrivateWrittenStr: string | undefined; // last payload written successfully
  // no-op flag removed (was unused)

  // Establish state type for referencing keys below
  type StoreState = ReturnType<typeof useStore.getState>;

  // Public fields mapping
  const PUBLIC_FIELDS = [
    'userPosition',
    'username',
    'selectedSkinId',
    'rocketColor',
    'totalXP',
    'pets',
  ] as const satisfies readonly (keyof UsersDoc)[];

  // Private fields mapping
  const PRIVATE_FIELDS = [
    'isSetupFinished',
    'habits',
    'completedPlanets',
    'unlockedSkins',
    'unseenUnlockedSkins',
    'money',
    'lastLevelUpSeenLevel',
    'fuelKm',
    'fuelEarnedTodayKm',
    'fuelEarnedDate',
    'xpEarnedToday',
    'xpEarnedDate',
  ] as const satisfies readonly (keyof UsersPrivateDoc)[];

  // types removed; we use generic field iteration now

  /**
   * Ensures the user has a unique username before the first sync.
   * Generates names until none exist in the `users` collection, then sets it in the store.
   *
   * Parameters: none
   * Returns: void
   */
  async function allocateUniqueUsernameIfMissing(): Promise<void> {
    const s = useStore.getState();
    if (s.username) {
      return;
    }

    const MAX_TRIES = 8;
    for (let i = 0; i < MAX_TRIES; i++) {
      const candidate = generateUsername();
      try {
        const exists = await usernameExists(candidate);
        if (!exists) {
          s.setUsername(candidate);
          return;
        }
      } catch (e: unknown) {
        Sentry.captureException(e);
        console.warn('[firestoreSync] Username uniqueness check failed', e);
      }
    }

    const fallback = `${generateUsername()}-${Math.random().toString(36).slice(2, 5)}`;
    s.setUsername(fallback);
  }

  /**
   * Builds the Firestore document payload from the selected store fields.
   *
   * Parameters: s - current store state snapshot
   * Returns: Plain object containing only the synced fields.
   */
  function buildPayloadGeneric(
    fieldKeys: readonly (string | number | symbol)[],
    s: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of fieldKeys) {
      const key = k as string;
      out[key] = s[key];
    }

    return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
  }

  /**
   * Applies a UsersDoc snapshot to the store by iterating PUBLIC_FIELDS.
   * For optional string fields, coerce undefined to no-op and null stays null.
   */
  function applySnapshotToStoreGeneric(
    fieldKeys: readonly (string | number | symbol)[],
    dataObj: Record<string, unknown>,
  ): void {
    useStore.setState((prev) => {
      const patch = { ...prev } as StoreState;
      const target = patch as unknown as Record<string, unknown>;
      for (const k of fieldKeys) {
        const key = k as string;
        if (!Object.prototype.hasOwnProperty.call(dataObj, key)) continue;
        const v = dataObj[key];
        if (v === undefined) continue;
        target[key] = v;
      }
      return patch;
    });
  }

  /**
   * Schedules a debounced write of the current state to Firestore.
   * Subsequent calls within the debounce window will coalesce into one write.
   */
  function schedulePublicWrite(): void {
    if (stopped) return;

    publicPending = true;
    if (publicTimeout) clearTimeout(publicTimeout);

    publicTimeout = setTimeout(async () => {
      if (stopped) return;
      const data = buildPayloadGeneric(
        PUBLIC_FIELDS as readonly (string | number | symbol)[],
        useStore.getState() as unknown as Record<string, unknown>,
      ) as Partial<UsersDoc>;
      const payloadStr = JSON.stringify(data);
      try {
        await writeUser(firebaseId, data);
        lastPublicWrittenStr = payloadStr;
      } catch (e: unknown) {
        Sentry.captureException(e);
        console.warn('[firestoreSync] Failed to set users doc', e);
      } finally {
        publicPending = false;
      }
    }, PUBLIC_DEBOUNCE_MS);
  }

  function schedulePrivateWrite(): void {
    if (stopped) return;

    privatePending = true;
    if (privateTimeout) clearTimeout(privateTimeout);

    privateTimeout = setTimeout(async () => {
      if (stopped) return;
      const data = buildPayloadGeneric(
        PRIVATE_FIELDS as readonly (string | number | symbol)[],
        useStore.getState() as unknown as Record<string, unknown>,
      ) as Partial<UsersPrivateDoc>;
      const payloadStr = JSON.stringify(data);
      try {
        await writeUserPrivate(firebaseId, data);
        lastPrivateWrittenStr = payloadStr;
      } catch (e: unknown) {
        Sentry.captureException(e);
        console.warn('[firestoreSync] Failed to set users_private doc', e);
      } finally {
        privatePending = false;
      }
    }, PRIVATE_DEBOUNCE_MS);
  }

  // Attach snapshot listeners and perform an initial backfill if needed
  const unsubPublic = userDoc(firebaseId).onSnapshot(
    (snap) => {
      const data = snap.data() as Partial<UsersDoc> | undefined;

      if (!data) {
        // Public doc missing: backfill later after initial username allocation pass
      } else {
        const nextStr = JSON.stringify(data);
        if (nextStr !== lastPublicSeenStr) {
          applySnapshotToStoreGeneric(
            PUBLIC_FIELDS as readonly (string | number | symbol)[],
            data as unknown as Record<string, unknown>,
          );
          lastPublicSeenStr = nextStr;
        }
      }

      // If username missing both locally and remotely after first public snap, allocate one
      const { username } = useStore.getState();
      const remoteUsername = data?.username ?? null;
      if (!username && !remoteUsername) {
        void allocateUniqueUsernameIfMissing().catch((e) => {
          Sentry.captureException(e);
        });
      }

      // If doc missing, backfill minimal public payload
      if (!data) {
        const payload = buildPayloadGeneric(
          PUBLIC_FIELDS as readonly (string | number | symbol)[],
          useStore.getState() as unknown as Record<string, unknown>,
        ) as Partial<UsersDoc>;
        const payloadStr = JSON.stringify(payload);
        void writeUser(firebaseId, payload)
          .then(() => {
            lastPublicWrittenStr = payloadStr;
          })
          .catch((e) => {
            Sentry.captureException(e);
            console.warn('[firestoreSync] Initial backfill public failed', e);
          });
      }
    },
    (error) => {
      Sentry.captureException(error);
      console.warn('[firestoreSync] users onSnapshot error', error);
    },
  );

  const unsubPrivate = userPrivateDoc(firebaseId).onSnapshot(
    (snap) => {
      const data = snap.data() as Partial<UsersPrivateDoc> | undefined;

      if (!data) {
        // Private doc missing: backfill below
      } else {
        const nextStr = JSON.stringify(data);
        if (nextStr !== lastPrivateSeenStr) {
          applySnapshotToStoreGeneric(
            PRIVATE_FIELDS as readonly (string | number | symbol)[],
            data as unknown as Record<string, unknown>,
          );
          lastPrivateSeenStr = nextStr;
        }
      }

      if (!data) {
        const payload = buildPayloadGeneric(
          PRIVATE_FIELDS as readonly (string | number | symbol)[],
          useStore.getState() as unknown as Record<string, unknown>,
        ) as Partial<UsersPrivateDoc>;
        const payloadStr = JSON.stringify(payload);
        void writeUserPrivate(firebaseId, payload)
          .then(() => {
            lastPrivateWrittenStr = payloadStr;
          })
          .catch((e) => {
            Sentry.captureException(e);
            console.warn('[firestoreSync] Initial backfill private failed', e);
          });
      }
    },
    (error) => {
      Sentry.captureException(error);
      console.warn('[firestoreSync] users_private onSnapshot error', error);
    },
  );

  // Subscribe to store updates and trigger writes only when relevant fields change
  const unsubscribeStore = useStore.subscribe((s) => {
    // Public payload
    const publicPayload = buildPayloadGeneric(
      PUBLIC_FIELDS as readonly (string | number | symbol)[],
      s as unknown as Record<string, unknown>,
    ) as Partial<UsersDoc>;
    const publicStr = JSON.stringify(publicPayload);
    if (publicStr !== lastPublicSeenStr && publicStr !== lastPublicWrittenStr) {
      schedulePublicWrite();
    }

    // Private payload
    const privatePayload = buildPayloadGeneric(
      PRIVATE_FIELDS as readonly (string | number | symbol)[],
      s as unknown as Record<string, unknown>,
    ) as Partial<UsersPrivateDoc>;
    const privateStr = JSON.stringify(privatePayload);
    if (privateStr !== lastPrivateSeenStr && privateStr !== lastPrivateWrittenStr) {
      schedulePrivateWrite();
    }
  });

  /**
   * Stops the sync by unsubscribing and flushing any pending debounced update.
   */
  const stop = () => {
    stopped = true;
    unsubscribeStore();
    try {
      unsubPublic();
    } catch {}
    try {
      unsubPrivate();
    } catch {}

    if (publicTimeout) {
      clearTimeout(publicTimeout);
      publicTimeout = undefined;
    }
    if (privateTimeout) {
      clearTimeout(privateTimeout);
      privateTimeout = undefined;
    }

    // Best-effort final flushes
    if (publicPending) {
      const data = buildPayloadGeneric(
        PUBLIC_FIELDS as readonly (string | number | symbol)[],
        useStore.getState() as unknown as Record<string, unknown>,
      ) as Partial<UsersDoc>;
      void writeUser(firebaseId, data).catch((e: unknown) => {
        Sentry.captureException(e);
        console.warn('[firestoreSync] Final public flush failed', e);
      });
      publicPending = false;
    }

    if (privatePending) {
      const data = buildPayloadGeneric(
        PRIVATE_FIELDS as readonly (string | number | symbol)[],
        useStore.getState() as unknown as Record<string, unknown>,
      ) as Partial<UsersPrivateDoc>;
      void writeUserPrivate(firebaseId, data).catch((e: unknown) => {
        Sentry.captureException(e);
        console.warn('[firestoreSync] Final private flush failed', e);
      });
      privatePending = false;
    }
  };

  return stop;
}
