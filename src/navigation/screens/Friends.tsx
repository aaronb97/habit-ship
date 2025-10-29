import React, { useState } from 'react';
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
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useStore } from '../../utils/store';
import {
  acceptFriendship,
  declineFriendship,
  sendFriendRequest,
  getUidByUsername,
  type FriendshipDoc,
  type UsersDoc,
} from '../../utils/db';
import { HSButton } from '../../components/HSButton';
import { MaterialIcons } from '@expo/vector-icons';
import { getSkinById } from '../../utils/skins';
import { calculateLevel } from '../../utils/experience';

/**
 * Returns the other user's display name from a friendship given the current user's UID.
 *
 * @param f - Friendship document
 * @param selfUid - Current user's Firebase UID
 * @returns Username string for the other user in the friendship
 */
function otherName(f: FriendshipDoc, selfUid: string): string {
  return f.user1 === selfUid ? f.user2Name || f.user2 : f.user1Name || f.user1;
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
 * Converts a 24-bit integer color (0xRRGGBB) to a CSS hex color string.
 *
 * @param color - Integer color value
 * @returns Hex color string in the form "#rrggbb"
 */
function intColorToHex(color: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, color >>> 0));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}

/**
 * Darkens a 24-bit integer color by multiplying each channel by the factor.
 * Factor should be in (0,1].
 *
 * @param color - Integer color value
 * @param factor - Multiplier per channel; <1 darkens
 * @returns Hex color string for React Native styles
 */
function darkenIntColor(color: number, factor: number = 0.6): string {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  const out = (r << 16) | (g << 8) | b;
  return intColorToHex(out);
}

interface Props {
  accepted: FriendshipDoc[];
  incoming: FriendshipDoc[];
  outgoing: FriendshipDoc[];
  loadingAccepted: boolean;
  loadingIncoming: boolean;
  loadingOutgoing: boolean;
  friendProfiles: Record<string, UsersDoc | undefined>;
}

/**
 * Friends management screen.
 * Displays current friends, incoming requests (with accept/decline),
 * and outgoing requests. Allows sending a new friend request by username.
 */
