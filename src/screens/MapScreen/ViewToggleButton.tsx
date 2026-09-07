import { Image, StyleSheet } from "react-native";

import { GlyphButton } from "../../components/ui";

const ICONS = {
  map: require("../../../assets/icons/view-map.png"),
  list: require("../../../assets/icons/view-list.png"),
} as const;

export type ScreenView = "map" | "list";

/** Shows the view you would switch *to*, not the one you are in. */
export function ViewToggleButton({
  view,
  onChange,
}: {
  view: ScreenView;
  onChange: (view: ScreenView) => void;
}) {
  const target: ScreenView = view === "map" ? "list" : "map";

  return (
    <GlyphButton
      accessibilityLabel={
        target === "list" ? "Voir la liste" : "Voir la carte"
      }
      onPress={() => onChange(target)}
    >
      <Image source={ICONS[target]} style={styles.glyph} resizeMode="contain" />
    </GlyphButton>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },
});
