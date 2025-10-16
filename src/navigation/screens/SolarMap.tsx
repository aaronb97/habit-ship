import { Alert } from 'react-native';
import { SolarSystemMap } from '../../components/SolarSystemMap';
import { useStore } from '../../utils/store';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

export function SolarMap() {
  const isFocused = useIsFocused();
  const { justLanded, userPosition } = useStore();
  const shownForLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFocused) return;
    if (justLanded) {
      const loc = userPosition.startingLocation;
      if (shownForLocationRef.current !== loc) {
        shownForLocationRef.current = loc;
        Alert.alert(
          '🎉 Congratulations!',
          `You have landed on ${loc}! Open the Home tab to choose your next destination.`,
        );
      }
    }
  }, [isFocused, justLanded, userPosition.startingLocation]);

  // Reset the local guard when justLanded resets (after visiting Home)
  useEffect(() => {
    if (!justLanded) {
      shownForLocationRef.current = null;
    }
  }, [justLanded]);

  return <SolarSystemMap />;
}
