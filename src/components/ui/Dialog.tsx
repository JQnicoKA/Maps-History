import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { InkButton } from "./InkButton";
import { Grain } from "./Scrapbook";
import { palette } from "../../theme/palette";
import {
  BACKDROP,
  BACKDROP_SOFT,
  radius,
  shadow,
  space,
  type,
} from "../../theme/tokens";

export type DialogProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Fired once the card has finished leaving and the modal is gone.
   *
   * The same promise `Sheet` makes, and for the same reason: iOS will not
   * present a second modal from a controller that is still dismissing one, so
   * "close this card, then open that panel" has to wait for this rather than
   * guess at a delay. That is why the fade is driven here instead of by the
   * modal's own `animationType` — a modal that fades itself out never says
   * when it has finished.
   */
  onClosed?: () => void;
  /**
   * The heading, when the card needs one.
   *
   * Absent for a card that is **entirely its own answer** — a field and the
   * things it sifts, where a title would only name what the reader is already
   * looking at. The cross keeps its corner, on a line of its own: tapping
   * beside the card also closes it, but that is not something to have to know.
   */
  title?: string;
  /** A line under the title, when the choice needs one. */
  hint?: string;
  /**
   * Une image en plein cadre, posée au bord haut de la carte.
   *
   * Ce que `Sheet` sait faire depuis les quatre bannières, et pour la même
   * raison : une carte qui ouvre un chantier — étudier, par exemple — se
   * présente, là où une question se pose nue. La carte perd alors son
   * rembourrage au profit de son corps, pour que l'image touche les trois
   * bords ; ses coins arrondis la découpent, elle n'a pas à les connaître.
   */
  banner?: ImageSourcePropType;
  /**
   * Un glyphe devant le titre — voir `JournalTitle`, qui le porte aussi.
   *
   * Pour les cartes qui **règlent** quelque chose, et pour elles seules. Une
   * question — « Supprimer cet événement ? » — ne gagne rien à être décorée,
   * et il faudrait de toute façon un dessin qui vaille pour les douze.
   */
  icon?: ImageSourcePropType;
  /**
   * The way out at the foot of the card — "Annuler" unless told otherwise.
   *
   * `null` leaves only the cross in the corner, which is enough when the card
   * holds no choice to back out of. Drawn as a filled, quiet-toned button:
   * see the comment where it is rendered.
   */
  dismissLabel?: string | null;
  /**
   * What that button does, when it is not simply closing the card.
   *
   * A card that changed its face — asking "are you sure?" where it listed
   * choices — backs out to its first face rather than off the screen. The cross
   * in the corner always closes.
   */
  onDismiss?: () => void;
  /**
   * How heavily this card veils what is behind it.
   *
   * `"full"` by default, and that is what a dialogue is for: nothing behind is
   * touchable until it is answered, and the dimming says so.
   *
   * **Pass `"soft"` when it opens from inside a sheet or another card**, which
   * has already laid the very same `BACKDROP`. Two of them is not twice as
   * clear, it is `0.42` over `0.42` — two thirds of brown across the whole
   * screen, which reads as a rendering fault rather than as a question. And no
   * veil at all was tried: it leaves pale paper on pale paper with nothing but
   * a shadow between them, and the card does not come forward. `"soft"` is the
   * same brown, light enough to be a second layer and dark enough to show the
   * card's edge.
   *
   * The pressable backdrop is there whichever is chosen, so tapping beside the
   * card always closes it; only the paint changes.
   *
   * A sheet needs none of this: its panel is opaque and docked to the bottom,
   * so a doubled veil only shows in the strip above it. A card floats in the
   * middle, where there is nothing to hide it.
   */
  veil?: "full" | "soft";
  /** The choices, stacked — buttons, usually. */
  children: ReactNode;
};

/**
 * A question asked in the middle of the screen.
 *
 * **Toutes les cartes titrent à gauche, sous leur trait.** Il exista un
 * `centred` qui titrait comme une feuille — au milieu, un cran plus gros —
 * pour les cartes qu'on ouvre afin de régler quelque chose plutôt que pour
 * répondre. L'argument tenait tant que les cartes étaient toutes des
 * questions ; la bibliothèque, les classeurs, les filtres et le menu d'un
 * arbre en ont fait cinq qui règlent, et c'est l'exception qui est devenue
 * la règle. Les dernières cartes centrées se lisaient alors comme une autre
 * espèce d'objet, ce que `centred` cherchait précisément à éviter.
 *
 * The app answers almost everything with a bottom sheet, which is the right
 * place for filling something in: it rises from the thumb. A dialogue is for a
 * fork in the road — two or three ways to go, one tap, and nothing else
 * touchable until it is answered. Those are worth interrupting for, and the
 * middle of the screen is where an interruption belongs.
 */
