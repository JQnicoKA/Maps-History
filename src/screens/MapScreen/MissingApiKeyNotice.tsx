import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";

/**
 * Without a key MapTiler returns 403 for every tile, which renders as a blank
 * plate and a wall of network errors — this says what is actually wrong.
 */
export function MissingApiKeyNotice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No MapTiler key</Text>
      <Text style={styles.body}>
        Copy <Text style={styles.code}>.env.example</Text> to{" "}
        <Text style={styles.code}>.env</Text>, set{" "}
        <Text style={styles.code}>EXPO_PUBLIC_MAPTILER_API_KEY</Text>, then
        reload the app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 20,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: palette.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: palette.inkSoft,
  },
  code: { fontFamily: "Courier", color: palette.ink },
});