export function Friends({
  accepted,
  incoming,
  outgoing,
  loadingAccepted,
  loadingIncoming,
  loadingOutgoing,
  friendProfiles,
}: Props) {
  const uid = useStore((s) => s.firebaseId);

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [inputUsername, setInputUsername] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const username = useStore((s) => s.username);

  /**
   * Accepts a pending incoming friend request.
   *
   * @param f - Friendship to accept
   */
  const acceptRequest = async (f: FriendshipDoc): Promise<void> => {
    try {
      await acceptFriendship(f.id);
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
      await declineFriendship(f.id);
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
  const handleSendFriendRequest = async (targetName: string): Promise<void> => {
    const name = targetName.trim();
    if (!uid) {
      return;
    }

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

      const outcome = await sendFriendRequest({
        user1: uid,
        user1Name: username ?? '(unknown)',
        user2: targetUid,
        user2Name: name,
      });

      switch (outcome.kind) {
        case 'created':
          Alert.alert('Request Sent', `Sent a request to ${name}.`);
          setIsAdding(false);
          setInputUsername('');
          break;
        case 'self':
          Alert.alert('Oops', 'You cannot friend yourself.');
          break;
        case 'already_friends':
          Alert.alert('Already Friends', 'You are already friends.');
          break;
        case 'already_pending':
          Alert.alert('Already Requested', 'A friend request is already pending.');

          break;
      }
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
              if (typeof text === 'string') {
                void handleSendFriendRequest(text);
              }
            },
          },
        ],
        'plain-text',
      );
    } else {
      setIsAdding(true);
    }
  };

  const renderFriendItem = (f: FriendshipDoc) => {
    if (!uid) {
      return null;
    }

    const label = otherName(f, uid);
    const fid = otherUid(f, uid);
    const profile = friendProfiles[fid];
    const rocketColorInt = profile?.rocketColor ?? 0x2a2f4a; // fallback to theme-ish dark
    const skin = profile?.selectedSkinId ? getSkinById(profile.selectedSkinId) : undefined;

    const borderColorInt = skin ? skin.color : rocketColorInt;
    const borderColor = intColorToHex(borderColorInt);

    const content = (
      <>
        <Text style={styles.cardText}>{label}</Text>

        <Text style={styles.cardText}>Level {calculateLevel(profile?.totalXP ?? 0)}</Text>
      </>
    );

    if (skin) {
      return (
        <ImageBackground
          source={skin.preview}
          imageStyle={{ borderRadius: 8 }}
          style={[styles.card, { borderColor }]}
        >
          <View style={styles.cardOverlay} />

          {content}
        </ImageBackground>
      );
    }

    return (
      <View style={[styles.card, { backgroundColor: darkenIntColor(rocketColorInt), borderColor }]}>
        {content}
      </View>
    );
  };

  /**
   * Renders a simple list row for an outgoing request.
   *
   * @param f - Friendship document (pending, initiated by self)
   * @returns Row element showing recipient's name
   */
  const renderOutgoingRow = (f: FriendshipDoc) => {
    if (!uid) {
      return null;
    }

    const label = otherName(f, uid);
    return (
      <View style={styles.row}>
        <Text style={styles.rowText}>{label}</Text>
      </View>
    );
  };

  const renderIncomingRow = (f: FriendshipDoc) => {
    if (!uid) {
      return null;
    }

    const label = otherName(f, uid);
    return (
      <View style={styles.row}>
        <Text style={styles.rowText}>{label}</Text>

        <View style={styles.actions}>
          <HSButton onPress={() => void acceptRequest(f)}>
            <MaterialIcons
              name="check"
              size={20}
              color={colors.white}
            />
          </HSButton>

          <HSButton onPress={() => void declineRequest(f)}>
            <MaterialIcons
              name="close"
              size={20}
              color={colors.white}
            />
          </HSButton>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top']}
    >
      {Platform.OS === 'android' && isAdding && (
        <View style={styles.inlinePrompt}>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor={colors.grey}
            value={inputUsername}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setInputUsername}
          />

          <TouchableOpacity
            style={[styles.btn, styles.accept]}
            disabled={busy}
            onPress={() => void handleSendFriendRequest(inputUsername)}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.btnText}>Send</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.decline]}
            disabled={busy}
            onPress={() => {
              setIsAdding(false);
              setInputUsername('');
            }}
          >
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Friends</Text>

        <TouchableOpacity
          style={styles.addBtn}
          disabled={!uid || busy}
          onPress={startAddFriend}
        >
          <Text style={styles.addBtnText}>Add Friend</Text>
        </TouchableOpacity>
      </View>

      {loadingAccepted ? (
        <ActivityIndicator color={colors.grey} />
      ) : accepted.length === 0 ? (
        <Text style={styles.empty}>No friends yet.</Text>
      ) : (
        <FlatList
          style={{ flexGrow: 0 }}
          data={accepted}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => renderFriendItem(item)}
        />
      )}

      <Text style={styles.sectionTitle}>Requests</Text>

      {loadingIncoming ? (
        <ActivityIndicator color={colors.grey} />
      ) : incoming.length === 0 ? (
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

      {loadingOutgoing ? (
        <ActivityIndicator color={colors.grey} />
      ) : outgoing.length === 0 ? (
        <Text style={styles.empty}>No outgoing requests.</Text>
      ) : (
        <FlatList
          style={{ flexGrow: 0 }}
          data={outgoing}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderOutgoingRow(item)}
        />
      )}

      {!uid && <Text style={styles.notice}>Sign-in pending. Try again shortly.</Text>}
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
  card: {
    flex: 0.5,
    height: 100,
    margin: 6,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    padding: 8,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  cardText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.smallish,
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
