import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CARD_TOP, FACE, FACE_BAND, GAP, NODE } from "./layout";
import { lifespan } from "../events/lifespan";
import type { Character, TreeMember } from "../events/types";
import { lifted as tapLifted, shifted } from "../../lib/touch";
import { palette } from "../../theme/palette";
import { radius, shadow, space } from "../../theme/tokens";

export type TreeNodeProps = {
  member: TreeMember;
  person: Character | undefined;
  x: number;
  y: number;
  /** Ringed in wax: the one being worked on, or someone already linked to it. */
  active?: boolean;
  /**
   * Out of reach while a line is being drawn — the wrong generation for the
   * kind of link being traced. Faded rather than hidden: the reader still needs
   * to see where they are in the tree.
   */
  muted?: boolean;
  onPress: () => void;
  /**
   * Everything a drag needs, and nothing the node should know on its own.
   *
   * `held` tells the window to stand down — see `PanZoom`. `magnification`
   * converts thumb into canvas. `onDrop` reports **whole columns travelled**,
   * left negative, so the node says how far it went and the tree decides what
   * that means.
   *
   * Absent, the node is simply not draggable.
   */
  drag?: {
    held: { current: boolean };
    magnification: { current: number };
    onStart: () => void;
    /**
     * Fired only when the landing column **changes**, never on every frame.
     *
     * The tree draws a mark where the card would come to rest, and that mark
     * only moves a dozen times in a long drag. Reporting each frame would
     * re-render every node in the generation sixty times a second to say
     * nothing new.
     */
    onMove: (columns: number) => void;
    onDrop: (columns: number) => void;
  };
};

/** How long a finger must rest before the card comes loose, in milliseconds. */
const HOLD = 260;

/** Past this much travel before the hold fires, it was a pan, not a grab. */
const WANDER = 8;

/**
 * How many whole columns a finger has covered — the one conversion both the
 * landing mark and the drop itself go through, so they cannot disagree.
 */
const columnsTravelled = (dx: number, magnification: number): number =>
  Math.round(dx / magnification / (NODE.width + GAP.x));

/**
 * Someone, drawn: a round portrait, a name, two dates.
 *
 * Every face is the same size — that of a major figure. **Weight in the tree
 * is carried by opacity**: a minor figure recedes into the paper, a founder
 * sits full on it. Size was tried and given up, because shrinking a portrait
 * makes a face harder to recognise, and a likeness should stay legible
 * whatever rank it holds.
 *
 * The box is fixed and the portrait hangs from a band, so a generation reads
 * as one line and the connectors never move.
 *
 * Behind the name and the lower half of the face sits a card in sealing wax —
 * the app's one accent, the colour of the year in the frieze. The portrait
 * overflows above it, which is what makes a face read as resting *on* a card
 * rather than being framed inside one.
 */
