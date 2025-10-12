import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../styles/theme';
import { SolarSystemMap } from '../../components/SolarSystemMap';

export function SolarMap() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <SolarSystemMap />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
