import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/**
 * Le voile posé entre l'image et les mots.
 *
 * **Mesuré, pas choisi.** Les trois fonds sont des scènes brunes chargées :
 * sur leurs pixels les plus clairs — le parchemin, le sablier, la plume — le
 * blanc ne pèse que 1,95 à 2,27 contre 1, et l'encre brune de l'application
 * n'y arrive qu'à 1,2 sur les plus sombres. Les deux sont illisibles, et
 * aucune couleur de texte ne sauve une image qui va du beige clair au brun
 * noir sous les mêmes trois mots.
 *
 * Un voile de reliure à 0,45 ramène le blanc à 4,3–4,7 sur ces mêmes pixels,
 * ce qui se lit. Au-delà on gagne peu et on éteint le dessin, qui est ce
 * qu'on est venu montrer ; en deçà, le pire cas repasse sous quatre.
 */
const VEIL = 0.45;

/**
 * Le filet du bouton, écrit une fois parce que l'image le soustrait.
 *
 * `onLayout` rend la largeur **bordure comprise**, tandis qu'un enfant posé à
 * `left: 0` part du bord *intérieur*. Donner à l'image la largeur mesurée la
 * décalerait donc d'un filet et la ferait rogner d'autant de l'autre côté —
 * trois points de dessin perdus, sur une image qu'on a justement demandé de
 * voir en entier.
 */
const BORDER = 1.5;

/** La pastille de choix, et son contrepoids à gauche. */
const BEAD = 18;

export type AimButtonProps = {
  label: string;
  /** Une ligne qui dit ce qu'on va réviser, et combien il y en a. */
  detail?: string;
  chosen: boolean;
  /**
   * Grisé parce qu'il ne se cumule pas avec ce qui est déjà choisi.
   *
   * Il reste lisible et il reste pressable : presser un but exclusif range
   * les autres au lieu de ne rien faire. Un bouton qui ne répond pas se lit
   * comme un bouton cassé.
   */
  dimmed?: boolean;
  /**
   * L'image de fond, pour les trois buts d'une étude.
   *
   * Absente pour les quatre parties du monde, qui se présentent sur le papier
   * de la carte : le bouton change alors d'encre tout seul — voir `onImage`.
   */
  background?: ImageSourcePropType;
  onPress: () => void;
};

/**
 * Un des trois buts d'une étude, en pleine largeur.
 *
 * Empilés plutôt que rangés côte à côte : ce sont trois matières à réviser et
 * non trois réglages d'une même chose, et en colonne chacune a la place de
 * dire ce qu'elle contient.
 *
 * Le choix se marque par le bord et par la pastille — deux points de cire —
 * et non par une case à cocher. Une case dirait « plusieurs possibles », ce
 * qui n'est vrai que de deux des trois.
 */
