import { useEffect, useState } from 'react';
import type { FriendshipDoc, UsersDoc } from '../utils/db';
import {
  observeFriendshipsAccepted,
  observeFriendshipsIncoming,
  observeFriendshipsOutgoing,
  userDoc,
} from '../utils/db';

export type FriendshipsData = {
  accepted: FriendshipDoc[];
  incoming: FriendshipDoc[];
  outgoing: FriendshipDoc[];
  loadingAccepted: boolean;
  loadingIncoming: boolean;
  loadingOutgoing: boolean;
  friendProfiles: Record<string, UsersDoc | undefined>;
};

/**
 * Subscribes to friendship documents (accepted, incoming requests, outgoing requests)
 * for a given user id and exposes them with loading flags.
 *
 * Parameters:
 * - uid: Firebase Authentication UID for the current user. If undefined, returns empty lists.
 *
 * Returns: Object containing arrays for accepted/incoming/outgoing friendships and loading flags.
 */
export function useFriendships(uid?: string): FriendshipsData {
  const [accepted, setAccepted] = useState<FriendshipDoc[]>([]);
  const [incoming, setIncoming] = useState<FriendshipDoc[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipDoc[]>([]);

  const [loadingAccepted, setLoadingAccepted] = useState<boolean>(true);
  const [loadingIncoming, setLoadingIncoming] = useState<boolean>(true);
  const [loadingOutgoing, setLoadingOutgoing] = useState<boolean>(true);

  const [friendProfiles, setFriendProfiles] = useState<
    Record<string, UsersDoc | undefined>
  >({});

  function otherUid(f: FriendshipDoc, selfUid: string): string {
    return f.user1 === selfUid ? f.user2 : f.user1;
  }

  useEffect(() => {
    if (!uid) {
      setAccepted([]);
      setIncoming([]);
      setOutgoing([]);
      setLoadingAccepted(false);
      setLoadingIncoming(false);
      setLoadingOutgoing(false);
      setFriendProfiles({});
      return;
    }

    setLoadingAccepted(true);
    setLoadingIncoming(true);
    setLoadingOutgoing(true);

    const unsubAccepted = observeFriendshipsAccepted(uid, (rows) => {
      setAccepted(rows);
      setLoadingAccepted(false);
    });
    const unsubIncoming = observeFriendshipsIncoming(uid, (rows) => {
      setIncoming(rows);
      setLoadingIncoming(false);
    });
    const unsubOutgoing = observeFriendshipsOutgoing(uid, (rows) => {
      setOutgoing(rows);
      setLoadingOutgoing(false);
    });

    return () => {
      unsubAccepted();
      unsubIncoming();
      unsubOutgoing();
    };
  }, [uid]);

  // Fetch friend profiles (users docs) for accepted friendships
  useEffect(() => {
    if (!uid) return;
    if (accepted.length === 0) return;
    const uids = Array.from(new Set(accepted.map((f) => otherUid(f, uid))));
    const missing = uids.filter((u) => friendProfiles[u] === undefined);
    if (missing.length === 0) return;
    void (async () => {
      const entries: Record<string, UsersDoc | undefined> = {};
      await Promise.all(
        missing.map(async (u) => {
          try {
            const snap = await userDoc(u).get();
            entries[u] = snap.data() as UsersDoc | undefined;
          } catch {
            entries[u] = undefined;
          }
        }),
      );
      setFriendProfiles((prev) => ({ ...prev, ...entries }));
    })();
  }, [uid, accepted, friendProfiles]);

  return {
    accepted,
    incoming,
    outgoing,
    loadingAccepted,
    loadingIncoming,
    loadingOutgoing,
    friendProfiles,
  };
}
