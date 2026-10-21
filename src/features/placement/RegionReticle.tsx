import { StyleSheet, Text, View } from "react-native";

import { Chip, InkButton, Paper } from "../../components/ui";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/**
 * The radii offered, in metres.
 *
 * Three, and all of them wide: a country, a subcontinent, a continent. The
 * tighter steps that used to open the row — 50 and 200 km — were the scale at
 * which one searches for a *place*, and that is not what this filter is for.
 * What the catalogue holds is history, which happens at the scale of realms:
 * asking for events within fifty kilometres of a point returned nothing worth
 * the gesture of having drawn the circle.
 */
export const RADII = [500_000, 2_000_000, 5_000_000];

export type RegionReticleProps = {
  metres: number;
  onMetresChange: (metres: number) => void;
  /** How many screen points a metre is worth right now — null while unknown. */
  pointsPerMetre: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  bottomInset: number;
};

/**
 * A place and how far around it, chosen where it can be seen.
 *
 * The radius was a row of distances in a filter panel, which is the one thing
 * a number cannot convey: "five hundred kilometres" means nothing until it is
 * drawn over the coastlines, and whether it holds one city or six countries
 * is the only thing the reader actually wants to know.
 *
 * The circle is drawn in screen points rather than as a shape on the map, and
 * that is not a shortcut — the centre *is* the crosshair, so the circle never
 * moves relative to it while the plate is dragged. Only zooming changes its
 * size, and the screen is where that change is felt.
 */
export function RegionReticle({
  metres,
  onMetresChange,
  pointsPerMetre,
  onConfirm,
  onCancel,
  bottomInset,
}: RegionReticleProps) {
  const radius = pointsPerMetre === null ? null : metres * pointsPerMetre;

  return (
    <>
      <View pointerEvents="none" style={styles.centre}>
        {radius === null ? null : (
          <View
            style={[
              styles.ring,
              {
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                marginLeft: -radius,
                marginTop: -radius,
              },
            ]}
          />
        )}
        <View style={styles.horizontal} />
        <View style={styles.vertical} />
        <View style={styles.pip} />
      </View>

      <Paper style={[styles.bar, { bottom: bottomInset + 16 }]}>
        <View style={styles.barInner}>
          <Text style={styles.hint}>
            Choisissez l'endroit , puis la portée.
          </Text>
          <View style={styles.radii}>
            {RADII.map((one) => (
              <Chip
                key={one}
                label={one >= 1000_000 ? `${one / 1000_000} 000 km` : `${one / 1000} km`}
                selected={one === metres}
                onPress={() => onMetresChange(one)}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <InkButton
              label="Annuler"
              /* Tonal et non plus discret : à parts égales de largeur avec
                 « Confirmer », un bouton sans fond ne se lisait plus comme un
                 bouton mais comme une phrase posée à côté d'un bouton. Le
                 gris creusé lui rend sa forme sans lui donner le rang du
                 plein. */
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
  /**
   * The reach, drawn from the crosshair outward.
   *
   * Dashed and unfilled: a filled disc would hide the very coastlines the
   * reader is judging it against.
   */
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.wax,
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
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.wax,
  },
  bar: { position: "absolute", left: space.lg, right: space.lg },
  /* Dix points entre la phrase et ce qui suit : aucun jeton ne vaut dix, et
     les trois barres de viseur portent le même écart. Il reste donc écrit en
     clair, chez les trois. */
  barInner: { padding: space.md, gap: 10 },
  hint: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  radii: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.sm,
  },
  /**
   * Les deux boutons se partagent la largeur, au lieu de se serrer à droite.
   *
   * Plus de `justifyContent` : chacun porte `grow`, donc ils prennent la
   * moitié de la rangée chacun et il n'y a plus de place à distribuer. C'est
   * la mise des pieds de feuille, et ce bandeau est le pied de cette carte —
   * deux boutons blottis dans un angle se lisaient comme une remarque, là où
   * ils sont la seule chose à faire une fois le cercle réglé.
   */
  actions: { flexDirection: "row", gap: space.sm },
});
