import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Chip } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { FolderSheet, type FolderWeights } from "./FolderSheet";
import { space } from "../../../theme/tokens";

export type FolderSelectorProps = {
  /** Les noms déjà écrits dans la collection — voir `folderNames`. */
  known: string[];
  /** Ceux retenus ici. */
  value: string[];
  onChange: (names: string[]) => void;
  /**
   * Permet d'en nommer un qui n'existe pas encore.
   *
   * Le formulaire en a besoin — c'est le seul endroit où un classeur naît,
   * maintenant qu'il n'a plus de liste à lui. Le filtre, non : on n'y range
   * rien, on y choisit parmi ce qui est écrit.
   */
  allowNew?: boolean;
  /** Ce que dit la pastille d'ouverture avant qu'on ait rien choisi. */
  emptyLabel?: string;
};

/**
 * Les sujets sous lesquels un événement est rangé, par leur nom.
 *
 * Des pastilles et non plus des cartes : un classeur était une entité, avec une
 * photographie de couverture et une importance par couple (événement,
 * classeur) qui demandaient chacune leur place. Il n'est plus qu'un nom, et un
 * nom se montre comme un nom.
 *
 * Ici, seulement ceux de cet événement, plus une pastille pour ouvrir le choix.
 * La collection entière vivait dans cette rangée et c'était le mauvais endroit :
 * elle grandit sans fin, alors que ce qu'un événement porte tient en deux mots.
 *
 * **La feuille du choix est partie dans `FolderSheet`**, le jour où la
 * bibliothèque a demandé la même. Ce qui reste ici est la rangée, et ce qui
 * n'a de sens que pour une collection personnelle : le poids des classeurs,
 * qui se lit dans ce qu'on tient soi-même, et les mots qui disent « mes ».
 */
export function FolderSelector({
  known,
  value,
  onChange,
  allowNew = false,
  emptyLabel = "+ Ranger dans un classeur",
}: FolderSelectorProps) {
  const { events, characters } = useEvents();
  const [open, setOpen] = useState(false);

  /**
   * Ce que chaque classeur pèse, et quand on s'en est servi pour la dernière
   * fois.
   *
   * Les deux se lisent dans la collection et nulle part ailleurs : un
   * classeur n'a pas de ligne à lui, il n'est qu'un nom porté par ce qui s'y
   * range — c'est tout ce que `folders` gagne, et c'est ce qu'il coûte ici.
   *
   * Les dates sont comparées en nombres et non en chaînes. Les deux marchent
   * tant que la base rend le même format avec le même décalage horaire, ce
   * qu'elle fait ; `Date.parse` ne suppose rien de tout cela.
   */
  const weights = useMemo<FolderWeights>(() => {
    const uses = new Map<string, number>();
    const last = new Map<string, number>();
    const note = (names: string[], at: string) => {
      const when = Date.parse(at);
      for (const name of names) {
        uses.set(name, (uses.get(name) ?? 0) + 1);
        const seen = last.get(name);
        if (seen === undefined || when > seen) last.set(name, when);
      }
    };
    for (const one of events) note(one.folders, one.createdAt);
    for (const one of characters) note(one.folders, one.createdAt);
    return { uses, last };
  }, [events, characters]);

  const toggle = (name: string) => {
    onChange(
      value.includes(name)
        ? value.filter((one) => one !== name)
        : [...value, name],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {value.map((name) => (
          <Chip
            key={name}
            label={name}
            selected
            tone="wax"
            onPress={() => toggle(name)}
          />
        ))}
        {/* La porte garde le ton neutre : ce n'est pas un classeur. */}
        <Chip
          label={value.length === 0 ? emptyLabel : "+ Autre"}
          onPress={() => setOpen(true)}
        />
      </View>

      <FolderSheet
        visible={open}
        onClose={() => setOpen(false)}
        known={known}
        weights={weights}
        value={value}
        onChange={onChange}
        allowNew={allowNew}
        words={{
          title: "Mes classeurs",
          /* Deux phrases pour un même vide, et la différence est le droit
             d'en nommer un : on n'invite à écrire le premier que là où
             écrire est permis. */
          none: allowNew
            ? "Aucun classeur encore. Nommez le premier : un sujet, pas un fait — Mérovingiens, croisades, Renaissance…"
            : "Aucun classeur. Un événement en reçoit un quand vous l'écrivez.",
          missing: "Rien de tel parmi vos classeurs.",
          used: {
            label: "Les plus utilisés",
            said: "utilisés",
            why: "Ceux qui rangent le plus d'événements et de personnages.",
          },
          recent: { why: "Ceux dont vous vous êtes servi en dernier." },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
