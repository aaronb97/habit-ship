import { Button } from '@react-navigation/elements';
import { View, Text } from 'react-native';

export function SetupFirstHabit() {
  return (
    <View>
      <Text>Setup First Habit Screen</Text>
      <Button screen="SetupFirstMountain">Go to mountain screen</Button>
    </View>
  );
}
