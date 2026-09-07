import { StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";

/**
 * Missing credentials otherwise surface as a blank plate and a wall of 403s;
 * this says which variable is absent.
 */
export function MissingConfigNotice({ missing }: { missing: string[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuration incomplète</Text>
      <Text style={styles.body}>
        Copiez <Text style={styles.code}>.env.example</Text> vers{" "}
        <Text style={styles.code}>.env</Text> et renseignez :
      </Text>
      {missing.map((name) => (
        <Text key={name} style={styles.code}>
          {name}
        </Text>
      ))}
      <Text style={styles.body}>Puis rechargez complètement l'application.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
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
  code: { fontFamily: "Courier", fontSize: 13, color: palette.ink },
});
