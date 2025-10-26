import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import type { UserPosition } from '../types';

/**
 * Firestore representation for documents in the `users` collection.
 * Only the subset of fields we sync from the Zustand store.
 */
export type UsersDoc = {
  userPosition: UserPosition;
  username?: string | null;
  selectedSkinId?: string | null;
  rocketColor: number;
  totalXP: number;
};

/**
 * Returns a reference to the `users` collection.
 *
 * Returns: Collection reference for the users collection.
 */
export function usersCollection() {
  return firestore().collection('users');
}

/**
 * Returns a reference to the `users/{uid}` document.
 *
 * uid: Firebase Authentication UID used as the document id.
 * Returns: Document reference for the user document.
 */
export function userDoc(uid: string) {
  return usersCollection().doc(uid);
}

/**
 * Resolves a username to a user's Firebase UID by querying the `users` collection.
 *
 * username: Unique username to resolve.
 * Returns: UID string if found, otherwise undefined.
 */
export async function getUidByUsername(
  username: string,
): Promise<string | undefined> {
  const snap = await usersCollection()
    .where('username', '==', username)
    .limit(1)
    .get();
  if (snap.empty) return undefined;
  return snap.docs[0]!.id;
}

/**
 * Writes the provided partial user data to Firestore using merge semantics.
 *
 * uid: Firebase Authentication UID used as the document id.
 * partial: Partial user document to merge.
 * Returns: Promise that resolves when the write is complete.
 */
export async function writeUser(
  uid: string,
  partial: Partial<UsersDoc>,
): Promise<void> {
  await userDoc(uid).set(partial, { merge: true });
}

/**
 * Checks if a username already exists within the `users` collection.
 *
 * username: Candidate username to check.
 * Returns: true if a user with this username exists; false otherwise.
 */
export async function usernameExists(username: string): Promise<boolean> {
  const snap = await usersCollection()
    .where('username', '==', username)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Friendship status values supported by the backend.
 */
export type FriendshipStatus = 'pending' | 'accepted';

/**
 * In-app representation of a friendship document.
 * id: Firestore document id.
 * user1: UID of the initiator.
 * user2: UID of the recipient.
 * status: Current state of the friendship.
 */
export type FriendshipDoc = {
  id: string;
  user1: string;
  user1Name: string;
  user2: string;
  user2Name: string;
  status: FriendshipStatus;
};

type Unsubscribe = () => void;

/**
 * Returns a reference to the `friendships` collection.
 *
 * Returns: Collection reference for the friendships collection.
 */
export function friendshipsCollection() {
  return firestore().collection('friendships');
}

/**
 * Maps a Firestore snapshot to typed `FriendshipDoc[]`.
 *
 * snap: Query snapshot from Firestore.
 * Returns: Array of typed friendship rows.
 */
function mapFriendshipSnap(
  snap: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
): FriendshipDoc[] {
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FriendshipDoc, 'id'>),
  }));
}

/**
 * Observes all accepted friendships for the given uid.
 * Internally merges two snapshots: user1==uid and user2==uid.
 *
 * uid: Firebase Authentication UID to observe for.
 * onChange: Callback invoked with the merged set of accepted friendships.
 * Returns: Unsubscribe function to remove all listeners.
 */
export function observeFriendshipsAccepted(
  uid: string,
  onChange: (rows: FriendshipDoc[]) => void,
): Unsubscribe {
  const col = friendshipsCollection();

  let a: FriendshipDoc[] = [];
  let b: FriendshipDoc[] = [];
  const emit = () => onChange([...a, ...b]);

  const unsub1 = col
    .where('user1', '==', uid)
    .where('status', '==', 'accepted')
    .onSnapshot((snap) => {
      a = mapFriendshipSnap(snap);
      emit();
    });

  const unsub2 = col
    .where('user2', '==', uid)
    .where('status', '==', 'accepted')
    .onSnapshot((snap) => {
      b = mapFriendshipSnap(snap);
      emit();
    });

  return () => {
    unsub1();
    unsub2();
  };
}

