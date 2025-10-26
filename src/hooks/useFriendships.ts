import { useEffect, useState } from 'react';
import type { FriendshipDoc } from '../utils/db';
import {
  observeFriendshipsAccepted,
  observeFriendshipsIncoming,
  observeFriendshipsOutgoing,
} from '../utils/db';

export type FriendshipsData = {
  accepted: FriendshipDoc[];
  incoming: FriendshipDoc[];
  outgoing: FriendshipDoc[];
  loadingAccepted: boolean;
  loadingIncoming: boolean;
  loadingOutgoing: boolean;
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

  useEffect(() => {
    if (!uid) {
      setAccepted([]);
      setIncoming([]);
      setOutgoing([]);
      setLoadingAccepted(false);
      setLoadingIncoming(false);
      setLoadingOutgoing(false);
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

  return {
    accepted,
    incoming,
    outgoing,
    loadingAccepted,
    loadingIncoming,
    loadingOutgoing,
  };
}
