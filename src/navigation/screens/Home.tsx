import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../utils/store';

import { useIsFocused } from '@react-navigation/native';
import { LevelUpListener } from '../../components/LevelUpListener';

export function Home() {
  const isFocused = useIsFocused();

  const { acknowledgeLandingOnHome } = useStore();

  const justLanded = useStore((s) => s.justLanded);

  // When user visits Home after landing, acknowledge to clear the Home tab badge
  useEffect(() => {
    if (isFocused && justLanded) {
      acknowledgeLandingOnHome();
    }
  }, [isFocused, justLanded, acknowledgeLandingOnHome]);

  return (
    <>
      <LevelUpListener />
      <SafeAreaView style={styles.container}></SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
