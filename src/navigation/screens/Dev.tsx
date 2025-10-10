import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts } from '../../styles/theme';
import { useStore } from '../../utils/store';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Dev() {
  const store = useStore();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Development Tools</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store State</Text>
          <Text style={styles.code}>{JSON.stringify(store, null, 2)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.primaryText,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.primaryText,
    marginBottom: 10,
  },
  code: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.card,
    padding: 15,
    borderRadius: 8,
  },
});
