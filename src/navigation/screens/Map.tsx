import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../styles/theme';

export function Map() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Work in progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    fontFamily: fonts.medium,
    color: colors.primaryText,
  },
});
