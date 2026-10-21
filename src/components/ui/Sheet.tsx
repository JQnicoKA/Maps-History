import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Image,
  type ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Grain, JournalTitle } from "./Scrapbook";
import { palette } from "../../theme/palette";
import { BACKDROP, radius, shadow, space } from "../../theme/tokens";

const SCREEN = Dimensions.get("window").height;
/** La largeur du panneau : il court d'un bord à l'autre de l'écran. */
const SCREEN_WIDTH = Dimensions.get("window").width;

/**
 * La part de l'écran qu'un panneau occupe au plus — et exactement, s'il est
 * `tall`.
 *
 * Un nombre plutôt que deux chaînes : la hauteur maximale, la hauteur des
 * panneaux hauts et la bannière s'y réfèrent toutes les trois, et trois
 * « 92 % » écrits séparément auraient fini par diverger.
 */
const PANEL_PERCENT = 92;
const PANEL_MAX = `${PANEL_PERCENT}%` as const;

const PATTERN = require("../../../assets/general-fond.png");

/** Ce que la bannière prend du panneau : un peu moins d'un cinquième. */
const BANNER_SHARE = 0.18;
const BANNER_HEIGHT = SCREEN * (PANEL_PERCENT / 100) * BANNER_SHARE;

/**
 * Le papier, continué sous le clavier.
 *
 * Le panneau s'arrête au-dessus de lui — c'est le rembourrage que pose la vue
 * d'esquive — et ce qu'il y a dessous est le voile de la modale. On ne le
 * verrait pas si le clavier était un rectangle, mais ses coins sont arrondis,
 * et deux triangles sombres apparaissent aux angles.
 *
 * **Un composant à part, et c'est délibéré.** La mesure demande un état et un
 * abonnement ; les poser dans `Sheet` aurait ajouté deux hooks à un panneau
 * monté partout, ce qu'un rechargement à chaud n'applique pas proprement. Ici
 * ils naissent avec un enfant neuf, et `Sheet` garde les siens inchangés.
 *
 * `Will` plutôt que `Did` : la bande doit être en place avant que le panneau
 * ne commence à monter. Avec `Did` elle arriverait après, ce qui est
 * exactement le clignotement qu'on cherche à supprimer.
 */
function Skirt() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const rising = Keyboard.addListener("keyboardWillShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const falling = Keyboard.addListener("keyboardWillHide", () =>
      setHeight(0),
    );
    return () => {
      rising.remove();
      falling.remove();
    };
  }, []);

  if (height === 0) return null;
  return <View pointerEvents="none" style={[styles.skirt, { height }]} />;
}

/** Past this drop — or this flick — the sheet is on its way out. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.8;

/**
 * The panel is animated on the JS thread on purpose. A value handed to the
 * native driver stops repainting reliably when `setValue` is called from JS,
 * which is exactly what a drag does — the sheet would refuse to follow the
 * finger. The JS thread is idle while a sheet is being dragged, so the cost is
 * not visible.
 */