export function AimButton({
  label,
  detail,
  chosen,
  dimmed = false,
  background,
  onPress,
}: AimButtonProps) {
  /**
   * La largeur du bouton, mesurée et non devinée.
   *
   * `Image` exige ses deux dimensions en points — la leçon des bannières, qui
   * a coûté trois essais : le style du programme ne bat les dimensions
   * intrinsèques de l'asset que sur ce qu'il **nomme**, et une largeur laissée
   * de côté garde les deux mille pixels du fichier comptés en points. Mais ce
   * bouton ne connaît pas la sienne : elle dépend du rembourrage de la carte
   * qui le porte. Il la demande donc à la mise en page.
   */
  const [width, setWidth] = useState(0);

  const shape = background ? Image.resolveAssetSource(background) : null;
  const ratio =
    shape && shape.height > 0 ? shape.width / shape.height : undefined;
  /** Ce que l'image mesure une fois réduite à la largeur du bouton. */
  const across = width > 0 ? width - 2 * BORDER : 0;
  const natural = ratio && across > 0 ? across / ratio : undefined;

  const onImage = background !== undefined;
  /**
   * Un mot seul se pose au milieu.
   *
   * Une ligne de titre suivie d'une ligne de détail fait un bloc, et un bloc
   * s'aligne à gauche pour que ses deux lignes commencent au même endroit.
   * Un mot seul n'a pas de second départ à tenir : au milieu, il est au
   * milieu de son image.
   */
  const middle = detail === undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={detail === undefined ? label : `${label} — ${detail}`}
      onPress={onPress}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.button,
        onImage ? styles.onImageButton : null,
        chosen ? styles.chosen : null,
        dimmed && !chosen ? styles.dimmed : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {background === undefined || natural === undefined ? null : (
        <>
          {/* Toute la largeur, et c'est le haut qu'on coupe.
              La largeur est celle du bouton, la hauteur celle que l'image
              prend à cette largeur : elle n'est ni rognée sur les côtés ni
              écrasée, seulement plus haute que le bouton. `bottom: 0` décide
              alors quel bord déborde — le haut — et donc quel bord survit.
              C'est exactement la règle des bannières. */}
          <Image
            source={background}
            style={[styles.backdrop, { width: across, height: natural }]}
            accessible={false}
          />
          <View style={styles.veil} pointerEvents="none" />
        </>
      )}

      {/* Le contrepoids de la pastille.
          Sans lui, « Événements » se centrerait dans la place que la pastille
          lui laisse, c'est-à-dire treize points trop à gauche — assez pour
          que trois boutons empilés paraissent de travers. */}
      {middle ? <View style={styles.counterweight} /> : null}

      <View style={[styles.words, middle ? styles.wordsMiddle : null]}>
        <Text style={[styles.label, onImage ? styles.labelOnImage : null]}>
          {label}
        </Text>
        {detail === undefined ? null : (
          <Text style={[styles.detail, onImage ? styles.detailOnImage : null]}>
            {detail}
          </Text>
        )}
      </View>
      {/* La pastille de choix, à droite : un disque plein quand c'est pris,
          un anneau vide sinon. Elle suit le bord plutôt que de le doubler —
          sur trois lignes de même hauteur, l'œil cherche une marque à une
          place fixe. */}
      <View
        style={[
          styles.bead,
          onImage ? styles.beadOnImage : null,
          chosen ? styles.beadOn : null,
          chosen && onImage ? styles.beadOnChosenImage : null,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 62,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceRaised,
    borderWidth: BORDER,
    borderColor: palette.line,
    // Découpe l'image aux coins arrondis : elle n'a pas à connaître leur rayon.
    overflow: "hidden",
    ...shadow.soft,
  },
  /**
   * Plus haut, et bordé de brun plutôt que de filet.
   *
   * Une image de cent points réduite à soixante-deux n'en montre plus que le
   * tiers bas ; soixante-seize en laissent voir assez pour qu'on reconnaisse
   * une scène. Et le filet pâle du papier, posé sur un brun dense, se lisait
   * comme une éraflure : le bord prend la couleur du fond de l'image.
   */
  onImageButton: {
    minHeight: 76,
    /**
     * Un filet clair au repos, et c'est une mesure qui l'impose.
     *
     * Le bord choisi passe en encre — `#4A3927` — et l'encre ne pèse que
     * 1,37 contre 1 sur le brun voilé de ces images : contre un filet de
     * reliure, qui en est le voisin immédiat, le choix aurait été invisible.
     * La sélection se lit donc par le **clair qui s'en va** : un filet pâle
     * au repos, une encre franche quand c'est pris.
     */
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: palette.binding,
  },
  /**
   * C'est pris, et dans l'encre du bouton « Suivant ».
   *
   * Le même brun que ce qu'on va presser ensuite, plutôt que la cire : ce
   * qu'on choisit et ce qui emmène plus loin sont d'une seule couleur, et la
   * cire reste à ce qu'elle dit partout ailleurs — « voici ce que vous
   * lisez ».
   */
  chosen: {
    borderColor: palette.ink,
    backgroundColor: palette.paperDeep,
  },
  /**
   * Rangé, mais pas éteint.
   *
   * Les territoires ne se cumulent avec rien : quand ils sont choisis, les
   * deux autres pâlissent pour le dire. Ils restent pressables — presser
   * l'un d'eux range les territoires, ce qui est la façon la plus courte de
   * changer d'avis.
   */
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  /** Accrochée en bas à gauche, à une taille entièrement dictée. */
  backdrop: { position: "absolute", left: 0, bottom: 0 },
  veil: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.bindingDeep,
    opacity: VEIL,
  },
  words: { flex: 1, gap: 2 },
  wordsMiddle: { alignItems: "center" },
  /** Exactement la pastille, de l'autre côté — voir `BEAD`. */
  counterweight: { width: BEAD },
  label: { ...type.heading, fontWeight: "700", color: palette.ink },
  detail: { ...type.caption, color: palette.inkSoft },
  /**
   * Blanc sur le voile, avec une ombre portée.
   *
   * L'ombre n'est pas un effet : elle tient les deux ou trois pixels où le
   * dessin remonte au-dessus de ce que le voile pouvait rattraper — une
   * étincelle, le bord éclairé d'un parchemin. Un contraste se calcule sur
   * une couleur de fond ; une image n'en a pas une.
   */
  labelOnImage: {
    /**
     * D'un cran plus grand, et seulement ici.
     *
     * Les trois buts sont le premier pas de l'étude : ils annoncent la
     * matière, chacun sur sa scène, et un mot de dix-sept points posé sur une
     * image de soixante-seize se perd dedans. Les étapes suivantes — les
     * parties du monde — sont une liste de choix et non une annonce : elles
     * gardent la taille des listes de l'application.
     */
    fontSize: type.title.fontSize,
    color: palette.surfaceRaised,
    textShadowColor: "rgba(26, 16, 8, 0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  detailOnImage: {
    color: "rgba(255, 255, 255, 0.88)",
    textShadowColor: "rgba(26, 16, 8, 0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bead: {
    width: BEAD,
    height: BEAD,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: palette.line,
    backgroundColor: palette.surfaceRaised,
  },
  /** Un anneau clair sur le brun, là où le filet du papier disparaîtrait. */
  beadOnImage: {
    borderColor: "rgba(255, 255, 255, 0.75)",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  beadOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  /**
   * La même encre, cerclée de clair.
   *
   * Une pastille d'encre pleine sur une image brune ne se distingue pas du
   * fond — 1,37 contre 1, mesuré. L'anneau pâle la détache ; c'est lui qu'on
   * voit, et le cœur sombre qui dit que c'est pris.
   */
  beadOnChosenImage: { borderColor: "rgba(255, 255, 255, 0.9)" },
});
