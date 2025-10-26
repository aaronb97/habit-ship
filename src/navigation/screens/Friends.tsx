import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useStore } from '../../utils/store';
import { usersCollection, getUidByUsername } from '../../utils/db';
import { HSButton } from '../../components/HSButton';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Friendship status values supported by the backend.
 */
type FriendshipStatus = 'pending' | 'accepted';

/**
 * In-app representation of a friendship document.
 * id: Firestore document id.
 * user1: UID of the initiator.
 * user2: UID of the recipient.
 * status: Current state of the friendship.
 */
interface FriendshipDoc {
  id: string;
  user1: string;
  user2: string;
  status: FriendshipStatus;
}

/**
 * Returns the other user's UID from a friendship given the current user's UID.
 *
 * @param f - Friendship document
 * @param selfUid - Current user's Firebase UID
 * @returns UID string for the other user in the friendship
 */
function otherUid(f: FriendshipDoc, selfUid: string): string {
  return f.user1 === selfUid ? f.user2 : f.user1;
}

/**
 * Friends management screen.
 * Displays current friends, incoming requests (with accept/decline),
 * and outgoing requests. Allows sending a new friend request by username.
 */
export function Friends() {
  const uid = useStore((s) => s.firebaseId);

  const [accepted, setAccepted] = useState<FriendshipDoc[]>([]);
  const [incoming, setIncoming] = useState<FriendshipDoc[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipDoc[]>([]);

  const [usernamesByUid, setUsernamesByUid] = useState<Record<string, string>>(
    {},
  );
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [inputUsername, setInputUsername] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  // Derived set of all other-user UIDs to fetch usernames for
  const allOtherUids = useMemo(() => {
    if (!uid) return [] as string[];
    const uids = new Set<string>();
    for (const f of [...accepted, ...incoming, ...outgoing]) {
      uids.add(otherUid(f, uid));
    }
    return Array.from(uids);
  }, [accepted, incoming, outgoing, uid]);

  useEffect(() => {
    if (!uid) return;
    const col = firestore().collection('friendships');

    const unsubAccepted1 = col
      .where('user1', '==', uid)
      .where('status', '==', 'accepted')
      .onSnapshot((snap) => {
        const rows: FriendshipDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FriendshipDoc, 'id'>),
        }));
        setAccepted((prev) => {
          // Merge with user2==uid accepted in a separate listener
          const others = prev.filter(
            (p) => !(p.user1 === uid && p.status === 'accepted'),
          );
          return [...others, ...rows];
        });
      });

    const unsubAccepted2 = col
      .where('user2', '==', uid)
      .where('status', '==', 'accepted')
      .onSnapshot((snap) => {
        const rows: FriendshipDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FriendshipDoc, 'id'>),
        }));
        setAccepted((prev) => {
          const others = prev.filter(
            (p) => !(p.user2 === uid && p.status === 'accepted'),
          );
          return [...others, ...rows];
        });
      });

    const unsubIncoming = col
      .where('user2', '==', uid)
      .where('status', '==', 'pending')
      .onSnapshot((snap) => {
        const rows: FriendshipDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FriendshipDoc, 'id'>),
        }));
        setIncoming(rows);
      });

    const unsubOutgoing = col
      .where('user1', '==', uid)
      .where('status', '==', 'pending')
      .onSnapshot((snap) => {
        const rows: FriendshipDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FriendshipDoc, 'id'>),
        }));
        setOutgoing(rows);
      });

    return () => {
      unsubAccepted1();
      unsubAccepted2();
      unsubIncoming();
      unsubOutgoing();
    };
  }, [uid]);

  useEffect(() => {
    // Fetch usernames for displayed UIDs if missing in cache
    async function load() {
      if (!uid) return;
      const needed = allOtherUids.filter((u) => !usernamesByUid[u]);
      if (needed.length === 0) return;
      const entries: [string, string][] = [];
      await Promise.all(
        needed.map(async (other) => {
          try {
            const doc = await usersCollection().doc(other).get();
            const data = doc.data();
            const name = (data?.username as string | undefined) ?? '(unknown)';
            entries.push([other, name]);
          } catch {
            entries.push([other, '(unknown)']);
          }
        }),
      );
      setUsernamesByUid((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
    }
    void load();
  }, [allOtherUids, uid, usernamesByUid]);

  /**
   * Accepts a pending incoming friend request.
   *
   * @param f - Friendship to accept
   */
  const acceptRequest = async (f: FriendshipDoc): Promise<void> => {
    try {
      await firestore()
        .collection('friendships')
        .doc(f.id)
        .update({ status: 'accepted' as FriendshipStatus });
    } catch (e) {
      Alert.alert('Error', 'Failed to accept request.');
      console.warn('Accept request failed', e);
    }
  };

  /**
   * Declines (deletes) a pending incoming friend request.
   *
   * @param f - Friendship to decline
   */
  const declineRequest = async (f: FriendshipDoc): Promise<void> => {
    try {
      await firestore().collection('friendships').doc(f.id).delete();
    } catch (e) {
      Alert.alert('Error', 'Failed to decline request.');
      console.warn('Decline request failed', e);
    }
  };

  /**
   * Sends a friend request to the specified username.
   * Validates existence, prevents duplicates, and creates a pending doc.
   *
   * @param targetName - Username string of the recipient
   */
  const sendFriendRequest = async (targetName: string): Promise<void> => {
    const name = targetName.trim();
    if (!uid) return;
    if (!name) {
      Alert.alert('Add Friend', 'Please enter a username.');
      return;
    }

    try {
      setBusy(true);
      const targetUid = await getUidByUsername(name);
      if (!targetUid) {
        Alert.alert('Not Found', `No user with username "${name}".`);
        return;
      }
      if (targetUid === uid) {
        Alert.alert('Oops', 'You cannot friend yourself.');
        return;
      }
      const col = firestore().collection('friendships');
      const [a, b] = await Promise.all([
        col
          .where('user1', '==', uid)
          .where('user2', '==', targetUid)
          .limit(1)
          .get(),
        col
          .where('user1', '==', targetUid)
          .where('user2', '==', uid)
          .limit(1)
          .get(),
      ]);
      const existing = [...a.docs, ...b.docs];
      if (existing.length > 0) {
        const doc = existing[0]!;
        const data = doc.data() as { status?: FriendshipStatus };
        const status = data.status ?? 'pending';
        if (status === 'accepted') {
          Alert.alert('Already Friends', 'You are already friends.');
        } else {
          Alert.alert(
            'Already Requested',
            'A friend request is already pending.',
          );
        }
        return;
      }

      await col.add({
        user1: uid,
        user2: targetUid,
        status: 'pending' as FriendshipStatus,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert('Request Sent', `Sent a request to ${name}.`);
      setIsAdding(false);
      setInputUsername('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send request.');
      console.warn('Send friend request failed', e);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Opens an input flow to add a friend by username.
   * On iOS uses Alert.prompt; on Android shows an inline input row.
   */
  const startAddFriend = (): void => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Add Friend',
        'Enter the username to send a request.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: (text?: string) => {
              if (typeof text === 'string') void sendFriendRequest(text);
            },
          },
        ],
        'plain-text',
      );
    } else {
      setIsAdding(true);
    }
  };

  const renderFriendRow = (f: FriendshipDoc) => {
    if (!uid) return null;
    const other = otherUid(f, uid);
    const label = usernamesByUid[other] ?? other;
    return (
      <View style={styles.row}>
        <Text style={styles.rowText}>{label}</Text>
      </View>
    );
  };

  const renderIncomingRow = (f: FriendshipDoc) => {
    if (!uid) return null;
    const other = otherUid(f, uid);
    const label = usernamesByUid[other] ?? other;
    return (
      <View style={styles.row}>
        <Text style={styles.rowText}>{label}</Text>
        <View style={styles.actions}>
          <HSButton onPress={() => void acceptRequest(f)}>
            <MaterialIcons name="check" size={20} color={colors.white} />
          </HSButton>
          <HSButton onPress={() => void declineRequest(f)}>
            <MaterialIcons name="close" size={20} color={colors.white} />
          </HSButton>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={startAddFriend}
          disabled={!uid || busy}
        >
          <Text style={styles.addBtnText}>Add Friend</Text>
        </TouchableOpacity>
      </View>

      {Platform.OS === 'android' && isAdding && (
        <View style={styles.inlinePrompt}>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor={colors.grey}
            value={inputUsername}
            onChangeText={setInputUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.btn, styles.accept]}
            onPress={() => void sendFriendRequest(inputUsername)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.btnText}>Send</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.decline]}
            onPress={() => {
              setIsAdding(false);
              setInputUsername('');
            }}
            disabled={busy}
          >
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Current Friends</Text>
      {accepted.length === 0 ? (
        <Text style={styles.empty}>No friends yet.</Text>
      ) : (
        <FlatList
          style={{ flexGrow: 0 }}
          data={accepted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderFriendRow(item)}
        />
      )}

      <Text style={styles.sectionTitle}>Incoming Requests</Text>
      {incoming.length === 0 ? (
        <Text style={styles.empty}>No incoming requests.</Text>
      ) : (
        <FlatList
          style={{ flexGrow: 0 }}
          data={incoming}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderIncomingRow(item)}
        />
      )}

      <Text style={styles.sectionTitle}>Requests Sent</Text>
      {outgoing.length === 0 ? (
        <Text style={styles.empty}>No outgoing requests.</Text>
      ) : (
        <FlatList
          style={{ flexGrow: 0 }}
          data={outgoing}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderFriendRow(item)}
        />
      )}

      {!uid && (
        <Text style={styles.notice}>Sign-in pending. Try again shortly.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.primaryText,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  addBtnText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.primaryText,
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    color: colors.grey,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
  notice: {
    color: colors.grey,
    fontFamily: fonts.regular,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  accept: {
    backgroundColor: '#2e7d32',
  },
  decline: {
    backgroundColor: '#c62828',
  },
  btnText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
  },
  inlinePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
});
