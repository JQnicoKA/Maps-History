import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Dialog, GlyphButton, Lens, THUMB } from "../../../components/ui";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

const EVENT = require("../../../../assets/icons/book.png");
const PEOPLE = require("../../../../assets/icons/people.png");

/** Les deux genres de note qu'on ajoute à sa collection. */
export type Note = "event" | "character";

/** Ce que chaque genre s'appelle, là où la phrase a besoin de le nommer. */
const NOTES: Record<
  Note,
  { label: string; icon: number; une: string; un: string }
> = {
  event: {
    label: "Événement",
    icon: EVENT,
    une: "cet événement",
    un: "un événement",
  },
  character: {
    label: "Personnage",
    icon: PEOPLE,
    une: "ce personnage",
    un: "un personnage",
  },
};

/**
 * Le plus, dessiné plutôt que chargé.
 *
 * Deux barres croisées *sont* un plus, elles ne coûtent rien, et elles sont de
 * la couleur qu'on leur dit à n'importe quelle taille — là où un PNG exporté
 * en brun refuse de se teinter. Le même raisonnement que l'entonnoir de
 * `FilterButton`.
 */
function Plus() {
  return (
    <View style={styles.plus}>
      <View style={[styles.bar, styles.barAcross]} />
      <View style={[styles.bar, styles.barDown]} />
    </View>
  );
}

export type NewNoteButtonProps = {
  /** Écrire la note soi-même : le formulaire vide du genre choisi. */
  onCreate: (what: Note) => void;
  /** Aller la chercher : le catalogue de la bibliothèque, du genre choisi. */
  onSeek: (what: Note) => void;
};

/**
 * Ajouter à sa collection, demandé en deux questions.
 *
 * Un seul bouton, et c'est un retour en arrière assumé : il y en avait eu un
 * par genre, pour éviter qu'un `+` n'ouvre une feuille à quatre onglets où il
 * fallait trouver le bon. Le défaut n'était pas le bouton unique, c'étaient
 * les onglets — une rangée de mots qui demande de choisir sans rien dire de ce
 * qu'on choisit. Posées comme deux questions, les mêmes quatre destinations se
 * lisent : *quoi*, puis *de qui* — de vous, ou de la bibliothèque.
 *
 * Et la seconde question était déjà là, à l'intérieur du formulaire
 * d'événement : « Comment voulez-vous l'ajouter ? ». Elle y arrivait trop
 * tard, après avoir ouvert une feuille pleine hauteur pour s'entendre demander
 * si on voulait bien la remplir. Elle remonte ici, où elle précède tout, et le
 * formulaire n'a plus qu'un seul métier.
 *
 * Les deux faces vivent dans une carte et non dans une feuille : c'est une
 * fourche, deux ou trois chemins et un seul geste, et c'est exactement ce que
 * `Dialog` décrit. La feuille, elle, est pour remplir.
 */
