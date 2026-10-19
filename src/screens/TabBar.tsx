import { useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { palette } from "../theme/palette";
import { radius, space, type } from "../theme/tokens";

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
 * arbres.
 */
const TABS: { key: TabKey; label: string; icon: number }[] = [
  { key: "map", label: "Carte", icon: MAP },
  { key: "events", label: "Événements", icon: BOOK },
  { key: "people", label: "Personnages", icon: PEOPLE },
  { key: "trees", label: "Arbres", icon: TREE },
];

/** La hauteur de la gélule, sans la marge qui la détache du bord. */
export const TAB_BAR_HEIGHT = 64;

/** Ce qui la sépare des bords de l'écran, et du bas. */
export const TAB_BAR_MARGIN = 14;

export type TabBarProps = {
  value: TabKey;
  onChange: (key: TabKey) => void;
};

/**
 * La barre de navigation : une gélule qui flotte au-dessus de la page.
 *
 * **Flottante et non ancrée**, ce qui change sa géométrie autant que son
 * dessin : elle ne prend plus sa place dans la colonne de la coquille, donc
 * le contenu passe dessous et chaque page doit lui réserver sa hauteur —
 * voir `Shell`.
 *
 * **Rien ne glisse d'un onglet à l'autre.** Une pastille de cire voyageait
 * sous l'onglet retenu ; elle disait la même chose que l'encre des mots, en
 * plus gros et en mouvement, et sur quatre onglets serrés elle faisait un
 * bloc de couleur qui se remarquait avant les noms. Ce qui marque
 * l'onglet courant est maintenant sa seule **encre**, et le mouvement
 * appartient au doigt : le glyphe se creuse sous la touche et revient.
 */
export function TabBar({ value, onChange }: TabBarProps) {
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
    <View style={styles.bar}>
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
   * La gélule : blanche, cernée d'un filet, et franchement levée.
   *
   * L'ombre est plus dense que celle d'une carte posée sur une page, parce
   * qu'elle ne se pose justement sur rien — elle survole la planche aussi
   * bien qu'une liste, et sur la planche aucun filet ne tient contre un
   * trait de côte.
   */
  bar: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    shadowColor: "#2A1F12",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    /**
     * Un point entre le glyphe et son mot, et c'est ce qui paie le reste.
     *
     * Il y en avait trois. Les rendre au glyphe plutôt qu'au vide est le
     * seul moyen de le grossir sans toucher à la gélule — et l'écart ne
     * manque pas : le mot est en petites capitales sous une image, deux
     * choses qu'on ne confond pas même collées.
     */
    gap: 1,
    paddingHorizontal: space.xs,
  },
  /**
   * Trente points, et la gélule en fait toujours soixante-quatre.
   *
   * Le compte est serré et il tient : trente pour le glyphe, un d'écart,
   * treize pour le mot — quarante-quatre en tout, donc dix points de
   * respiration au-dessus et au-dessous. C'est ce qu'il faut pour que la
   * rangée ne vienne pas toucher les bords arrondis, et c'est à peu près la
   * limite : au-delà, il faudra monter la gélule avec.
   */
  glyph: { width: 30, height: 30 },
  label: {
    ...type.legend,
    /* Dite plutôt que laissée à la fonte : sans elle, l'interligne dépend du
       caractère et le compte de la gélule cesse d'être vérifiable. */
    lineHeight: 13,
    textTransform: "none",
    fontWeight: "600",
    color: palette.inkFaint,
  },
  /** L'encre de cire, et elle seule, dit l'onglet qu'on regarde. */
  labelOn: { color: palette.wax, fontWeight: "700" },
});
