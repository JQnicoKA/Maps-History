import { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CARD_TOP, FACE_AXIS, GAP, NODE } from "./layout";
import { TreeFace } from "./TreeFace";
import { lifespan } from "../events/lifespan";
import type { Character, Importance, TreeMember } from "../events/types";
import { lifted as tapLifted, shifted } from "../../lib/touch";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

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
    /**
     * The finger left the spot after the card came loose.
     *
     * Fired once, and only to say "this is a move, not a hold" — the placement
     * menu opens on the hold and has to get out of the way the moment the
     * reader turns out to be dragging. `onMove` cannot do it: that waits for a
     * whole column of travel, by which time the menu has been in the way for
     * half the gesture.
     */
    onWander: () => void;
  };
  /**
   * The placement menu, open over this card.
   *
   * Opened by a hold that never travelled and closed by anything else, so the
   * one gesture answers both questions: hold and move to rearrange the row,
   * hold and let go to say how much this person matters here.
   */
  menu?: {
    /** Scaled against the drawing's zoom, so it reads the same at any. */
    scale: number;
    /** Opens downwards instead, for the top row where there is no room above. */
    below: boolean;
    onImportance: (value: Importance) => void;
    onRemove: () => void;
    /**
     * The two lines this person can take, offered where they would be drawn:
     * a spouse to the right, a child below.
     *
     * Always both, and `ready` says whether there is anybody to answer with.
     * They were hidden when there was nobody, which read as a feature that
     * had not been built: on a finished genealogy that is almost every card,
     * and nothing told the difference between "nothing to offer" and
     * "nothing here". Faded, they are still an answer, and the picker says
     * why in a sentence.
     */
    couple: { ready: boolean; onPress: () => void };
    descent: { ready: boolean; onPress: () => void };
  };
};