export function TreeNode({
  member,
  person,
  x,
  y,
  active = false,
  muted = false,
  onPress,
  drag,
}: TreeNodeProps) {
  const face = person?.photos[0];
  const [lifted, setLifted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const travel = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  /**
   * Read by the responder, which is built once and would otherwise close over
   * the first render's values for ever.
   */
  const live = useRef({ drag, lifted, muted, onPress });
  live.current = { drag, lifted, muted, onPress };

  /** The last column reported, so the tree hears only about changes. */
  const announced = useRef(0);

  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopHold = () => {
    if (hold.current !== null) clearTimeout(hold.current);
    hold.current = null;
  };
  // A card must not stay stuck to a finger that left with the screen.
  useEffect(() => stopHold, []);

  const release = (dx: number) => {
    stopHold();
    const held = live.current.drag;
    if (live.current.lifted && held) {
      held.onDrop(columnsTravelled(dx, held.magnification.current));
      held.held.current = false;
    }
    announced.current = 0;
    setLifted(false);
    setPressed(false);
    travel.setValue({ x: 0, y: 0 });
  };

  /**
   * One responder for the whole card: tap, hold, drag.
   *
   * There used to be a `Pressable` inside this, and it swallowed everything —
   * the responder system offers a touch to the deepest view first, so the
   * button claimed it and the hold below never started. A tap is therefore
   * recognised here instead: a release that never lifted the card and never
   * travelled far is a tap.
   */
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.muted,
      // Never on move: until the hold fires, a travelling finger belongs to
      // the window behind, which is what pans the drawing.
      onMoveShouldSetPanResponder: () => false,

      onPanResponderGrant: () => {
        setPressed(true);
        const held = live.current.drag;
        if (!held) return;
        hold.current = setTimeout(() => {
          held.held.current = true;
          setLifted(true);
          // Before the card has finished growing: the tap is what tells the
          // reader the hold took, and it should not arrive second.
          tapLifted();
          held.onStart();
        }, HOLD);
      },

      onPanResponderMove: (_event, gesture) => {
        const held = live.current.drag;
        if (!live.current.lifted || !held) {
          if (Math.hypot(gesture.dx, gesture.dy) > WANDER) stopHold();
          return;
        }
        /**
         * Divided by the magnification, and that is the whole trick.
         *
         * The finger travels in screen points; this card lives inside a sheet
         * that is scaled. A translation of `dx` written here is drawn as
         * `dx × scale`, so at two-thirds zoom the card lagged a third behind
         * the thumb. Converted to canvas points first, it renders back at
         * exactly `dx` and sticks to the finger at any zoom.
         *
         * Along the row only: a generation is changed from the card, never by
         * dropping into another row, where the meaning would be ambiguous.
         */
        travel.setValue({ x: gesture.dx / held.magnification.current, y: 0 });

        const columns = columnsTravelled(gesture.dx, held.magnification.current);
        if (columns !== announced.current) {
          announced.current = columns;
          shifted();
          held.onMove(columns);
        }
      },

      onPanResponderRelease: (_event, gesture) => {
        const tapped =
          !live.current.lifted && Math.hypot(gesture.dx, gesture.dy) <= WANDER;
        release(gesture.dx);
        if (tapped) live.current.onPress();
      },
      onPanResponderTerminate: () => release(0),
    }),
  ).current;
  const dates = person ? lifespan(person) : "";

  return (
    <Animated.View
      style={[
        styles.holder,
        {
          left: x,
          top: y,
          transform: travel.getTranslateTransform(),
          // Lifted off the page, and over its neighbours while it travels.
          zIndex: lifted ? 2 : 0,
        },
      ]}
      {...responder.panHandlers}
    >
    <View
      accessibilityRole="button"
      accessibilityLabel={person?.name ?? "Personnage"}
      style={[
        styles.node,
        lifted && styles.lifted,
        {
          opacity: muted
            ? 0.25
            : pressed && !lifted
              ? 0.6
              : WEIGHT[member.importance],
        },
      ]}
    >
      {/* Drawn first so everything else sits over it; positioned rather than
          in the flow, since it begins halfway up the portrait. */}
      <View style={[styles.card, active && styles.cardActive]} />

      {/* The band is what keeps the axis: the circle is centred in it, so its
          middle is always FACE_BAND / 2 below the top of the box. */}
      <View style={styles.band}>
        {/* The wax dot hangs off the portrait itself rather than off the box,
            so it follows it whatever size it is drawn at. */}
        <View style={styles.face}>
          {face ? (
            <Image source={{ uri: face.url }} style={styles.image} />
          ) : (
            <Text style={styles.initial}>
              {person?.name.charAt(0).toUpperCase() ?? "?"}
            </Text>
          )}

          {member.note ? <View style={styles.hasNote} /> : null}
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {person?.name ?? "Supprimé"}
      </Text>
      {dates === "" ? null : (
        <Text style={styles.dates} numberOfLines={1}>
          {dates}
        </Text>
      )}
    </View>
    </Animated.View>
  );
}

const DOT = 10;

/**
 * How present a face is, by the weight its member carries.
 *
 * `low` stays well clear of the 0.25 a muted node uses while a line is being
 * drawn: "minor" and "out of reach right now" must not look alike.
 */
const WEIGHT: Record<TreeMember["importance"], number> = {
  high: 1,
  medium: 0.78,
  low: 0.5,
};

const styles = StyleSheet.create({
  /**
   * Two boxes and not one: the outer is placed and dragged, the inner draws.
   *
   * A single view cannot both sit at an absolute position and carry a
   * translation that starts from it — the transform would fight the layout on
   * every frame of the drag.
   */
  holder: { position: "absolute", width: NODE.width, height: NODE.height },
  node: {
    width: NODE.width,
    height: NODE.height,
    alignItems: "center",
    gap: 3,
  },
  /** A card off the page: bigger, and casting further. */
  lifted: { transform: [{ scale: 1.06 }] },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CARD_TOP,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: palette.wax,
    ...shadow.soft,
  },
  /**
   * Ink, and not a brighter wax: the active state has to read against the wax
   * it sits on, and dark-on-wax is the only pair that does.
   */
  cardActive: { borderWidth: 3, borderColor: palette.ink },
  band: {
    width: NODE.width,
    height: FACE_BAND,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paperLight,
    // Cream, because this ring crosses two grounds: paper above, wax below.
    borderWidth: 3,
    borderColor: palette.paperLight,
    ...shadow.soft,
  },
  // Clipped to the circle by the parent's radius — which is why the portrait
  // is a child of the frame rather than the frame itself.
  image: { width: "100%", height: "100%", borderRadius: 999 },
  initial: { fontSize: FACE * 0.36, fontWeight: "700", color: palette.inkFaint },
  /** A dot of cream: there is something written about this one. */
  hasNote: {
    position: "absolute",
    bottom: 0,
    left: -2,
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    backgroundColor: palette.paperLight,
    borderWidth: 1.5,
    borderColor: palette.wax,
  },
  /**
   * Sized to the room the card actually has.
   *
   * Below the portrait's band sit 74 points. A name on two lines at this size
   * takes 40, the dates 16, the spacing 8 — 64 in all, which leaves the card a
   * margin at the foot rather than text pressed against its edge.
   */
  name: {
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: palette.paperLight,
    textAlign: "center",
  },
  dates: {
    fontSize: 13,
    lineHeight: 16,
    color: palette.paperLight,
    opacity: 0.78,
    textAlign: "center",
  },
});
