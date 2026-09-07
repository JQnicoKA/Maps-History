import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { palette } from "../../theme/palette";

export type InkFieldProps = TextInputProps & {
  label: string;
};

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
  container: { gap: 5 },
  label: {
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: palette.inkSoft,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: palette.inkFaint,
    paddingVertical: 6,
    fontSize: 15,
    color: palette.ink,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: palette.inkFaint,
    paddingHorizontal: 8,
  },
});