/** What a place in a tree can be worth, in the order the menu offers it. */
const PLACES: { value: Importance; label: string }[] = [
  { value: "low", label: "Discret" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Majeur" },
];

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
  menu,
}: TreeNodeProps) {
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
  /** Whether this gesture has already been called a move. */
  const wandered = useRef(false);

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
    wandered.current = false;
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
        // Said once, before anything has travelled a whole column: the menu
        // opened on the hold and must leave as soon as this is a drag.
        if (!wandered.current && Math.hypot(gesture.dx, gesture.dy) > WANDER) {
          wandered.current = true;
          held.onWander();
        }

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

  return (
    <Animated.View
      style={[
        styles.holder,
        {
          left: x,
          top: y,
          transform: travel.getTranslateTransform(),
          // Lifted off the page, and over its neighbours while it travels —
          // or while its menu is open, which must not slide under the card
          // standing next to it.
          zIndex: lifted || menu ? 2 : 0,
        },
      ]}
      {...responder.panHandlers}
    >
    <View style={lifted ? styles.lifted : undefined}>
      <TreeFace
        face={
          person === undefined
            ? undefined
            : {
                name: person.name,
                photo: person.photos[0]?.url ?? null,
                dates: lifespan(person),
              }
        }
        importance={member.importance}
        active={active}
        dimmed={muted}
        pressed={pressed && !lifted}
      />
    </View>

    {menu ? (
      <View
        style={[
          styles.menu,
          menu.below ? styles.menuBelow : styles.menuAbove,
          {
            transform: [{ scale: menu.scale }],
            transformOrigin: menu.below ? "center top" : "center bottom",
          },
        ]}
      >
        <Text style={styles.menuTitle}>Place dans cet arbre</Text>
        <View style={styles.choices}>
          {PLACES.map((place) => {
            const chosen = place.value === member.importance;
            return (
              <Pressable
                key={place.value}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={place.label}
                onPress={() => menu.onImportance(place.value)}
                style={({ pressed }) => [
                  styles.choice,
                  chosen && styles.choiceOn,
                  pressed && styles.choicePressed,
                ]}
              >
                <Text style={[styles.choiceLabel, chosen && styles.choiceLabelOn]}>
                  {place.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retirer de l'arbre"
          onPress={menu.onRemove}
          style={({ pressed }) => [styles.remove, pressed && styles.choicePressed]}
        >
          <Text style={styles.removeLabel}>Retirer de l'arbre</Text>
        </Pressable>
      </View>
    ) : null}

    {/* Where the line would go, not in a list of commands: a spouse stands
        beside you and a child below you, so that is where the two crosses
        sit. Drawn at the menu's scale, since they belong to it. */}
    {menu ? (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marier"
          onPress={menu.couple.onPress}
          style={({ pressed }) => [
            styles.join,
            styles.joinRight,
            !menu.couple.ready && styles.joinEmpty,
            { transform: [{ scale: menu.scale }] },
            pressed && styles.choicePressed,
          ]}
        >
          <Text
            style={[
              styles.joinGlyph,
              !menu.couple.ready && styles.joinGlyphEmpty,
            ]}
          >
            +
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Donner un enfant"
          onPress={menu.descent.onPress}
          style={({ pressed }) => [
            styles.join,
            styles.joinBelow,
            !menu.descent.ready && styles.joinEmpty,
            { transform: [{ scale: menu.scale }] },
            pressed && styles.choicePressed,
          ]}
        >
          <Text
            style={[
              styles.joinGlyph,
              !menu.descent.ready && styles.joinGlyphEmpty,
            ]}
          >
            +
          </Text>
        </Pressable>
      </>
    ) : null}
    </Animated.View>
  );
}

/** Room for "Discret · Normal · Majeur" on one line, and no more. */
const MENU_WIDTH = 186;

/** The two crosses, sized to be hit without covering the face. */
const JOIN = 28;


const styles = StyleSheet.create({
  /**
   * Two boxes and not one: the outer is placed and dragged, the inner draws.
   *
   * A single view cannot both sit at an absolute position and carry a
   * translation that starts from it — the transform would fight the layout on
   * every frame of the drag.
   */
  holder: { position: "absolute", width: NODE.width, height: NODE.height },
  /** A card off the page: bigger, and casting further. */
  lifted: { transform: [{ scale: 1.06 }] },

  /**
   * The placement menu: a slip of paper over the drawing.
   *
   * Wider than the card it belongs to and centred on it, so three words fit
   * on one line. Positioned against the card's own edge rather than laid out
   * in the flow, because it must not push the portrait about when it opens.
   */
  menu: {
    position: "absolute",
    left: (NODE.width - MENU_WIDTH) / 2,
    width: MENU_WIDTH,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.paperLight,
    borderWidth: 1.5,
    borderColor: palette.paperDeep,
    ...shadow.lifted,
  },
  menuAbove: { bottom: NODE.height - CARD_TOP + space.sm },
  menuBelow: { top: NODE.height + space.sm },
  menuTitle: { ...type.legend, color: palette.inkSoft, textAlign: "center" },
  choices: { flexDirection: "row", gap: 4 },
  choice: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.sm,
    alignItems: "center",
    backgroundColor: palette.sunken,
  },
  choiceOn: { backgroundColor: palette.wax },
  choicePressed: { opacity: 0.6 },
  choiceLabel: { fontSize: 12, fontWeight: "700", color: palette.inkSoft },
  choiceLabelOn: { color: palette.paperLight },
  remove: { alignItems: "center", paddingVertical: 5 },
  removeLabel: { fontSize: 12, fontWeight: "600", color: palette.danger },

  /** A wax button on the gap between the cards. */
  join: {
    position: "absolute",
    width: JOIN,
    height: JOIN,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
    borderWidth: 2,
    borderColor: palette.paperLight,
    ...shadow.soft,
  },
  /** On the axis the faces hang from, which is where a marriage bar runs. */
  joinRight: {
    right: -JOIN / 2,
    top: FACE_AXIS - JOIN / 2,
  },
  joinBelow: {
    left: NODE.width / 2 - JOIN / 2,
    top: NODE.height - JOIN / 2,
  },
  joinGlyph: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "700",
    color: palette.paperLight,
  },
  /** Nothing to offer yet — still there, still pressable, and it says why. */
  joinEmpty: { backgroundColor: palette.sunken, borderColor: palette.paperDeep },
  joinGlyphEmpty: { color: palette.inkFaint },
  // Clipped to the circle by the parent's radius — which is why the portrait
  // is a child of the frame rather than the frame itself.
});
