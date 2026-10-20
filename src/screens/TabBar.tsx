import { useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "../theme/palette";
import { space, type } from "../theme/tokens";

const MAP = require("../../assets/icons/view-map.png");
const BOOK = require("../../assets/icons/book.png");
const PEOPLE = require("../../assets/icons/people.png");
const TREE = require("../../assets/icons/tree.png");

export type TabKey = "map" | "events" | "people" | "trees";

/**
 * Les quatre onglets, dans l'ordre où ils se lisent.
 *
 * La carte d'abord, parce qu'elle est ce que l'application est ; puis les
 * trois collections, dans l'ordre où elles se bâtissent — on écrit des
 * événements, on nomme les gens qui y figurent, et on relie ces gens en
 * arbres. Un arbre sans personnages ne se bâtit pas ; l'ordre le dit.
 */
const TABS: { key: TabKey; label: string; icon: number }[] = [
  { key: "map", label: "Carte", icon: MAP },
  { key: "events", label: "Événements", icon: BOOK },
  { key: "people", label: "Personnages", icon: PEOPLE },
  { key: "trees", label: "Arbres", icon: TREE },
];

/** La hauteur de la rangée, sans la zone sûre que la barre porte en plus. */
const ROW_HEIGHT = 58;

export type TabBarProps = {
  value: TabKey;
  onChange: (key: TabKey) => void;
};

/**
 * La barre de navigation, au bas de l'écran.
 *
 * **Ancrée, et c'est ce qui la rend simple.** Elle a flotté un temps : une
 * gélule détachée des bords, en verre teinté, avec un lavis qui marquait
 * l'onglet retenu. Tout cela coûtait cher à la mise en page — une barre qui
 * flotte ne prend plus sa place dans la colonne, donc chaque page devait lui
 * réserver sa hauteur, et le contenu passait dessous. Ancrée, elle est le
 * frère des scènes : chacune s'arrête d'elle-même à son sommet et aucune n'a
 * à la connaître.
 *
 * Ce qui marque l'onglet courant est son **encre**, et rien d'autre. Il n'y
 * a ni pastille, ni lavis, ni rien qui voyage : un fond sous un onglet
 * raconte le trajet plutôt que l'arrivée, et la cire est depuis toujours la
 * couleur par laquelle cette application dit « voici ce que vous avez sous
 * les yeux ».
 *
 * Le seul mouvement est celui du doigt : le glyphe se creuse sous la touche
 * et revient. Il accuse réception, y compris sur l'onglet déjà ouvert.
 */
export function TabBar({ value, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();

  /**
   * Une échelle par onglet, créées une fois pour toutes.
   *
   * Par onglet et non une seule partagée : on peut toucher le deuxième
   * pendant que le premier finit de revenir, et une valeur unique ferait
   * sauter celui qu'on vient de quitter.
   */
  const scales = useRef(TABS.map(() => new Animated.Value(1))).current;

  const press = (key: TabKey, index: number) => {
    const scale = scales[index];
    if (scale) {
      // Coupé net plutôt que mis en file : un doigt pressé deux fois de
      // suite doit repartir de l'instant présent, pas finir le geste d'avant.
      scale.stopAnimation();
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.72,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        /* Un ressort au retour, et un peu vif : c'est ce qui fait un
           « pop » plutôt qu'un gonflement. Le dépassement est faible —
           l'onglet revient à sa taille, il ne la célèbre pas. */
        Animated.spring(scale, {
          toValue: 1,
          damping: 11,
          stiffness: 340,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onChange(key);
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab, index) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => press(tab.key, index)}
            style={styles.tab}
          >
            <Animated.Image
              source={tab.icon}
              style={[
                styles.glyph,
                {
                  tintColor: active ? palette.wax : palette.inkFaint,
                  transform: [{ scale: scales[index] ?? 1 }],
                },
              ]}
              resizeMode="contain"
            />
            <Text
              style={[styles.label, active && styles.labelOn]}
              numberOfLines={1}
              /* « Personnages » est le mot long ; sur un écran étroit il se
                 rétrécit plutôt que de devenir « Personn… ». */
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Opaque et bordée d'un filet.
   *
   * Translucide, elle laisserait passer la carte, qui est une planche
   * chargée : les quatre mots y deviendraient illisibles au-dessus d'un
   * trait de côte. Et elle porte la zone sûre de l'appareil dans son propre
   * rembourrage, de sorte qu'aucune page n'ait à la compter.
   */
  bar: {
    flexDirection: "row",
    backgroundColor: palette.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  tab: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    /* Un point entre le glyphe et son mot : rendre l'écart au glyphe plutôt
       qu'au vide est ce qui permet de le dessiner grand sans grandir la
       rangée. Il ne manque pas — le mot est en petites capitales sous une
       image, deux choses qu'on ne confond pas même collées. */
    gap: 1,
    paddingHorizontal: space.xs,
  },
  glyph: { width: 30, height: 30 },
  label: {
    ...type.legend,
    /* Dit plutôt que laissé à la fonte : sans lui, l'interligne dépend du
       caractère et le compte de la rangée cesse d'être vérifiable. */
    lineHeight: 13,
    textTransform: "none",
    fontWeight: "600",
    color: palette.inkFaint,
  },
  /** L'encre de cire, et elle seule, dit l'onglet qu'on regarde. */
  labelOn: { color: palette.wax, fontWeight: "700" },
});
