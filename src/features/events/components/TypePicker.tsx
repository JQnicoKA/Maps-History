import { Pressable, StyleSheet, Text, View } from "react-native";

import { EVENT_TYPES, describeType, type EventType } from "../types";
import { palette } from "../../../theme/palette";
import { radius, space } from "../../../theme/tokens";

export type TypePickerProps = {
  value: EventType;
  onChange: (value: EventType) => void;
};

/**
 * Les seize thèmes, en grille, chacun sous son nom.
 *
 * Trois formes successives, et chacune corrigeait la précédente. D'abord un
 * champ qui ouvrait une feuille : deux gestes et une modale pour dire
 * « bataille ». Puis un rail d'emoji qu'on faisait défiler du pouce : un seul
 * geste, mais seize images sans légende dont la moitié hors de l'écran — et il
 * fallait reconnaître 🗺️ pour « Indépendance / Fondation d'État ».
 *
 * La grille règle les deux : **tout se voit d'un coup**, et chaque case porte
 * son nom. Un emoji n'a plus à soutenir le sens tout seul, ce que l'ancien
 * rail compensait en écrivant le thème choisi à côté du titre de la page —
 * compensation devenue inutile.
 *
 * Quatre colonnes, parce que c'est ce que seize divise exactement : quatre
 * rangées pleines, aucune case orpheline en bas.
 */
export function TypePicker({ value, onChange }: TypePickerProps) {
  return (
    <View style={styles.grid}>
      {EVENT_TYPES.map((entry) => {
        const selected = entry.value === value;
        return (
          <Pressable
            key={entry.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={entry.label}
            onPress={() => onChange(entry.value)}
            style={({ pressed }) => [
              styles.slot,
              pressed && !selected && styles.pressed,
            ]}
          >
            {/* Le bloc est à l'intérieur de la case et non la case elle-même :
                l'écart entre deux tuiles est pris sur le rembourrage de la
                case, donc le doigt porte jusque dans la gouttière tandis que
                la tuile, elle, s'arrête avant. */}
            <View style={[styles.block, selected && styles.blockOn]}>
              <Text style={styles.emoji}>{entry.emoji}</Text>
              {/* Deux lignes au plus, et coupé plutôt que rétréci : les noms
                  vont de « Loi / Réforme » à « Indépendance / Fondation
                  d'État », et seize cases qui se mettraient à la taille de la
                  plus longue seraient seize cases minuscules. */}
              <Text
                style={[styles.label, selected && styles.labelOn]}
                numberOfLines={2}
              >
                {entry.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The chosen type's name, for the caller to set beside its heading. */
export function typeName(value: EventType): string {
  return describeType(value).label;
}

const styles = StyleSheet.create({
  /**
   * Quatre par rangée, par le pourcentage et non par une mesure en points :
   * la grille suit la largeur du panneau, qui n'est pas la même sur un
   * téléphone et sur une tablette. L'écart est pris sur la case elle-même —
   * `gap` et `flexWrap` se querellent sur les bornes d'arrondi, et une case
   * sur quatre passait à la ligne toute seule.
   */
  grid: { flexDirection: "row", flexWrap: "wrap" },
  /**
   * La case : la part de grille et la gouttière, sans rien de visible.
   *
   * Le rembourrage est pris sur l'échelle et non à la main — `xs` de chaque
   * côté fait une gouttière de 8 points entre deux tuiles, soit `sm`, qui est
   * l'écart des pastilles et des rangées ailleurs.
   */
  slot: { width: "25%", aspectRatio: 0.92, padding: space.xs },
  /**
   * La tuile, elle, se voit.
   *
   * Un fond `sunken` sur le papier clair du panneau : c'est l'idiome de bloc
   * de cette application — les pastilles, les rangées de classeur, le champ
   * d'un nouveau classeur le portent déjà. Seize cases transparentes ne
   * disaient pas qu'on pouvait les toucher ; la grille paraissait une planche
   * d'emoji plutôt qu'un choix.
   *
   * Le liseré ne change que de couleur, jamais d'épaisseur : à 1,5 point dans
   * les deux états, rien ne se déplace quand on choisit. Un bord qui passe de
   * zéro à deux fait sauter la tuile de deux points, et seize tuiles qui
   * sautent à chaque choix se remarquent.
   */
  block: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  /** Choisi : le papier clair et le liseré de cire, comme partout ailleurs. */
  blockOn: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.wax,
  },
  pressed: { opacity: 0.6 },
  emoji: { fontSize: 26 },
  /**
   * Écrit plutôt qu'emprunté à `type.legend`, dont il aurait fallu annuler la
   * capitale — et une légende sans capitales n'est plus une légende. Les
   * mesures sont les siennes ; seule l'interligne est ajoutée, pour que les
   * noms qui prennent deux lignes ne se touchent pas.
   */
  label: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.1,
    textAlign: "center",
    color: palette.inkFaint,
  },
  /**
   * Choisi, le nom change d'encre et **pas de graisse**.
   *
   * Il passait en gras, et le gras remet le texte en page : « Construction »
   * fait douze caractères, il tient de justesse dans une tuile en romain, et
   * une fois gras il dépasse de quelques points. Un seul mot ne peut pas se
   * couper entre deux mots — il se coupait donc en son milieu, et le « n »
   * tombait à la ligne suivante, au moment précis où l'on venait de le
   * choisir.
   *
   * C'est la même règle que le liseré juste au-dessus : **un choix ne déplace
   * rien.** Trois signaux disent déjà qu'une tuile est prise — le papier, la
   * cire, l'encre pleine — et aucun des trois ne touche à la mise en page.
   */
  labelOn: { color: palette.ink },
});
