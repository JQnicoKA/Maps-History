import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FolderSelector } from "./FolderSelector";
import { Dialog, SegmentedControl } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { narrowing, type Sift } from "../sift";
import type { Importance } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

/** Le même entonnoir que la pastille de la carte et que la bibliothèque. */
const FILTER = require("../../../../assets/icons/filter.png");

/** Les trois crans, et « Toutes » que seul un filtre propose. */
const IMPORTANCES: { value: Importance | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
];

export type SiftButtonProps = {
  value: Sift;
  onChange: (next: Sift) => void;
};

/**
 * La pastille qui resserre une page de collection, et son panneau.
 *
 * **La même que celle de la bibliothèque**, jusqu'au chiffre qu'elle porte :
 * ce sont deux listes longues qu'on vient fouiller, et rien ne justifierait
 * qu'elles se tamisent de deux gestes différents. Elle prend la cire quand
 * quelque chose est demandé, parce qu'une liste qui montre moins que tout ne
 * doit jamais avoir l'air d'une liste qui montre tout.
 *
 * Elle n'a aucun rapport avec le filtre de la carte, qui vit dans
 * `EventsProvider` et commande les calques de la planche. Celui-ci est à sa
 * page : le fermer ou changer d'onglet le laisse où il est, et il ne cache
 * rien nulle part ailleurs.
 */
export function SiftButton({ value, onChange }: SiftButtonProps) {
  const { folderNames } = useEvents();
  const [open, setOpen] = useState(false);
  const narrowed = narrowing(value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          narrowed === 0 ? "Filtrer" : `Filtres — ${narrowed} actifs`
        }
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.tool,
          narrowed > 0 && styles.toolOn,
          pressed && styles.dim,
        ]}
      >
        <Text style={[styles.toolLabel, narrowed > 0 && styles.toolLabelOn]}>
          {narrowed === 0 ? "Filtres" : `Filtres · ${narrowed}`}
        </Text>
        <Text style={[styles.toolMore, narrowed > 0 && styles.toolLabelOn]}>
          ⌄
        </Text>
      </Pressable>

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title="Filtres"
        icon={FILTER}
        /* Chaque réponse tombe sur la liste à l'instant où on la donne : il
           n'y a rien à confirmer, et une rangée de boutons au pied ne serait
           que du mobilier. La croix est toute la sortie. */
        dismissLabel={null}
      >
        <View style={styles.section}>
          <Text style={styles.note}>Classement</Text>
          {/* Le même contrôle qu'à l'étape « Classement » des formulaires,
              sans le droit d'en nommer un : on ne range rien depuis un
              filtre. */}
          <FolderSelector
            known={folderNames}
            value={value.folders}
            onChange={(folders) => onChange({ ...value, folders })}
            emptyLabel="Filtrer par classeur"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.note}>Importance</Text>
          <SegmentedControl
            segments={IMPORTANCES}
            value={value.importance ?? "all"}
            onChange={(choice) =>
              onChange({
                ...value,
                importance: choice === "all" ? null : choice,
              })
            }
          />
        </View>
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  /** Un bouton dessiné, comme ceux de la bibliothèque : cerné et levé. */
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  toolOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  toolLabel: { ...type.legend, fontWeight: "700", color: palette.ink },
  toolLabelOn: { color: palette.surfaceRaised },
  toolMore: { ...type.legend, color: palette.inkFaint },
  dim: { opacity: 0.6 },
  /** Une étiquette et ce qu'elle commande, serrés l'un contre l'autre. */
  section: { gap: space.sm },
  note: { ...type.legend, color: palette.inkFaint },
});
