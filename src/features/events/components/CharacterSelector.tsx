import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { CharacterManager } from "./CharacterManager";
import { InkButton, Sheet } from "../../../components/ui";
import { lifespan } from "../lifespan";
import type { Character } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

export type CharacterSelectorProps = {
  characters: Character[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Part écrire quelqu'un de neuf — voir `EventFormModal`. */
  onNewPerson: () => void;
  /** Part chercher quelqu'un dans la bibliothèque. */
  onSeekPerson: () => void;
  /**
   * Rouvre la liste : au retour d'un des deux détours, on retrouve la
   * fenêtre qu'on avait quittée, comme dans un arbre. Remis à faux par
   * `onReopened` aussitôt honoré, pour qu'un remontage ne la rouvre pas.
   */
  reopen: boolean;
  onReopened: () => void;
};

/**
 * Who an event was about.
 *
 * A card each, then a dashed slot — the same shape the classeurs wore when
 * they were entities, because a reader should not have to learn two ways of
 * attaching things to an event. Les classeurs sont descendus à la pastille
 * depuis : un nom n'a pas besoin d'une carte, une personne en a une.
 *
 * La fenêtre qui s'ouvre, elle, est **la liste des personnages elle-même** —
 * `CharacterManager` en mode choix. Elle montrait avant une suite de lignes
 * « Nom · dates » bâtie ici à la main, et c'était une ressemblance entretenue
 * de loin : le visage manquait, le nombre d'événements manquait, et « à placer
 * sur la carte » — qui explique pourquoi quelqu'un n'apparaît nulle part — ne
 * se lisait que dans l'autre liste. Une seule liste, deux métiers.
 */
export function CharacterSelector({
  characters,
  value,
  onChange,
  onNewPerson,
  onSeekPerson,
  reopen,
  onReopened,
}: CharacterSelectorProps) {
  const [open, setOpen] = useState(false);
  /**
   * La porte prise dans la liste, franchie une fois la liste descendue.
   *
   * Descendre d'abord, partir ensuite : iOS refuse de présenter une page
   * depuis une feuille qui s'en va encore. `onClosed` attend qu'elle soit
   * vraiment partie — c'est ce que fait l'arbre.
   */
  const [door, setDoor] = useState<"new" | "seek" | null>(null);

  useEffect(() => {
    if (!reopen) return;
    setOpen(true);
    onReopened();
  }, [reopen, onReopened]);

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lier un personnage"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <Text style={styles.addGlyph}>+</Text>
        <Text style={styles.addLabel}>
          {value.length === 0 ? "Lier un personnage" : "Lier quelqu'un d'autre"}
        </Text>
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        onClosed={() => {
          if (door === null) return;
          const taken = door;
          setDoor(null);
          if (taken === "new") onNewPerson();
          else onSeekPerson();
        }}
        title="Lier un personnage"
        // La liste grandit avec la collection ; un panneau qui se
        // redimensionnerait autour d'elle ne tiendrait jamais en place.
        tall
        footer={
          <InkButton
            label="Fermer"
            variant="solid"
            grow
            onPress={() => setOpen(false)}
          />
        }
      >
        {/* Les deux mêmes portes que dans un arbre : « Nouveau
            personnage » et la bibliothèque. Elles furent longtemps
            absentes, de peur qu'elles fassent quitter un événement à moitié
            écrit ; le formulaire se met désormais de côté le temps du
            détour et revient tel qu'on l'a laissé, cette liste rouverte.
            Pas de crayon sur les rangées : on ne corrige pas quelqu'un au
            moment de le choisir.

            Et elle reste ouverte après un choix, pour qu'on en lie
            plusieurs d'affilée : le nom qu'on vient de prendre passe en
            gris, « déjà lié », ce qui est la seule confirmation nécessaire. */}
        <CharacterManager
          onPick={(person) => toggle(person.id)}
          unavailable={(person) =>
            value.includes(person.id) ? "déjà lié" : null
          }
          onEdit={() => {
            setDoor("new");
            setOpen(false);
          }}
          onSeek={() => {
            setDoor("seek");
            setOpen(false);
          }}
        />
      </Sheet>
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
    backgroundColor: palette.surfaceRaised,
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
