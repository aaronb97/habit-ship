import { StyleSheet, TextInputProps, TextInput } from 'react-native';
import { colors, fonts, fontSizes } from '../styles/theme';
import { forwardRef } from 'react';

const styles = StyleSheet.create({
  input: {
    marginTop: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: fontSizes.medium,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
});

/**
 * A styled TextInput component for HabitShip.
 */
export const HSTextInput = forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    return (
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor="rgba(255,255,255,0.6)"
        {...props}
      />
    );
  },
);

HSTextInput.displayName = 'HSTextInput';
