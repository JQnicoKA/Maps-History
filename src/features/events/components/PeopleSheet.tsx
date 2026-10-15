import { Image, StyleSheet, View } from "react-native";

import { CharacterManager } from "./CharacterManager";
import { TreeManager } from "../../genealogy/TreeManager";
import {
  GlyphButton,
  InkButton,
  SegmentedControl,
  Sheet,
} from "../../../components/ui";
import type { Character } from "../types";
import { space } from "../../../theme/tokens";

const PEOPLE = require("../../../../assets/icons/people.png");

/** Les deux moitiés de ce panneau : qui on connaît, et comment ils se relient. */
export type PeopleTab = "character" | "tree";

const PARTS = [
  { value: "character" as const, label: "Personnages" },
  { value: "tree" as const, label: "Arbres" },
];

/**
 * La porte des personnages et des arbres.
 *
 * Elle ne mène plus à la création : écrire un personnage se demande au `+`,
 * avec les événements, parce que ce sont les deux notes qu'on ajoute à une
 * collection. Ce bouton-ci ouvre ce qu'on a déjà — la liste de ses
 * personnages, celle de ses arbres — et c'est pour cela qu'il reste séparé.
 */
export function PeopleButton({ onPress }: { onPress: () => void }) {
  return (
    <GlyphButton accessibilityLabel="Personnages et arbres" onPress={onPress}>
      <Image source={PEOPLE} style={styles.glyph} resizeMode="contain" />
    </GlyphButton>
  );
}

export type PeopleSheetProps = {
  visible: boolean;
  /** Laquelle des deux moitiés est ouverte — tenue par l'écran. */
  tab: PeopleTab;
  onTabChange: (tab: PeopleTab) => void;
  /**
   * Demande la fiche de quelqu'un, ou le formulaire sur lui.
   *
   * L'écran répond en baissant ce panneau puis en levant le sien — voir
   * `CharacterManager` pour la raison : placer quelqu'un donne l'écran entier
   * au viseur, qui emporterait un panneau niché dans celui-ci.
   */
  onReadCharacter: (person: Character) => void;
  onEditCharacter: (target: Character | "new") => void;
  /** Demande le catalogue de la bibliothèque, des personnages ou des arbres. */
  onSeekCharacter: () => void;
  onSeekTree: () => void;
  /** Demande qu'un arbre soit dessiné, plein écran. */
  onOpenTree: (id: string) => void;
  onClose: () => void;
  /** Tiré une fois le panneau hors de l'écran — voir `Sheet`. */
  onClosed?: () => void;
};

/**
 * Ce que la collection connaît déjà : les gens, et les lignées.
 *
 * Deux onglets et non deux boutons, parce que c'est une vraie paire : un arbre
 * n'est fait que de personnages, et on passe de l'un à l'autre en bâtissant.
 *
 * Le panneau porte les deux noms plutôt que celui de son premier onglet.
 * L'usage de cette application était l'inverse — « Territoires » pour un
 * panneau qui tient aussi les villes — et il reposait sur l'idée que le second
 * onglet était un ajout. Ici les deux moitiés se valent.
 */
export function PeopleSheet({
  visible,
  tab,
  onTabChange,
  onReadCharacter,
  onEditCharacter,
  onSeekCharacter,
  onSeekTree,
  onOpenTree,
  onClose,
  onClosed,
}: PeopleSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="Personnages et arbres"
      // Deux listes qui grandissent à mesure qu'on travaille ; un panneau qui
      // se redimensionnerait autour d'elles ne tiendrait jamais en place.
      tall
      footer={
        <InkButton label="Fermer" variant="tonal" grow onPress={onClose} />
      }
    >
      <View style={styles.switcher}>
        <SegmentedControl segments={PARTS} value={tab} onChange={onTabChange} />
      </View>

      {tab === "character" ? (
        <CharacterManager
          onRead={onReadCharacter}
          onEdit={onEditCharacter}
          onSeek={onSeekCharacter}
        />
      ) : (
        <TreeManager onOpen={onOpenTree} onSeek={onSeekTree} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 23, height: 23 },
  switcher: { paddingHorizontal: space.xl, paddingBottom: space.lg },
});
