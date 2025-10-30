import auth from '@react-native-firebase/auth';

/**
 * Ensures there is an authenticated Firebase user (anonymous) and returns its UID.
 *
 * Parameters: none
 * Returns: UID string if available; otherwise undefined.
 */
export async function ensureFirebaseId(): Promise<string | undefined> {
  try {
    const existing = auth().currentUser;
    if (existing?.uid) {
      return existing.uid;
    }

    const cred = await auth().signInAnonymously();
    return cred.user.uid;
  } catch (e) {
    console.warn('[firebaseAuth.native] Anonymous sign-in failed', e);
    return undefined;
  }
}

/**
 * Signs out the current Firebase user on native platforms (for dev resets).
 *
 * Parameters: none
 */
export async function signOutForDevResets(): Promise<void> {
  try {
    if (!auth().currentUser) {
      return;
    }

    await auth().signOut();
  } catch {
    // Best-effort only
  }
}
