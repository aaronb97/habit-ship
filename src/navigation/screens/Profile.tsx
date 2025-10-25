import { useEffect, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useStore } from '../../utils/store';
import { SKINS, getSkinById } from '../../utils/skins';

export function Profile() {
  const isFocused = useIsFocused();
  const unlockedSkins = useStore((s) => s.unlockedSkins);
  const unseenUnlockedSkins = useStore((s) => s.unseenUnlockedSkins);
  const selectedSkinId = useStore((s) => s.selectedSkinId);
  const setSelectedSkinId = useStore((s) => s.setSelectedSkinId);
  const markSkinsSeen = useStore((s) => s.markSkinsSeen);
  const money = useStore((s) => s.money);
  const username = useStore((s) => s.username);

  const allSkins = useMemo(() => Object.values(SKINS), []);
  const visibleSkins = useMemo(
    () => allSkins.filter((s) => unlockedSkins.includes(s.id)),
    [allSkins, unlockedSkins],
  );

  useEffect(() => {
    if (isFocused && unseenUnlockedSkins.length > 0) {
      const names = unseenUnlockedSkins
        .map((id) => getSkinById(id)?.title ?? id)
        .join(', ');
      Alert.alert('New skins unlocked!', names);
      markSkinsSeen();
    }
  }, [isFocused, unseenUnlockedSkins, markSkinsSeen]);
  /**
   * Handles skin card selection. If the skin is locked, shows an info alert.
   * If the selected skin is already applied, prompts to remove it (become skinless).
   * Otherwise, prompts to apply the selected skin.
   */
  const onSelect = (skinId: string) => {
    const skin = getSkinById(skinId);
    if (!skin) return;

    const isUnlocked = unlockedSkins.includes(skinId);
    if (!isUnlocked) {
      Alert.alert('Locked', 'Land on this body to unlock the skin.');
      return;
    }

    const isCurrentlySelected = selectedSkinId === skinId;
    if (isCurrentlySelected) {
      Alert.alert('Remove Skin', 'Do you want to remove the current skin?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: () => setSelectedSkinId(undefined),
        },
      ]);
      return;
    }

    Alert.alert('Apply Skin', `Do you want to apply ${skin.title} skin?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        style: 'default',
        onPress: () => setSelectedSkinId(skin.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Username</Text>
        <Text style={styles.balanceValue}>{username}</Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Space Money</Text>
        <Text style={styles.balanceValue}>{money.toLocaleString()}</Text>
      </View>
      <Text style={styles.sectionTitle}>Skins</Text>
      <FlatList
        data={visibleSkins}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedSkinId === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.selected]}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.square}>
                <Image source={item.preview} style={styles.image} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
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
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.primaryText,
  },
  balanceValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.large,
    color: colors.accent,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.large,
    color: colors.primaryText,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 80,
  },
  row: {
    justifyContent: 'space-around',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  card: {
    flex: 1 / 3,
    alignItems: 'center',
    marginHorizontal: 4,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    backgroundColor: colors.card,

    // minHeight: 80,
    // minWidth: 80,
    // maxHeight: 150,
    // maxWidth: 150,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  square: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  locked: {
    opacity: 0.35,
  },
  lockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockText: {
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
  },
  cardTitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.small,
    color: colors.text,
  },
});