const DRIVER = false;

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Fired once the panel has finished leaving and the modal is gone.
   *
   * For what must not happen while it is still on screen: iOS will not present
   * a second modal from a controller that is dismissing one, so "close this
   * sheet, then open that screen" has to wait for this rather than guess at a
   * delay.
   */
  onClosed?: () => void;
  title?: string;
  /**
   * Une image en bandeau, tout en haut du panneau, de bord à bord.
   *
   * Décorative et rien d'autre : elle ne porte pas le titre, qui reste sous
   * elle, et aucun panneau n'en a besoin pour se lire. Elle est donc une
   * option — un panneau qui n'en donne pas s'ouvre exactement comme avant,
   * sur sa poignée et son titre.
   *
   * **Toute sa largeur, un dixième de la hauteur du panneau, et c'est le
   * haut qui est coupé.** L'image garde son rapport et prend la largeur
   * entière : rien n'est rogné sur les côtés ni écrasé. Elle est plus haute
   * que la bande qu'on lui donne, donc elle déborde — par le haut, puisqu'on
   * l'accroche par le bas. Ce qui survit est le bas de l'image, ce qui est
   * bien l'endroit où une bannière faite pour un panneau range ce qui doit
   * rejoindre la page.
   */
  banner?: ImageSourcePropType;
  /** Pinned below the scrolling content — where the actions live. */
  footer?: ReactNode;
  /**
   * Opens at full height instead of hugging its contents.
   *
   * For a sheet whose contents come and go — a list that grows, a form that
   * walks through six steps — a panel sized to what it happens to hold jumps
   * about as the reader works. Given a height, it stays put and the contents
   * move inside it.
   */
  tall?: boolean;
  /**
   * Whether the panel gets out of the keyboard's way when it opens.
   *
   * On by default, and right for almost everything — including the tall
   * forms, which is a correction. The rule written here used to say a long
   * panel had nowhere to rise to, so lifting it would only shove its buttons
   * against the keys. That was wrong about the mechanism: a `tall` panel's
   * height is a percentage of the content box, the keyboard's padding
   * shrinks that box, so the panel **shortens** and sits whole above the
   * keys — footer included. What `false` really cost was the footer, hidden
   * under the keyboard at the moment one finishes typing and wants the next
   * step.
   *
   * `false` remains for a panel that would rather keep its full height and
   * let its own scrolling list make room underneath — the catalogue, whose
   * rows are the point and whose only field is at the top. On iOS that is
   * `automaticallyAdjustKeyboardInsets` on the list; on Android nothing lifts
   * either way, and the window resizes instead.
   */
  liftsForKeyboard?: boolean;
  /**
   * Le papier peint à motifs, derrière tout le panneau.
   *
   * **Éteint partout sauf là où on le demande**, et il n'est demandé que par
   * la bibliothèque. Il a valu un temps pour tout panneau haut ; l'exception
   * s'est renversée, et c'est la règle qui est devenue l'exception.
   *
   * Le papier nu reste donc la mise par défaut : un panneau où l'on écrit
   * veut une page, et des motifs derrière un formulaire disputent l'œil à ce
   * qu'on y inscrit. La bibliothèque ne demande rien à son lecteur — on y
   * parcourt ce que d'autres ont fait — et c'est le seul endroit où un fond
   * a de la place pour se voir.
   */
  pattern?: boolean;
  children: ReactNode;
};

/**
 * A bottom sheet: it rises from the thumb rather than landing in the middle of
 * the screen, which is where every current mobile app puts a dialogue and where
 * a hand can actually reach it. Drag the header down to dismiss.
 *
 * The animation is driven here rather than by `animationType="slide"`, which
 * translates the whole modal — dimming included — so the backdrop appeared to
 * slide up with the panel. It now fades in place while only the panel travels.
 *
 * The backdrop is a sibling of the panel, never its parent: wrapping the panel
 * in a Pressable steals the touch responder and stops lists inside from
 * scrolling.
 */
