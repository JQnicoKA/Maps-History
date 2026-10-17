import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "../theme/palette";
import { space } from "../theme/tokens";

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

/**
 * La hauteur dessinée de la barre, sans la zone sûre de l'appareil.
 *
 * Exportée parce que la barre est posée **par-dessus** les pages et non à
 * côté d'elles : aucune page ne la connaît par sa mise en page, et sans cette
 * mesure la dernière rangée d'une liste se glisserait dessous.
 */
export const TAB_BAR_HEIGHT = 56;

export type TabBarProps = {
  value: TabKey;
  onChange: (key: TabKey) => void;
};

/**
 * La barre de navigation du bas.
 *
 * **En cire pour l'onglet retenu**, et c'est le métier que cette application
 * donne à la cire depuis toujours : « voici ce que vous avez sous les yeux ».
 * Le marqueur de l'événement qu'on lit la porte, l'aiguille de la frise
 * aussi ; un onglet actif dit la même chose.
 *
 * Elle est opaque et bordée d'un filet. Translucide, elle aurait laissé
 * passer la carte, qui est une planche chargée : les quatre mots y seraient
 * devenus illisibles au-dessus d'un trait de côte.
 */
export function TabBar({ value, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => {
        const here = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: here }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Image
              source={tab.icon}
              style={[
                styles.glyph,
                { tintColor: here ? palette.wax : palette.inkFaint },
              ]}
              resizeMode="contain"
            />
            <Text
              style={[styles.label, here && styles.labelOn]}
              numberOfLines={1}
              /* « Personnages » est le mot long ; sur un petit écran il se
                 rétrécit plutôt que de devenir « Personn… ». */
              adjustsFontSizeToFit
              minimumFontScale={0.85}
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
  bar: {
    flexDirection: "row",
    backgroundColor: palette.paperLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.paperDeep,
  },
  tab: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: space.xs,
  },
  pressed: { opacity: 0.6 },
  glyph: { width: 22, height: 22 },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
    fontWeight: "600",
    color: palette.inkFaint,
  },
  labelOn: { color: palette.wax, fontWeight: "700" },
});
