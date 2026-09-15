import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { SelectField } from "../../../components/ui";
import { lifespan } from "../lifespan";
import type { Character } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

export type CharacterSelectorProps = {
  characters: Character[];
  value: string[];
  onChange: (ids: string[]) => void;
};

/**
 * Who an event was about.
 *
 * Built like the folder picker — a card each, then a dashed slot — because a
 * reader should not have to learn two ways of attaching things to an event.
 * Simpler than folders, though: a person is either in the room or not, whereas
 * a folder also carries how much the event matters to it.
 */
export function CharacterSelector({
  characters,
  value,
  onChange,
}: CharacterSelectorProps) {
  const toggle = (id: string) =>
    onChange(
      value.includes(id)
        ? value.filter((one) => one !== id)
        : [...value, id],
    );

  return (
    <View style={styles.container}>
      {value.map((id) => {
        const person = characters.find((one) => one.id === id);
        const face = person?.photos[0];
        const dates = person ? lifespan(person) : "";
        return (
          <View key={id} style={styles.card}>
            <View style={styles.face}>
              {face ? (
                <Image source={{ uri: face.url }} style={styles.image} />
              ) : (
                <Text style={styles.initial}>
                  {person?.name.charAt(0).toUpperCase() ?? "?"}
                </Text>
              )}
            </View>

            <View style={styles.cardText}>
              <Text style={styles.name} numberOfLines={1}>
                {person?.name ?? "Personnage"}
              </Text>
              {dates === "" ? null : (
                <Text style={styles.dates} numberOfLines={1}>
                  {dates}
                </Text>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${person?.name ?? "ce personnage"}`}
              hitSlop={8}
              onPress={() => toggle(id)}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
            >
              <Text style={styles.removeGlyph}>×</Text>
            </Pressable>
          </View>
        );
      })}

      <SelectField
        title="Personnages"
        placeholder="Choisir un personnage…"
        options={characters.map((person) => {
          const dates = lifespan(person);
          return {
            value: person.id,
            label: dates === "" ? person.name : `${person.name} · ${dates}`,
          };
        })}
        selected={value}
        onToggle={toggle}
        emptyMessage="Aucun personnage. Créez-en un dans « Nouveau personnage »."
        trigger={(open) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lier un personnage"
            onPress={open}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            <Text style={styles.addGlyph}>+</Text>
            <Text style={styles.addLabel}>
              {value.length === 0 ? "Lier un personnage" : "Lier quelqu'un d'autre"}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const FACE = 40;

const styles = StyleSheet.create({
  container: { gap: space.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 16, fontWeight: "700", color: palette.inkFaint },
  cardText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "600", color: palette.ink },
  dates: { ...type.caption, color: palette.inkFaint },
  remove: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  removeGlyph: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },
  pressed: { opacity: 0.55 },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  addGlyph: { fontSize: 18, lineHeight: 20, color: palette.inkSoft },
  addLabel: { ...type.body, color: palette.inkSoft, fontWeight: "500" },
});
