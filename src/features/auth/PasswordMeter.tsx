import { StyleSheet, Text, View } from "react-native";

import { failures, strength } from "./password";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type PasswordMeterProps = { password: string };

/**
 * How good the password being typed is, in a bar and a sentence.
 *
 * Shared by the two places one is chosen — the end of a recovery, and the
 * account card — because a rule the reader met on one screen and not the other
 * is a rule they will think the app invented on the spot.
 *
 * It names what is *missing* rather than ticking off what is done: a list of
 * four lines, three of them green, is a puzzle; "il manque une majuscule" is
 * an instruction.
 */
export function PasswordMeter({ password }: PasswordMeterProps) {
  const missing = failures(password);

  return (
    <View style={styles.rules}>
      <View style={styles.gauge}>
        <View
          style={[
            styles.gaugeFill,
            {
              width: `${Math.round(strength(password) * 100)}%`,
              backgroundColor: missing.length === 0 ? palette.forest : palette.wax,
            },
          ]}
        />
      </View>
      <Text style={styles.rulesText}>
        {password === ""
          ? "Il faut 8 caractères ou plus, une minuscule, une majuscule et un chiffre."
          : missing.length === 0
            ? "Bon mot de passe."
            : `Il manque : ${missing.map((rule) => rule.label).join(", ")}.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: space.sm },
  gauge: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.sunken,
    overflow: "hidden",
  },
  gaugeFill: { height: "100%", borderRadius: radius.pill },
  rulesText: { ...type.caption, color: palette.inkSoft },
});
