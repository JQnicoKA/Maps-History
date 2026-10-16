import { Image, StyleSheet } from "react-native";

import { TreeManager } from "../../genealogy/TreeManager";
import { GlyphButton, InkButton, Sheet } from "../../../components/ui";

const PEOPLE = require("../../../../assets/icons/people.png");

/**
 * La porte des arbres.
 *
 * Elle a porté les personnages un moment, en deux onglets. Ils n'y sont plus,
 * et la raison est qu'ils n'y avaient pas de métier : **écrire** un personnage
 * se demande au `+`, avec les événements, parce que ce sont les deux notes
 * qu'on ajoute à une collection ; **le relire ou le corriger** se fait depuis
 * sa fiche, qu'on ouvre depuis la carte, depuis la distribution d'un événement
 * ou depuis la vue liste. Une liste de plus ne faisait que répéter.
 *
 * Un arbre, lui, n'a pas d'autre porte : il ne se pose pas sur la carte et
 * aucun événement ne le cite.
 */
export function TreesButton({ onPress }: { onPress: () => void }) {
  return (
    <GlyphButton accessibilityLabel="Arbres" onPress={onPress}>
      <Image source={PEOPLE} style={styles.glyph} resizeMode="contain" />
    </GlyphButton>
  );
}

export type TreesSheetProps = {
  visible: boolean;
  /** Demande le catalogue des arbres de la bibliothèque. */
  onSeek: () => void;
  /** Demande qu'un arbre soit dessiné, plein écran. */
  onOpen: (id: string) => void;
  onClose: () => void;
  /** Tiré une fois le panneau hors de l'écran — voir `Sheet`. */
  onClosed?: () => void;
};

/** Les lignées de la collection, et de quoi en bâtir une de plus. */
export function TreesSheet({
  visible,
  onSeek,
  onOpen,
  onClose,
  onClosed,
}: TreesSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="Arbres"
      // Une liste qui grandit à mesure qu'on travaille ; un panneau qui se
      // redimensionnerait autour d'elle ne tiendrait jamais en place.
      tall
      footer={
        <InkButton label="Fermer" variant="tonal" grow onPress={onClose} />
      }
    >
      <TreeManager onOpen={onOpen} onSeek={onSeek} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 23, height: 23 },
});
