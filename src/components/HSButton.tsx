import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, TouchableOpacityProps, Text } from 'react-native';
import { fonts, fontSizes, colors } from '../styles/theme';

interface HSButtonProps extends TouchableOpacityProps {
  children: ReactNode;
}

export function HSButton({ children, ...props }: HSButtonProps) {
  return (
    <TouchableOpacity
      {...props}
      style={[styles.button, props.style, props.disabled && styles.disabled]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, props.disabled && styles.disabledText]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderColor: 'rgba(255,255,255, 0.8)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
  },
  disabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  text: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.medium,
    color: colors.white,
  },
  disabledText: {
    color: 'rgba(255,255,255, 0.4)',
  },
});
