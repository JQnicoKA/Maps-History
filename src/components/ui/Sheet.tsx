import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Image,
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

const PATTERN = require("../../../assets/general-fond.png");

const SCREEN = Dimensions.get("window").height;

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
  footer,
  tall = false,
  liftsForKeyboard = true,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();

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
              { transform: [{ translateY }] },
            ]}
          >
            {/* Behind everything, including the header's rule. */}
            <Grain />

            {/* Le papier peint, sur les seuls panneaux de pleine hauteur.
                `tall` *est* l'ensemble visé : ce sont les panneaux où l'on
                travaille — écrire, choisir, parcourir — et ils ont assez de
                place pour qu'un fond se voie sans gêner. Les fiches de détail
                se dimensionnent sur ce qu'elles montrent et n'en sont pas :
                une planche de motifs derrière trois lignes et une photographie
                ferait concurrence à ce qu'on est venu lire.

                En pour cent et non par ses quatre bords : le panneau est une
                colonne, et une image absolue sans dimensions explicites
                garderait sa taille native. */}
            {tall ? (
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
            <View {...pan.panHandlers} style={styles.header}>
              <Grain />
              <View style={styles.grabZone}>
                <View style={styles.grab} />
              </View>
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
    maxHeight: "92%",
    backgroundColor: palette.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    // Clipped, so the grain stops where the rounded corners do rather than
    // squaring them off.
    overflow: "hidden",
    // A hairline along the top edge: the sheet is a sheet of paper laid on
    // the plate, and paper has an edge.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.paperDeep,
    ...shadow.lifted,
  },
  /** Both, so the panel neither shrinks below nor grows past the same mark. */
  tall: { height: "92%" },
  /**
   * Le papier peint : la place qu'il occupe, et à quel point il se voit.
   *
   * En pour cent et non par ses quatre bords — une image absolue sans
   * dimensions explicites garderait sa taille native, qui est celle du
   * fichier. À moitié effacé, parce qu'il est un fond : au-delà, les motifs
   * se mettent à concurrencer le texte posé dessus.
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
   */
  patternImage: { width: "100%", height: "100%", opacity: 0.5 },
  /** Opaques toutes les deux : voir le commentaire au-dessus du titre. */
  header: {
    paddingBottom: space.xs,
    backgroundColor: palette.surfaceRaised,
    overflow: "hidden",
  },
  grabZone: { alignItems: "center", paddingTop: space.md, paddingBottom: space.sm },
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