export function Sheet({
  visible,
  onClose,
  onClosed,
  title,
  banner,
  footer,
  tall = false,
  pattern = false,
  liftsForKeyboard = true,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  /**
   * Le rapport de la bannière, demandé à l'asset plutôt qu'écrit à la main.
   *
   * `undefined` pour une source distante, dont les dimensions ne sont pas
   * connues avant le chargement : l'image prend alors la hauteur que son
   * style lui donne, et aucune mise en page ne s'effondre.
   */
  const shape = banner ? Image.resolveAssetSource(banner) : null;
  const ratio =
    shape && shape.height > 0 ? shape.width / shape.height : undefined;
  /** Ce que l'image mesure une fois réduite à la largeur du panneau. */
  const natural = ratio ? SCREEN_WIDTH / ratio : undefined;
  /**
   * La bande, sans jamais dépasser ce que l'image peut remplir.
   *
   * Une bande plus haute que l'image ne montrerait pas davantage d'image :
   * elle ajouterait du vide au-dessus, et ce vide serait un filet blanc
   * coincé entre le bord arrondi du panneau et la bannière. Le plafond est
   * donc la hauteur naturelle, et demander plus revient simplement à tout
   * voir.
   */
  const band =
    natural === undefined ? BANNER_HEIGHT : Math.min(BANNER_HEIGHT, natural);

  // Read through a ref: listing the callback among the effect's dependencies
  // would replay the exit animation every time the caller re-renders.
  const closed = useRef(onClosed);
  closed.current = onClosed;

  /** Kept mounted through the exit animation, then torn down. */
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN);
      dim.setValue(0);
      Animated.parallel([
        Animated.timing(dim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: DRIVER,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: DRIVER,
        }),
      ]).start();
      return;
    }

    // Nothing to animate away on first render of a closed sheet.
    if (!mounted) return;

    Animated.parallel([
      Animated.timing(dim, { toValue: 0, duration: 160, useNativeDriver: DRIVER }),
      Animated.timing(translateY, {
        toValue: SCREEN,
        duration: 220,
        useNativeDriver: DRIVER,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      closed.current?.();
    });
    // `mounted` is read, not tracked: adding it would re-run the exit on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, translateY, dim]);

  /**
   * Only the header drags. Claiming the whole panel would fight every list
   * inside it for the same downward gesture.
   */
  const pan = useRef(
    PanResponder.create({
      // Claimed on touch, not on move: nothing in the header is tappable, and
      // waiting for a threshold let the first pixels of the drag escape.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy <= 0) return;
        translateY.setValue(gesture.dy);
        dim.setValue(Math.max(0, 1 - gesture.dy / (SCREEN * 0.6)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
          onClose();
          return;
        }
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 260,
            useNativeDriver: DRIVER,
          }),
          Animated.timing(dim, {
            toValue: 1,
            duration: 120,
            useNativeDriver: DRIVER,
          }),
        ]).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <Modal
      visible
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]}
        >
          <Pressable
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={
            liftsForKeyboard && Platform.OS === "ios" ? "padding" : undefined
          }
          style={styles.dock}
          pointerEvents="box-none"
        >
          {liftsForKeyboard && Platform.OS === "ios" ? <Skirt /> : null}

          <Animated.View
            style={[
              styles.panel,
              tall && styles.tall,
              banner ? styles.edgeless : null,
              { transform: [{ translateY }] },
            ]}
          >
            {/* Behind everything, including the header's rule. */}
            <Grain />

            {/* En pour cent et non par ses quatre bords : le panneau est une
                colonne, et une image absolue sans dimensions explicites
                garderait sa taille native. */}
            {pattern ? (
              // Enveloppé, comme `Grain` : une image ne prend pas de
              // `pointerEvents`, et celle-ci couvre tout le panneau — elle
              // avalerait jusqu'au glissement qui ferme la feuille.
              <View
                pointerEvents="none"
                style={styles.pattern}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <Image
                  source={PATTERN}
                  style={styles.patternImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* The whole header is the handle — a 4pt bar is not a target.

                Opaque, et c'est ce qui arrête le papier peint : il court
                derrière tout le panneau, et la barre du titre comme celle des
                boutons doivent rester nettes — on y lit un nom et on y vise
                des cibles. Chacune reprend donc le papier et son grain, sans
                quoi elles se liraient comme deux bandes lisses collées à une
                feuille qui ne l'est pas. */}
            <View
              {...pan.panHandlers}
              style={[styles.header, pattern ? styles.headerClear : null]}
            >
              {/* Pas de grain à soi quand le bandeau est transparent : celui
                  du panneau passe déjà au travers, et deux couches de 0,22
                  l'une sur l'autre en font 0,39 — le bandeau se lirait comme
                  une bande plus rugueuse que le reste de la feuille. */}
              {pattern ? null : <Grain />}
              {banner ? (
                /* La poignée se pose **sur** la bannière, et non au-dessus :
                   l'image commence au bord haut du panneau, et lui ménager
                   une bande au-dessus aurait mis un ruban blanc entre le bord
                   arrondi et elle. En clair plutôt qu'en `line`, puisqu'elle
                   se lit désormais sur une couleur dense. */
                <View style={[styles.banner, { height: band }]}>
                  <Image
                    source={banner}
                    style={[
                      styles.bannerImage,
                      /* Les deux dimensions, toujours : voir `bannerImage`.
                         Sans rapport connu — une source distante —, l'image
                         remplit la bande et c'est `cover` qui la recadre :
                         moins fidèle, mais rien ne s'effondre. */
                      {
                        width: SCREEN_WIDTH,
                        height: natural ?? band,
                      },
                    ]}
                    resizeMode="cover"
                    accessible={false}
                  />
                  <View style={styles.grabOverBanner} pointerEvents="none">
                    <View style={[styles.grab, styles.grabLight]} />
                  </View>
                </View>
              ) : (
                <View style={styles.grabZone}>
                  <View style={styles.grab} />
                </View>
              )}
              {title ? (
                <View style={styles.titleBlock}>
                  <JournalTitle title={title} />
                </View>
              ) : null}
            </View>

            {children}

            {footer ? (
              <View
                style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}
              >
                <Grain />
                {footer}
              </View>
            ) : (
              <View style={{ height: insets.bottom + space.sm }} />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: BACKDROP },
  dock: { flex: 1, justifyContent: "flex-end" },
  /**
   * Le prolongement du papier sous le clavier. Sa hauteur est posée au vol.
   *
   * `bottom: 0` et non une valeur négative : en positionnement absolu,
   * l'origine est la boîte de **rembourrage** du parent, lequel comprend le
   * rembourrage que la vue d'esquive vient d'ajouter pour le clavier. Le bas
   * de cette boîte est donc le bas de l'écran, pas le pied du panneau — une
   * bande posée en dessous partait hors de vue.
   */
  skirt: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.surfaceRaised,
  },
  panel: {
    maxHeight: PANEL_MAX,
    backgroundColor: palette.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    // Clipped, so the grain stops where the rounded corners do rather than
    // squaring them off.
    overflow: "hidden",
    // A hairline along the top edge: the sheet is a sheet of paper laid on
    // the plate, and paper has an edge. Sauf sous une bannière — voir
    // `edgeless`.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.lifted,
  },
  /** Both, so the panel neither shrinks below nor grows past the same mark. */
  tall: { height: PANEL_MAX },
  /**
   * Le papier peint : la place qu'il occupe, et à quel point il se voit.
   *
   * En pour cent et non par ses quatre bords — une image absolue sans
   * dimensions explicites garderait sa taille native, qui est celle du
   * fichier. C'est la même règle que la bannière a réapprise à ses dépens :
   * `Image` pose les dimensions de l'asset dans le style avant les vôtres,
   * et toute dimension que vous ne nommez pas reste celle du fichier.
   */
  pattern: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  /**
   * L'opacité est portée par l'image et non par la vue qui l'enveloppe.
   *
   * Une vue translucide est composée hors écran, dans un tampon dimensionné
   * au moment de la mise en page — et ce panneau arrive en glissant, donc
   * mesuré pendant qu'il bouge. Un tampon capturé à la mauvaise taille puis
   * étiré, c'est précisément la forme du rectangle observé dans un coin. Sur
   * l'image, l'opacité est appliquée par le rendu de l'image elle-même, sans
   * calque intermédiaire.
   *
   * À moitié effacé, parce qu'il est un fond : au-delà, les motifs se
   * mettent à concurrencer le texte posé dessus.
   */
  patternImage: { width: "100%", height: "100%", opacity: 0.5 },
  /**
   * Sans liseré, parce qu'une bannière en fait un meilleur.
   *
   * Le filet du panneau est tracé **dedans**, donc par-dessus le haut de la
   * bannière : un trait crème d'un demi-point en travers de la cire, tout en
   * haut de la modale. Il est là pour donner un bord à une feuille de
   * papier ; une bande de couleur dense se détache d'elle-même du voile, et
   * n'a pas besoin qu'on lui en dessine un.
   */
  edgeless: { borderTopWidth: 0 },
  /**
   * Transparent, pour que le papier peint traverse la zone du titre.
   *
   * Le bandeau est opaque par défaut, et c'est lui qui arrêtait net les
   * motifs à sa limite basse : le fond paraissait coupé en travers, juste
   * sous le nom du panneau. Effacé, il laisse l'image courir d'un bout à
   * l'autre de la feuille.
   *
   * Ce que l'opacité protégeait — un titre net — n'est pas perdu : ce fond
   * est clairsemé, à peine deux pour cent et demi de ses pixels passant la
   * demi-opacité, et l'encre du titre y tient 8,0:1 au pire endroit contre
   * 11,0 sur le papier nu.
   */
  headerClear: { backgroundColor: "transparent" },
  /** Opaques toutes les deux : voir le commentaire au-dessus du titre. */
  header: {
    paddingBottom: space.xs,
    backgroundColor: palette.surfaceRaised,
    overflow: "hidden",
  },
  grabZone: { alignItems: "center", paddingTop: space.md, paddingBottom: space.sm },
  /**
   * La bande, dont la hauteur est décidée ici et non par l'image.
   *
   * `overflow: hidden` est ce qui fait le recadrage : l'image dedans est plus
   * haute que la bande, et c'est cette ligne qui en coupe le surplus. Le
   * panneau la découpe en plus à ses coins arrondis — il porte le même
   * `overflow` —, donc l'image n'a pas à connaître leur rayon.
   *
   * Sa hauteur est posée au vol, car elle dépend de l'image — voir `band`.
   */
  banner: { overflow: "hidden" },
  /**
   * Accrochée en bas à gauche, à une taille entièrement dictée.
   *
   * **Les deux dimensions sont écrites, et c'est une leçon, pas une
   * précaution.** `Image` compose son style ainsi :
   *
   *     style = [{width, height}, styles.base, props.style]
   *
   * — les dimensions intrinsèques de l'asset d'abord, le style du programme
   * ensuite. Celui-ci gagne, mais **seulement sur ce qu'il nomme** : toute
   * dimension laissée de côté garde celle de l'image, ses pixels comptés en
   * points. Une bannière de mille trois cent douze pixels de large se posait
   * donc large de mille trois cent douze points, et il n'en restait à
   * l'écran que la gauche ; `left`/`right`, `aspectRatio` et les
   * pourcentages n'y pouvaient rien, puisqu'une largeur explicite les bat
   * tous dans Yoga.
   *
   * La largeur est donc celle de l'écran — le panneau court d'un bord à
   * l'autre — et la hauteur celle que l'image prend à cette largeur : elle
   * n'est ni rognée sur les côtés ni écrasée, elle est seulement plus haute
   * que la bande. `bottom: 0` décide alors quel bord déborde — le haut — et
   * donc quel bord survit.
   */
  bannerImage: { position: "absolute", left: 0, bottom: 0 },
  /** Posée sur la bannière, à la place qu'elle occupe d'ordinaire. */
  grabOverBanner: {
    position: "absolute",
    top: space.md,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  /** Sur une couleur dense, c'est le clair qui se voit. */
  grabLight: { backgroundColor: "rgba(255, 255, 255, 0.55)" },
  grab: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
  },
  titleBlock: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    flexDirection: "row",
    gap: space.md,
    backgroundColor: palette.surfaceRaised,
    overflow: "hidden",
  },
});
