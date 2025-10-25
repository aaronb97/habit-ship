import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

/**
 * Ensures there is an authenticated Firebase user (anonymous) and returns its UID.
 *
 * Parameters: none
 * Returns: UID string if available; otherwise undefined.
 */
export async function ensureFirebaseId(): Promise<string | undefined> {
  try {
    const mod = (await import('@react-native-firebase/auth')) as unknown as {
      default: () => FirebaseAuthTypes.Module;
    };
    const inst = mod.default();
    const existing = inst.currentUser;
    if (existing?.uid) return existing.uid;
    const cred = await inst.signInAnonymously();
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
    const mod = (await import('@react-native-firebase/auth')) as unknown as {
      default: () => FirebaseAuthTypes.Module;
    };
    const inst = mod.default();
    if (!inst.currentUser) return;
    await inst.signOut();
  } catch {
    // Best-effort only
  }
}
