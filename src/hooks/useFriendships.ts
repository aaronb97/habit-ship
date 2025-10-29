import { useEffect, useRef, useState } from 'react';
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

  const [friendProfiles, setFriendProfiles] = useState<Record<string, UsersDoc | undefined>>({});

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

  // Observe friend profiles (users docs) for accepted friendships in real-time
  const friendProfileUnsubsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    // If uid is not available, detach all listeners and clear profiles
    if (!uid) {
      friendProfileUnsubsRef.current.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });

      friendProfileUnsubsRef.current.clear();
      setFriendProfiles({});
      return;
    }

    const uids = Array.from(new Set(accepted.map((f) => otherUid(f, uid))));

    // Unsubscribe listeners for friends no longer in the accepted set
    friendProfileUnsubsRef.current.forEach((unsub, fid) => {
      if (!uids.includes(fid)) {
        try {
          unsub();
        } catch {}

        friendProfileUnsubsRef.current.delete(fid);
        setFriendProfiles((prev) => {
          const next = { ...prev };
          delete next[fid];
          return next;
        });
      }
    });

    // Subscribe to new friends' user docs
    uids.forEach((fid) => {
      if (friendProfileUnsubsRef.current.has(fid)) {
        return;
      }

      const unsub = userDoc(fid).onSnapshot(
        (snap) => {
          const data = snap.data() as UsersDoc | undefined;
          setFriendProfiles((prev) => ({ ...prev, [fid]: data }));
        },
        () => {
          setFriendProfiles((prev) => ({ ...prev, [fid]: undefined }));
        },
      );

      friendProfileUnsubsRef.current.set(fid, unsub);
    });

    // Cleanup handled incrementally above; full cleanup on unmount below
  }, [uid, accepted]);

  // On unmount, ensure all profile listeners are detached
  useEffect(() => {
    const mapAtMount = friendProfileUnsubsRef.current;
    return () => {
      mapAtMount.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });

      mapAtMount.clear();
    };
  }, []);

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
