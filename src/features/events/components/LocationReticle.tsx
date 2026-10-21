import { StyleSheet, Text, View } from "react-native";

import { InkButton, Paper } from "../../../components/ui";
import { palette } from "../../../theme/palette";
import { space, type } from "../../../theme/tokens";

export type LocationReticleProps = {
  onConfirm: () => void;
  onCancel: () => void;
  bottomInset: number;
};

/**
 * Placing a point by tapping a map you are also panning is a fight; the reader
 * moves the map under a fixed crosshair instead, then confirms.
 */
export function LocationReticle({
  onConfirm,
  onCancel,
  bottomInset,
}: LocationReticleProps) {
  return (
    <>
      <View pointerEvents="none" style={styles.centre}>
        <View style={styles.horizontal} />
        <View style={styles.vertical} />
        <View style={styles.ring} />
      </View>

      <Paper style={[styles.bar, { bottom: bottomInset + 16 }]}>
        <View style={styles.barInner}>
          <Text style={styles.hint}>
            Déplacez la carte pour amener le lieu sous le réticule.
          </Text>
          <View style={styles.actions}>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={onCancel}
            />
            <InkButton
              label="Confirmer"
              variant="solid"
              grow
              onPress={onConfirm}
            />
          </View>
        </View>
      </Paper>
    </>
  );
}

const ARM = 26;

const styles = StyleSheet.create({
  centre: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  horizontal: {
    position: "absolute",
    width: ARM * 2,
    height: 1,
    backgroundColor: palette.wax,
  },
  vertical: {
    position: "absolute",
    width: 1,
    height: ARM * 2,
    backgroundColor: palette.wax,
  },
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: palette.wax,
  },
  bar: { position: "absolute", left: space.lg, right: space.lg },
  /* Dix points entre la phrase et les boutons : aucun jeton ne vaut dix, et
     les trois barres de viseur portent le même écart. Il reste donc écrit en
     clair, comme chez les deux autres. */
  barInner: { padding: space.md, gap: 10 },
  hint: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  /* La mise des deux autres viseurs : à parts égales sur toute la largeur.
     Serrés dans l'angle droit, les deux boutons se lisaient comme une
     remarque au bas d'une phrase, là où ils sont la seule chose à faire une
     fois le lieu amené sous la croix. */
  actions: { flexDirection: "row", gap: space.sm },
});
