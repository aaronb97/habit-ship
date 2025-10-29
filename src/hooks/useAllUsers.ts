import { useEffect, useRef, useState } from 'react';
import type { UsersDoc } from '../utils/db';
import { usersCollection } from '../utils/db';

export type AllUsersData = {
  profiles: Record<string, UsersDoc | undefined>;
  loading: boolean;
};

/**
 * Subscribes to all user profile documents in the `users` collection when enabled.
 * The subscription is detached when disabled or on unmount.
 *
 * Parameters:
 * - enabled: When true, attaches a Firestore snapshot listener for all users.
 *
 * Returns: Object with a map of uid -> UsersDoc and a loading flag.
 */
export function useAllUsers(enabled: boolean): AllUsersData {
  const [profiles, setProfiles] = useState<Record<string, UsersDoc | undefined>>({});

  const [loading, setLoading] = useState<boolean>(!!enabled);
  const unsubRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    // Detach any previous listener first
    if (unsubRef.current) {
      try {
        unsubRef.current();
      } catch {}

      unsubRef.current = undefined;
    }

    if (!enabled) {
      setProfiles({});
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    const unsub = usersCollection().onSnapshot(
      (snap) => {
        const next: Record<string, UsersDoc | undefined> = {};
        snap.forEach((doc) => {
          try {
            next[doc.id] = doc.data() as UsersDoc;
          } catch {
            next[doc.id] = undefined;
          }
        });

        setProfiles(next);
        setLoading(false);
      },
      () => {
        setProfiles({});
        setLoading(false);
      },
    );

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) {
        try {
          unsubRef.current();
        } catch {}

        unsubRef.current = undefined;
      }
    };
  }, [enabled]);

  return { profiles, loading } as const;
}