export function NewNoteButton({ onCreate, onSeek }: NewNoteButtonProps) {
  const [open, setOpen] = useState(false);
  /** Le genre choisi, ou `null` sur la première face. */
  const [what, setWhat] = useState<Note | null>(null);
  /**
   * Ce qu'il faudra lever une fois cette carte partie.
   *
   * iOS refuse de présenter depuis une modale qui se retire encore, et les
   * quatre destinations sont toutes des modales. On baisse, on attend
   * `onClosed`, puis on lève — la même danse que `DrawTerritoryButton`, que
   * `Dialog` sait enfin danser.
   */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  const after = (deed: () => void) => {
    setLeaving(() => deed);
    setOpen(false);
  };

  /**
   * Fermer, et rien de plus.
   *
   * La remise à la première face attend `onClosed` : écrite ici, elle
   * changerait la carte sous les yeux du lecteur pendant qu'elle s'en va — on
   * verrait les deux carrés revenir à la place des deux voies, le temps du
   * fondu.
   */
  const shut = () => setOpen(false);

  const note = what === null ? null : NOTES[what];

  return (
    <>
      <GlyphButton accessibilityLabel="Nouvelle note" onPress={() => setOpen(true)}>
        <Plus />
      </GlyphButton>

      <Dialog
        visible={open}
        onClose={shut}
        onClosed={() => {
          // La carte est partie : elle peut reprendre sa première face sans
          // que personne la voie changer. Voir `shut`.
          setWhat(null);
          if (!leaving) return;
          const deed = leaving;
          setLeaving(null);
          deed();
        }}
        title="Nouvelle note"
        hint={
          note === null
            ? "Quel type de note voulez-vous ajouter ?"
            : `Vous ajoutez ${note.un}.`
        }
        /* Rien à quitter sur la première face — la croix suffit. Sur la
           seconde, « Retour » revient à la première et non hors de l'écran :
           le lecteur a peut-être voulu l'autre genre. C'est à cela que sert
           `onDismiss`. */
        dismissLabel={note === null ? null : "Retour"}
        onDismiss={() => setWhat(null)}
      >
        {/* Branché sur `what` et non sur `note` : c'est lui que le compilateur
            resserre, et sans cela les deux voies finiraient par un `!`. */}
        {what === null ? (
          <View style={styles.pair}>
            {(["event", "character"] as const).map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={NOTES[kind].label}
                onPress={() => setWhat(kind)}
                style={({ pressed }) => [
                  styles.square,
                  pressed && styles.down,
                ]}
              >
                <Image
                  source={NOTES[kind].icon}
                  style={styles.squareGlyph}
                  resizeMode="contain"
                />
                <Text style={styles.squareLabel}>{NOTES[kind].label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.ways}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Création"
              onPress={() => after(() => onCreate(what))}
              style={({ pressed }) => [styles.way, pressed && styles.down]}
            >
              <View style={styles.quill}>
                <Text style={styles.quillGlyph}>✎</Text>
              </View>
              <View style={styles.wayText}>
                <Text style={styles.wayTitle}>Création</Text>
                <Text style={styles.wayDetail}>
                  Vous souhaitez créer {NOTES[what].une} vous-même.
                </Text>
              </View>
              <Text style={styles.wayMore}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Recherche"
              onPress={() => after(() => onSeek(what))}
              style={({ pressed }) => [
                styles.way,
                styles.waySeek,
                pressed && styles.down,
              ]}
            >
              {/* La même loupe que les listes portent, et non une copie. */}
              <Lens />
              <View style={styles.wayText}>
                <Text style={[styles.wayTitle, styles.waxed]}>Recherche</Text>
                <Text style={styles.wayDetail}>
                  Vous souhaitez rechercher {NOTES[what].un} dans la bibliothèque.
                </Text>
              </View>
              <Text style={[styles.wayMore, styles.waxed]}>›</Text>
            </Pressable>
          </View>
        )}
      </Dialog>
    </>
  );
}

const BAR = 2.5;
const PLUS = 19;

const styles = StyleSheet.create({
  plus: { width: PLUS, height: PLUS, alignItems: "center", justifyContent: "center" },
  bar: {
    position: "absolute",
    borderRadius: radius.pill,
    backgroundColor: palette.ink,
  },
  barAcross: { width: PLUS, height: BAR },
  barDown: { width: BAR, height: PLUS },

  /**
   * Les deux genres, carrés et côte à côte.
   *
   * Un logo et son titre dessous, parce que la question est « lequel des
   * deux » : deux rangées de texte auraient demandé de lire pour choisir, là
   * où deux images se distinguent d'un coup d'œil. `flex: 1` est à sa place
   * ici — c'est une rangée.
   */
  pair: { flexDirection: "row", gap: space.md },
  square: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  squareGlyph: { width: 38, height: 38 },
  squareLabel: { fontSize: 15, fontWeight: "700", color: palette.ink },
  down: { opacity: 0.6 },

  ways: { gap: space.md },
  /**
   * Les deux voies, aux mesures exactes du `Roster` — reprises du formulaire
   * d'événement, où cette fourche vivait avant de remonter ici. Elles s'en
   * écartaient sans raison, et la fourche paraissait d'une autre famille que
   * les listes alors qu'elle pose la même question : faire le sien, ou prendre
   * ce qui existe.
   */
  way: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: palette.paperDeep,
  },
  /** Pleine et en cire : une porte, et non un emplacement à remplir. */
  waySeek: { borderStyle: "solid", borderColor: palette.wax },
  quill: {
    width: THUMB,
    height: THUMB,
    alignItems: "center",
    justifyContent: "center",
  },
  quillGlyph: { fontSize: 22, color: palette.inkSoft },
  wayText: { flex: 1, gap: 2 },
  wayTitle: { fontSize: 15, fontWeight: "700", color: palette.ink },
  wayDetail: { ...type.legend, color: palette.inkSoft },
  wayMore: { fontSize: 18, lineHeight: 20, color: palette.inkFaint },
  waxed: { color: palette.wax },
});
