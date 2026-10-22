import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";

import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/**
 * Ce qu'une proposition vaut une fois la réponse donnée.
 *
 * `revealed` est la bonne réponse qu'on n'a **pas** choisie : elle s'allume en
 * vert comme celle qu'on aurait dû prendre, mais sans fête — le ressort est
 * réservé à celui qui a trouvé. Une animation sur la bonne réponse d'une
 * question ratée féliciterait de s'être trompé.
 */
export type OptionState = "waiting" | "right" | "wrong" | "revealed" | "faded";

export type StudyOptionProps = {
  label: string;
  state: OptionState;
  onPress: () => void;
};

export function StudyOption({ label, state, onPress }: StudyOptionProps) {
  /**
   * Le petit ressort de la bonne réponse trouvée.
   *
   * Une poussée brève et un retour élastique, aux mêmes réglages que la
   * pression des onglets — c'est le geste de l'application, et une seconde
   * grammaire d'animation se remarquerait tout de suite.
   */
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== "right") return;
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.045,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        damping: 11,
        stiffness: 340,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state, pop]);

  const answered = state !== "waiting";

  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: answered }}
        accessibilityLabel={
          state === "right"
            ? `${label} — bonne réponse`
            : state === "wrong"
              ? `${label} — mauvaise réponse`
              : state === "revealed"
                ? `${label} — c'était la bonne réponse`
                : label
        }
        disabled={answered}
        onPress={onPress}
        style={({ pressed }) => [
          styles.option,
          state === "right" || state === "revealed" ? styles.good : null,
          state === "wrong" ? styles.bad : null,
          state === "faded" ? styles.faded : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text
          style={[
            styles.label,
            state === "right" || state === "revealed" || state === "wrong"
              ? styles.onColour
              : null,
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1.5,
    borderColor: palette.line,
    ...shadow.soft,
  },
  /** Le vert de l'application, celui qui dit « c'est bon ». */
  good: { backgroundColor: palette.good, borderColor: palette.good },
  bad: { backgroundColor: palette.danger, borderColor: palette.danger },
  /**
   * Les deux propositions qui n'étaient ni prises ni justes.
   *
   * Elles pâlissent au lieu de rougir : seule celle qu'on a prise a été
   * refusée, et peindre les trois en rouge dirait qu'on avait trois fois
   * tort — ce qui est vrai, mais ce n'est pas ce qu'on vient d'apprendre.
   */
  faded: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  label: {
    ...type.body,
    fontWeight: "600",
    textAlign: "center",
    color: palette.ink,
  },
  onColour: { color: palette.surfaceRaised },
});
