import { View, Text, Button } from 'react-native';
import { useStore } from '../../utils/store';

export function SetupFirstMountain() {
  const { setIsSetupFinished } = useStore();

  return (
    <View>
      <Text>Setup First Mountain Screen</Text>
      <Button
        title="Finish setup"
        onPress={() => {
          setIsSetupFinished(true);
        }}
      />
    </View>
  );
}
