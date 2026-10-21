import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

const GRAIN = require("../../../assets/textures/paper-grain.png");

/**
 * The travel-journal furniture: tilted cards, drawn rules, paper.
 *
 * A notebook someone fills by hand is the honest metaphor for this app — you
 * do not *consult* HistoryNote, you paste things into it — and the furniture
 * that goes with it is furniture anyone recognises: a photograph stuck on
 * slightly crooked, a line drawn under a heading, a dashed outline where the
 * next one will go.
 *
 * Il y eut un temps une inclinaison — un demi-degré en alternance, pour que
 * les cartes aient l'air posées par une main. Elle est partie le 4 octobre
 * 2026 : lue par qui n'en connaissait pas l'intention, elle ne disait pas
 * « posé à la main », elle disait « mal aligné ». Le grain, les règles tracées
 * et les contours pointillés portent la métaphore sans faire douter personne
 * de l'aplomb de la page.
 */

/**
 * Paper fibre, behind a panel. The same the map wears, at a whisper.
 *
 * **Sa taille est dite en pour cent, et c'était tout le défaut.** Avec les
 * seuls quatre bords de `absoluteFill`, l'image gardait sa taille native —
 * 256 points — et `repeat` n'avait rien à paver au-delà de son propre cadre :
 * un unique carré de grain en haut à gauche, un quart de panneau environ, un
 * peu plus sombre que le reste. Invisible tant que le panneau était nu ; la
 * pose d'un fond lui a donné une référence et la couture s'est vue.
 *
 * Le même piège que les fonds des deux carrés de l'ancienne « Nouvelle note »,
 * rencontré trois
 * fois en un jour : une image en absolu sans dimensions explicites n'est pas
 * dimensionnée par ses bords.
 */
export function Grain({ opacity = 0.22 }: { opacity?: number }) {
  // Wrapped, because an Image takes no `pointerEvents` of its own and this
  // must never intercept a touch meant for what it sits behind.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={GRAIN}
        style={[StyleSheet.absoluteFill, styles.grain, { opacity }]}
        resizeMode="repeat"
      />
    </View>
  );
}

export type JournalTitleProps = {
  title: string;
  hint?: string;
  /**
   * Un glyphe devant le mot, quand le panneau en mérite un.
   *
   * Dessiné dans `assets/icons/src` et rasterisé par `npm run icons` — pas
   * emprunté à une fonte d'icônes. Un jeu tiers arrive avec sa propre
   * graisse et ses propres angles, ce qui se voit immédiatement au milieu
   * d'un atlas colorié à la main ; c'est la leçon que la loupe et
   * l'entonnoir de cette application ont déjà apprise.
   */
  icon?: ImageSourcePropType;
};

/** A page's heading: the name, and a line drawn under it. */
export function JournalTitle({ title, hint, icon }: JournalTitleProps) {
  return (
    <View style={styles.heading}>
      {icon === undefined ? (
        <Text style={styles.title}>{title}</Text>
      ) : (
        /* Le glyphe et le mot sur une rangée, pour que le groupe entier se
           centre — et non le mot seul avec un dessin posé à sa gauche. */
        <View style={styles.titleRow}>
          <Image
            source={icon}
            style={styles.titleIcon}
            resizeMode="contain"
            /* Décoratif : le mot qu'il précède dit la même chose, et un
               lecteur d'écran qui annoncerait les deux la dirait deux fois. */
            accessible={false}
          />
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      <View style={styles.underline} />
      {hint === undefined || hint === "" ? null : (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Ce qui donne au grain le cadre entier à paver — voir `Grain`. */
  grain: { width: "100%", height: "100%" },
  heading: { alignItems: "center", paddingTop: space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  /**
   * Vingt-deux points, contre vingt sur les cartes.
   *
   * Le titre d'une feuille est écrit à vingt-cinq, celui d'une carte à
   * vingt-deux : un glyphe de taille fixe aurait paru chétif ici et lourd
   * là. Il est donc accordé au mot qu'il précède, et non à lui-même.
   */
  titleIcon: { width: 22, height: 22, tintColor: palette.ink },
  title: {
    ...type.plate,
    color: palette.ink,
    textAlign: "center",
  },
  /**
   * Drawn under the words rather than across the panel, and a touch wider
   * than the text: a line someone put there, not a border.
   */
  underline: {
    height: 3,
    borderRadius: radius.pill,
    alignSelf: "center",
    backgroundColor: palette.border,
    marginTop: 4,
    paddingHorizontal: space.xl,
    minWidth: 64,
    width: "42%",
  },
  hint: {
    ...type.caption,
    color: palette.inkSoft,
    textAlign: "center",
    marginTop: space.sm,
    paddingHorizontal: space.xl,
  },
});