/** The fade in and out, matching the dimming of a sheet. */
const FADE = 160;

/**
 * La largeur du papier, mesurée et non devinée.
 *
 * C'est `maxWidth` de la carte, bornée par l'écran moins le rembourrage que
 * `root` laisse de chaque côté. Une bannière doit connaître ce nombre :
 * `Image` exige ses deux dimensions en points — voir `bannerImage` — et la
 * largeur d'un parent en pourcentage ne lui parvient pas.
 */
const CARD_MAX = 380;
const CARD_WIDTH = Math.min(
  CARD_MAX,
  Dimensions.get("window").width - 2 * space.xl,
);

/**
 * La hauteur de la bande, en part de la largeur de la carte.
 *
 * Posée sur la largeur et non sur celle de l'écran : une carte est un objet
 * de proportions, et la bande doit garder les siennes quel que soit
 * l'appareil. Trois huitièmes font un bandeau large d'à peu près deux fois
 * et demie sa hauteur — le format des quatre bannières de l'atlas, qui se
 * trouvent toutes autour de 2,4.
 */
const BANNER_SHARE = 0.38;
const BANNER_HEIGHT = CARD_WIDTH * BANNER_SHARE;

export function Dialog({
  visible,
  onClose,
  onClosed,
  title,
  hint,
  icon,
  banner,
  dismissLabel = "Annuler",
  onDismiss,
  veil = "full",
  children,
}: DialogProps) {
  /**
   * Le rapport de la bannière, demandé à l'asset — comme dans `Sheet`.
   *
   * `undefined` pour une source distante, dont la taille n'est pas connue
   * avant le chargement : l'image prend alors la hauteur de la bande et
   * `cover` la recadre.
   */
  const shape = banner ? Image.resolveAssetSource(banner) : null;
  const ratio =
    shape && shape.height > 0 ? shape.width / shape.height : undefined;
  /** Ce que l'image mesure une fois réduite à la largeur de la carte. */
  const natural = ratio ? CARD_WIDTH / ratio : undefined;
  /**
   * La bande, jamais plus haute que ce que l'image peut remplir.
   *
   * Au-delà, on n'en montrerait pas davantage : on ajouterait du vide
   * au-dessus, et ce vide serait un filet de papier coincé entre le coin
   * arrondi et l'image. Demander plus revient donc à tout voir.
   */
  const band =
    natural === undefined ? BANNER_HEIGHT : Math.min(BANNER_HEIGHT, natural);

  // Read through a ref, like `Sheet` does: listing the callback among the
  // effect's dependencies would replay the exit every time the caller renders.
  const closed = useRef(onClosed);
  closed.current = onClosed;

  /** Kept mounted through the fade out, then torn down. */
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: FADE,
        useNativeDriver: false,
      }).start();
      return;
    }

    // Nothing to fade away on first render of a closed card.
    if (!mounted) return;

    Animated.timing(fade, {
      toValue: 0,
      duration: FADE,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      closed.current?.();
    });
    // `mounted` is read, not tracked: adding it would re-run the exit on
    // unmount — the same reasoning as in `Sheet`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fade]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* The veil and the card fade together, driven here rather than by the
          modal: see `onClosed` for why that matters. */}
      <Animated.View
        style={[
          styles.fill,
          veil === "soft" ? styles.veilSoft : styles.veilFull,
          { opacity: fade },
        ]}
      >
        {/* The backdrop is a sibling of the card, never its parent: a Pressable
            wrapped round the card swallows the touches meant for the buttons.

            Keyboard-aware, because some of these cards ask for a password: the
            padding grows from the bottom and lifts the centred card clear of
            the keyboard instead of leaving its buttons underneath. */}
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
          <View style={styles.card}>
            <Grain />

            {/* Au bord haut, avant le corps : c'est le corps qui porte
                désormais le rembourrage, la carte n'en a plus — sans quoi
                l'image se serait posée au milieu d'une marge. */}
            {banner === undefined ? null : (
              <View style={[styles.banner, { height: band }]}>
                <Image
                  source={banner}
                  style={[
                    styles.bannerImage,
                    /* Les deux dimensions, toujours : voir `bannerImage`. */
                    { width: CARD_WIDTH, height: natural ?? band },
                  ]}
                  resizeMode="cover"
                  accessible={false}
                />
              </View>
            )}

            <View style={styles.body}>
              <View
                style={title === undefined ? styles.headerBare : styles.header}
              >
                {title === undefined ? null : (
                  <View style={styles.heading}>
                    {icon === undefined ? (
                      <Text style={styles.title}>{title}</Text>
                    ) : (
                      <View style={styles.titleRow}>
                        <Image
                          source={icon}
                          style={styles.titleIcon}
                          resizeMode="contain"
                          accessible={false}
                        />
                        <Text style={styles.title}>{title}</Text>
                      </View>
                    )}
                    <View style={styles.underline} />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  hitSlop={8}
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.close,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.closeGlyph}>×</Text>
                </Pressable>
              </View>

              {hint === undefined ? null : (
                <Text style={styles.hint}>
                  {hint}
                </Text>
              )}

              {/* Nothing here carries `grow`: that is `flex: 1`, meant to fill
                  a row. In a column sized by its content it gives each child a
                  basis of nothing, and they spill out of the card. Stretching
                  to the full width happens on its own. */}
              <View style={styles.choices}>{children}</View>

              {/* En plein, et non en `quiet`.
                  Il était dessiné en texte nu sur le papier de la carte, et ne
                  se lisait pas comme un bouton — « Annuler » et « Retour »
                  disparaissaient dans le fond. C'est la même étoffe que le
                  « Fermer » au pied des feuilles, qui est la même chose : la
                  sortie, offerte sans insister. */}
              {dismissLabel === null ? null : (
                <InkButton
                  label={dismissLabel}
                  variant="tonal"
                  onPress={onDismiss ?? onClose}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  veilFull: { backgroundColor: BACKDROP },
  veilSoft: { backgroundColor: BACKDROP_SOFT },
  card: {
    width: "100%",
    maxWidth: CARD_MAX,
    /* Ni rembourrage ni écart ici : ils sont passés à `body`, pour qu'une
       bannière puisse toucher les trois bords. Sans bannière, une colonne
       rembourrée dans une carte nue revient exactement au même. */
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceRaised,
    // Clipped so the grain keeps to the rounded corners, and edged so the
    // card reads as a sheet of paper rather than a floating rectangle.
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.lifted,
  },
  /** Ce qui se lit, rembourré — voir `card`. */
  body: { padding: space.xl, gap: space.sm },
  /**
   * La bande, découpée par les coins de la carte, qui porte le même
   * `overflow` — l'image n'a donc pas à connaître leur rayon.
   *
   * Sa hauteur est posée au vol : elle dépend de l'image — voir `band`.
   */
  banner: { overflow: "hidden" },
  /**
   * Accrochée en bas à gauche, à une taille entièrement dictée.
   *
   * **Les deux dimensions sont écrites, et c'est une leçon.** `Image`
   * compose son style ainsi :
   *
   *     style = [{width, height}, styles.base, props.style]
   *
   * — les dimensions intrinsèques de l'asset d'abord, le style du programme
   * ensuite. Celui-ci gagne, mais **seulement sur ce qu'il nomme** : toute
   * dimension laissée de côté garde celle du fichier, ses pixels comptés en
   * points. La largeur est donc celle de la carte, et la hauteur celle que
   * l'image prend à cette largeur : elle n'est ni rognée sur les côtés ni
   * écrasée, seulement plus haute que la bande. `bottom: 0` décide alors
   * quel bord déborde — le haut — et donc quel bord survit.
   */
  bannerImage: { position: "absolute", left: 0, bottom: 0 },
  /** The cross sits level with the title, whatever the title wraps to. */
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  /** Untitled: the cross alone, on its own line, pulled into the padding. */
  headerBare: { flexDirection: "row", justifyContent: "flex-end" },
  heading: { flex: 1, gap: space.xs },
  title: { ...type.plate, fontSize: 22, color: palette.ink },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  /** Vingt, accordé au titre de vingt-deux — voir `JournalTitle`. */
  titleIcon: { width: 20, height: 20, tintColor: palette.ink },
  /** Hand-drawn under the words, not ruled across the card. */
  underline: {
    height: 3,
    width: "58%",
    minWidth: 56,
    marginTop: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
  },
  hint: { ...type.caption, color: palette.inkSoft, marginTop: space.xs },
  close: {
    width: 32,
    height: 32,
    marginTop: -4,
    marginRight: -4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  closeGlyph: { fontSize: 24, lineHeight: 28, color: palette.inkFaint, marginTop: -2 },
  pressed: { opacity: 0.6 },
  choices: { gap: space.sm, marginTop: space.xs, marginBottom: space.xs },
});
