import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, TOUCH, type } from "../../theme/tokens";

export type InkFieldProps = TextInputProps & {
  /**
   * The line above the box, when the field needs naming.
   *
   * Absent where what is above it already says so — a card titled « Mes
   * classeurs » whose only field is the one that sifts them. An empty string
   * would not do: it still draws a line of type and the gap under it, so the
   * box would sit low for no reason.
   */
  label?: string;
};

/**
 * Label above, filled input below. A boxed field reads as tappable where the
 * bare underline this replaced looked like decoration.
 */
export function InkField({ label, style, ...props }: InkFieldProps) {
  return (
    <View style={styles.container}>
      {label === undefined ? null : (
        <Text style={styles.label}>{label}</Text>
      )}
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
