import {
  GlassView,
  GlassViewProps,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { View } from 'react-native';

export function GlassOrDefault(props: GlassViewProps) {
  if (isLiquidGlassAvailable()) {
    return <GlassView {...props} />;
  }

  return (
    <View
      style={[
        {
          backgroundColor: 'rgb(0,0,0,0.7)',
          borderColor: 'rgb(255,255,255,0.1)',
          borderWidth: 1,
        },
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}
