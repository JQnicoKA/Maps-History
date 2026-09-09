import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, TOUCH, type } from "../../theme/tokens";

export type InkFieldProps = TextInputProps & {
  label: string;
};

/**
 * Label above, filled input below. A boxed field reads as tappable where the
 * bare underline this replaced looked like decoration.
 */
export function InkField({ label, style, ...props }: InkFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.inkFaint}
        {...props}
        style={[styles.input, props.multiline && styles.multiline, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  label: { ...type.legend, color: palette.inkSoft },
  input: {
    minHeight: TOUCH,
    backgroundColor: palette.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 16,
    color: palette.ink,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
});
