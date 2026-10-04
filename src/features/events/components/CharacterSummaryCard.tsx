import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paper } from "../../../components/ui";
import { lifespan } from "../lifespan";
import type { Character } from "../types";
import { palette } from "../../../theme/palette";
import { space } from "../../../theme/tokens";

export type CharacterSummaryCardProps = {
  person: Character;
  onOpen: () => void;
};

/**
 * Une personne, dans la liste, à côté des événements.
 *
 * La même tuile qu'un événement — papier, vignette, deux lignes, chevron —
 * à une chose près : le **portrait est rond**. C'est le seul signal, et il
 * suffit, parce que c'est celui que la fiche de détail emploie déjà pour la
 * distribution d'un événement. Un carré arrondi est une chose, un rond est
 * quelqu'un.
 *
 * Pas de pastilles de classeur en troisième ligne : un personnage n'est rangé
 * nulle part, il vit entre deux dates, et c'est la ligne au-dessus qui le dit.
 */
export function CharacterSummaryCard({
  person,
  onOpen,
}: CharacterSummaryCardProps) {
  const face = person.photos[0];
  const dates = lifespan(person);

  return (
    <Paper>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Détail de ${person.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        {face ? (
          <Image source={{ uri: face.url }} style={styles.portrait} />
        ) : (
          <View style={[styles.portrait, styles.empty]}>
            <Text style={styles.initial}>
              {person.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.text}>
          {/* Vide quand on ne sait ni la naissance ni la mort : mieux vaut une
              ligne absente qu'une ligne qui ment. */}
          {dates === "" ? null : <Text style={styles.dates}>{dates}</Text>}
          <Text style={styles.name} numberOfLines={2}>
            {person.name}
          </Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Paper>
  );
}

const PORTRAIT = 56;

const styles = StyleSheet.create({
  // Les mesures de `EventSummaryCard`, au pixel : les deux tuiles se suivent
  // dans la même colonne et toute différence se lirait comme un défaut.
  body: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    gap: space.md,
  },
  pressed: { opacity: 0.7 },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  initial: { fontSize: 22, fontWeight: "700", color: palette.inkFaint },
  text: { flex: 1, gap: 3 },
  dates: { fontSize: 12, color: palette.wax, fontWeight: "600" },
  name: { fontSize: 16, lineHeight: 21, color: palette.ink, fontWeight: "600" },
  chevron: {
    fontSize: 22,
    color: palette.inkFaint,
    paddingHorizontal: space.xs,
  },
});
