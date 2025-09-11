import { View, Text, Button } from 'react-native';
import { useSetup } from '../../utils/useIsSetupFinished';

export function SetupFirstMountain() {
  const { setIsSetupFinished } = useSetup();

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
