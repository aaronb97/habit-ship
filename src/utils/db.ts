import firestore from '@react-native-firebase/firestore';
import type { UserPosition } from '../types';

/**
 * Firestore representation for documents in the `users` collection.
 * Only the subset of fields we sync from the Zustand store.
 */
export type UsersDoc = {
  userPosition: UserPosition;
  username?: string;
  selectedSkinId?: string;
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