/**
 * Observes pending incoming friendship requests for the given uid.
 *
 * uid: Firebase Authentication UID to observe for.
 * onChange: Callback invoked with the current set of incoming requests.
 * Returns: Unsubscribe function.
 */
export function observeFriendshipsIncoming(
  uid: string,
  onChange: (rows: FriendshipDoc[]) => void,
): Unsubscribe {
  return friendshipsCollection()
    .where('user2', '==', uid)
    .where('status', '==', 'pending')
    .onSnapshot((snap) => onChange(mapFriendshipSnap(snap)));
}

/**
 * Observes pending outgoing friendship requests for the given uid.
 *
 * uid: Firebase Authentication UID to observe for.
 * onChange: Callback invoked with the current set of outgoing requests.
 * Returns: Unsubscribe function.
 */
export function observeFriendshipsOutgoing(
  uid: string,
  onChange: (rows: FriendshipDoc[]) => void,
): Unsubscribe {
  return friendshipsCollection()
    .where('user1', '==', uid)
    .where('status', '==', 'pending')
    .onSnapshot((snap) => onChange(mapFriendshipSnap(snap)));
}

/**
 * Accepts a pending incoming friend request by document id.
 *
 * docId: Firestore document id for the friendship.
 */
export async function acceptFriendship(docId: string): Promise<void> {
  await friendshipsCollection()
    .doc(docId)
    .update({ status: 'accepted' as FriendshipStatus });
}

/**
 * Declines (deletes) a pending incoming friend request by document id.
 *
 * docId: Firestore document id for the friendship.
 */
export async function declineFriendship(docId: string): Promise<void> {
  await friendshipsCollection().doc(docId).delete();
}

/**
 * Response shape for attempting to send a friend request by username.
 */
export type SendFriendRequestOutcome =
  | { kind: 'created' }
  | { kind: 'self' }
  | { kind: 'already_friends' }
  | { kind: 'already_pending' };

/**
 * Input required to create a new friendship request document.
 *
 * user1: UID of the requester (initiator).
 * user1Name: Username to persist for the requester.
 * user2: UID of the recipient.
 * user2Name: Username to persist for the recipient.
 */
export type SendFriendRequestInput = {
  user1: string;
  user1Name: string;
  user2: string;
  user2Name: string;
};

/**
 * Sends a friend request from one user to another resolved by username.
 * Prevents self-requests and duplicates (both directions).
 *
 * input: Input required to create a new friendship request document.
 * Returns: Outcome describing the result of the operation.
 */
export async function sendFriendRequest(
  input: SendFriendRequestInput,
): Promise<SendFriendRequestOutcome> {
  const { user1, user1Name, user2, user2Name } = input;
  if (user1 === user2) return { kind: 'self' };

  const col = friendshipsCollection();
  const [a, b] = await Promise.all([
    col.where('user1', '==', user1).where('user2', '==', user2).limit(1).get(),
    col.where('user1', '==', user2).where('user2', '==', user1).limit(1).get(),
  ]);

  const existing = [...a.docs, ...b.docs];
  if (existing.length > 0) {
    const data = existing[0]!.data() as { status?: FriendshipStatus };
    const status = data.status ?? 'pending';
    if (status === 'accepted') return { kind: 'already_friends' };
    return { kind: 'already_pending' };
  }

  await col.add({
    user1,
    user1Name,
    user2,
    user2Name,
    status: 'pending' as FriendshipStatus,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return { kind: 'created' };
}

/**
 * Resolves a set of user ids to usernames. Falls back to "(unknown)" when missing.
 *
 * uids: Array of user ids to resolve.
 * Returns: Record mapping uid -> username or "(unknown)".
 */
export async function getUsernamesForUids(
  uids: string[],
): Promise<Record<string, string>> {
  if (uids.length === 0) return {};
  const entries: Record<string, string> = {};
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const doc = await userDoc(uid).get();
        const data = doc.data() as UsersDoc | undefined;
        entries[uid] = data?.username ?? '(unknown)';
      } catch {
        entries[uid] = '(unknown)';
      }
    }),
  );
  return entries;
}
