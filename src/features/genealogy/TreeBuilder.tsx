import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  canvasSize,
  CARD_TOP,
  columnX,
  connectors,
  FACE_AXIS,
  frame,
  GAP,
  nextColumn,
  NODE,
  place,
  rowCount,
  rowY,
  span,
} from "./layout";
import { PanZoom } from "./PanZoom";
import { blocks, dropAt, erasure, spouses } from "../events/rows";
import { TreeNode } from "./TreeNode";
import { CharacterDetailModal } from "../events/components/CharacterDetailModal";
import { CharacterManager } from "../events/components/CharacterManager";
import { ShareRow } from "../community/ShareRow";
import {
  ConfirmDialog,
  Dialog,
  InkButton,
  InkField,
  SelectField,
  Sheet,
  useNotice,
} from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { lifespan } from "../events/lifespan";
import type { Tree, TreeMember } from "../events/types";
import { lifted as tapLifted } from "../../lib/touch";
import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

export type TreeBuilderProps = {
  tree: Tree | null;
  onClose: () => void;
  /**
   * The ways out of a tree and into the rest of the collection, taken from
   * someone's card: an event they appear in, another tree they stand in, the
   * form on them.
   *
   * They **leave** the tree rather than opening over it. A card inside this
   * drawing is already a panel inside a full-screen one, and a third stacked
   * on top is more than iOS will present. The screen closes the tree, opens
   * the page, and brings the tree back when that page closes.
   */
  onOpenEvent: (id: string) => void;
  onOpenTree: (id: string) => void;
  onEditPerson: (id: string) => void;
  /**
   * Les deux façons de se procurer quelqu'un qu'on n'a pas encore.
   *
   * Un arbre se remplit avec les gens de sa collection, et le jour où il en
   * manque un, la liste ne servait qu'à constater le manque. Ces deux-là
   * quittent l'arbre comme les trois ci-dessus, et le ramènent après.
   */
  onNewPerson: () => void;
  onSeekPerson: () => void;
  /**
   * Ôté de l'écran sans être démonté.
   *
   * Pour le moment où la carte redevient le contrôle : on y vise un point,
   * et viser une carte qu'on ne voit pas n'est pas viser. Les panneaux se
   * dépréentent — `visible={visible && !aiming}` — mais un arbre est une vue,
   * alors il s'efface par le style.
   *
   * Effacé et non démonté, parce qu'on y revient aussitôt : le démonter
   * emporterait le panoramique, l'échelle et la carte à moitié remplie qui
   * attend derrière.
   */
  hidden?: boolean;
  /**
   * Vrai quand l'arbre est la page qu'on lit, faux quand une autre le survole.
   *
   * L'arbre reste dessiné derrière la page qu'on ouvre depuis lui, donc il ne
   * peut pas déduire de son propre montage qu'on lui est revenu. C'est l'écran
   * qui le sait, et qui le dit.
   */
  active?: boolean;
};

/**
 * The tree, and the tools to build it.
 *
 * Full screen, not a bottom sheet: a genealogy is wide and deep by nature, and
 * arranging one through a letterbox would be a punishment. The canvas is
 * dragged in both directions and pinched to zoom, and the chrome floats over
 * it — the bars' measured height is handed to `PanZoom`, which keeps the
 * drawing out from under them.
 *
 * Two modes, and only two. Normally a tap opens someone's page — the same one
 * the map opens, because "who is this" is the same question wherever it is
 * asked. Holding a card instead opens the little menu that says what their
 * place in *this* tree is worth, and moving while held rearranges the row.
 * **Tracer un lien**, at the top right, starts the other: choose couple or descent, touch
 * one person, and then touch everyone to be joined to them — touching again
 * erases the line. On a descent the spouse of the first person may be touched
 * too, and the children then belong to the couple. Only the members that can
 * legally take that link stay lit, so the rule is shown rather than explained
 * and there is no wrong move to refuse. No dragging, no hidden gesture; the bar
 * at the foot says where you are and how to leave.
 */
/**
 * How long a finger must rest on a line before it offers to go — the same
 * pause a card asks for before it comes loose, so the drawing answers to one
 * gesture throughout.
 */
const HOLD = 260;

/** How far either side of a stroke a finger still counts as on it. */
const GRASP = 11;

/**
 * Every gesture the drawing answers to, in the order one meets them.
 *
 * Written out because none of them is announced by a button any more: the
 * tree lost its mode and its banner, which is what made it quiet, and a quiet
 * interface owes the reader one page saying what it can do.
 */
/**
 * L'aide, posée comme on se la pose.
 *
 * Elle listait des gestes — « rester appuyé », « le + à droite » — ce qui
 * suppose qu'on ait déjà remarqué le geste et qu'on cherche ce qu'il fait.
 * Or on ouvre un `i` dans l'autre sens : on sait ce qu'on veut faire et on
 * cherche par où. Les questions d'abord, donc, et dans l'ordre où elles
 * viennent — on peuple l'arbre avant de le relier.
 *
 * **Chaque réponse commence par un verbe à l'impératif**, et ce n'est pas une
 * coquetterie : qui pose la question veut savoir quoi faire de ses doigts, et
 * le premier mot doit le lui dire. Ce qui suit la première phrase explique ;
 * ce qui la commence agit.
 */
const HELP: { question: string; answer: string }[] = [
  {
    question: "Comment ajouter un personnage ?",
    answer:
      "Touchez le + au bout d'une ligne pour ajouter un personnage à cette génération. Les deux + sur des lignes vides, en haut et en bas de votre arbre , permettent d'ajouter un personnage à une nouvelle génération",
  },
  {
    question: "Comment marier deux personnages ?",
    answer:
      "Restez appuyé sur un des deux personnages. Puis relâchez et cliquez sur le + à droite de la carte, puis choisissez un des personnages disponibles (sur la même ligne et non déjà marié)",
  },
  {
    question: "Comment déclarer un enfant ?",
    answer:
      "Restez appuyé sur un des parents. Puis relâchez et cliquez le + sous une carte, puis choisissez quelqu'un de la ligne du dessous. Si le parent est marié, l'enfant est celui du couple et le trait part du milieu de la barre.",
  },
  {
    question: "Comment effacer un lien ?",
    answer:
      "Restez appuyé sur le trait. Effacer un mariage efface les enfants de ce mariage",
  },
  {
    question: "Comment retirer quelqu'un de l'arbre ?",
    answer:
      "Restez appuyé sur sa carte : le menu qui s'ouvre permet de l'en retirer. Il reste néanmoins dans votre collection.",
  },
  {
    question: "Comment rendre quelqu'un plus ou moins visible ?",
    answer:
      "Restez appuyé sur sa carte, puis choisissez discret, normal ou majeur",
  },
  {
    question: "Comment déplacer quelqu'un dans sa ligne ?",
    answer:
      "Restez appuyé, puis glissez. À noter que déplacer un personnage déplacera son couple s'il est marié",
  },
  {
    question: "Comment ouvrir la fiche de quelqu'un ?",
    answer:
      "Touchez sa carte : sa fiche descriptive s'ouvrira",
  },
  {
    question: "Comment me déplacer dans le dessin ?",
    answer:
      "Faites glisser un doigt pour déplacer le papier, deux pour zoomer.",
  },
];

export function TreeBuilder({
  tree,
  onClose,
  onOpenEvent,
  onOpenTree,
  onEditPerson,
  onNewPerson,
  onSeekPerson,
  hidden = false,
  active = true,
}: TreeBuilderProps) {
  const insets = useSafeAreaInsets();
  const {
    characters,
    addToTree,
    editTreeMember,
    eraseLink,
    linkInTree,
    orderRow,
    removeFromTree,
    removeTree,
    renameTree,
    share,
  } = useEvents();

  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * Whose placement menu is open, and at what scale it was opened.
   *
   * The zoom is captured rather than followed: the menu is drawn inside the
   * scaled canvas, so it is counter-scaled to stay legible, and a value read
   * once at the hold is steadier than one chasing a pinch nobody is making
   * while a menu is up.
   */
  const [placing, setPlacing] = useState<{ id: string; scale: number } | null>(
    null,
  );
  /**
   * What to do once the person's card is off the screen.
   *
   * Every way out of a tree closes two panels at once — the card, and the
   * drawing under it. Told to go at the same moment, iOS is asked to dismiss
   * a controller while it is still presenting another, and the screen locks
   * up: the map appears and nothing answers a touch. So the card leaves
   * first, says when it has gone, and the tree follows.
   */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  /**
   * Closes the card, then takes the way out it asked for.
   *
   * `setLeaving` is handed a function that *returns* the deed: React would
   * otherwise take a function given to a setter as an updater.
   */
  const leaveFor = (deed: () => void) => {
    setLeaving(() => deed);
    setOpenId(null);
  };
  /** Which face the ··· card is showing, if it is open at all. */
  const [menu, setMenu] = useState<
    "menu" | "delete" | "help" | null
  >(null);
  /** Le nom en cours de frappe, sur la carte « Modifier ». */
  const [name, setName] = useState("");
  const { say, dialog } = useNotice();
  /**
   * Who is being joined to whom, while the picker is open.
   *
   * The two crosses on a held card start this: one asks for a spouse on the
   * same row, the other for a child on the row below. It replaced a mode —
   * a button at the top that put the whole tree into a state and a banner at
   * the foot explaining it — with an offer made where the line would go.
   */
  const [joining, setJoining] = useState<{
    id: string;
    kind: "couple" | "descent";
  } | null>(null);
  /** The line a finger has rested on, waiting for a yes. */
  const [cutting, setCutting] = useState<{ from: string; to: string } | null>(
    null,
  );
  /** Which generation the picker is adding to. */
  const [adding, setAdding] = useState<number | null>(null);
  /**
   * La porte à ouvrir une fois le **sélecteur** descendu, s'il y en a une.
   *
   * Même raison que `leaving` plus haut, mais pour une autre feuille — et il
   * faut bien deux états, puisque deux `onClosed` différents les consomment.
   * iOS refuse de présenter une modale depuis une autre qui se retire, et ces
   * deux-là en sont.
   *
   * La question ne se posait pas tant que quitter l'arbre démontait tout le
   * sous-arbre : la feuille disparaissait d'un coup. L'arbre restant désormais
   * dessiné derrière la page qu'on ouvre, elle s'en va pour de bon — et il
   * faut l'attendre.
   */
  const [afterPicker, setAfterPicker] = useState<"new" | "seek" | null>(null);
  /**
   * La génération où reprendre, au retour du détour.
   *
   * Partir créer quelqu'un n'est pas quitter l'arbre : c'est aller chercher de
   * quoi remplir *cette* rangée-là. Revenir à l'arbre nu obligerait à
   * retrouver le bon `+` et à rouvrir la même fenêtre, alors que le fil n'a
   * jamais été rompu.
   *
   * Une référence et non un état : rien ne l'affiche, et un rendu de plus au
   * moment du départ n'apporterait que l'occasion de se tromper.
   */
  const errand = useRef<number | null>(null);

  /**
   * Rouvrir la fenêtre **au retour**, et seulement au retour.
   *
   * Le piège est que `active` ne dit pas « on revient » mais « l'arbre est la
   * page » — ce qui est vrai aussi à l'instant où l'on clique sur la porte,
   * avant d'être parti. Lu tel quel, l'effet rouvrait la fenêtre aussitôt
   * fermée, et la page qu'on allait ouvrir arrivait derrière.
   *
   * C'est donc le *passage* de faux à vrai qu'on guette, et non la valeur.
   */
  const wasActive = useRef(active);
  useEffect(() => {
    const returned = active && !wasActive.current;
    wasActive.current = active;
    if (!returned || errand.current === null) return;
    setAdding(errand.current);
    errand.current = null;
  }, [active]);
  const [busy, setBusy] = useState(false);
  /**
   * How much room the floating header takes.
   *
   * Measured rather than computed: it depends on the safe area and on the
   * font the reader has chosen. A number written here would be wrong on some
   * phone.
   */
  const [chrome, setChrome] = useState(0);

  /**
   * Shared with the window behind and with every card: one says "a card is
   * loose, keep your hands off", the other says how far the drawing is
   * zoomed. Refs rather than state, because both are read inside gesture
   * responders that are built once and never see a new render.
   */
  const dragging = useRef(false);
  const magnification = useRef(1);
  /** Where a card in the air would come to rest, while it is in the air. */
  const [landing, setLanding] = useState<{
    id: string;
    columns: number;
  } | null>(null);

  const placed = useMemo(() => (tree ? place(tree) : []), [tree]);
  const lines = useMemo(
    () => (tree ? connectors(tree, placed) : []),
    [tree, placed],
  );
  const size = useMemo(
    () => (tree ? canvasSize(tree) : { width: 0, height: 0 }),
    [tree],
  );

  if (!tree) return null;

  const rows = frame(tree);
  const columns = span(tree);
  const byId = new Map(characters.map((person) => [person.id, person]));
  const open = tree.members.find((member) => member.id === openId) ?? null;

  /**
   * Who this person may still be joined to, on each of the two lines.
   *
   * Computed rather than explained: the picker offers only the legal answers,
   * where the old mode lit the tree up and dimmed everyone out of reach. The
   * rules are the same ones — two to a couple, neither already married; a
   * child stands on the row below and is claimed once.
   */
  const spousesFor = (member: TreeMember): TreeMember[] =>
    spouses(tree, member.id).length > 0
      ? []
      : tree.members.filter(
          (other) =>
            other.id !== member.id &&
            other.generation === member.generation &&
            other.characterId !== member.characterId &&
            spouses(tree, other.id).length === 0,
        );

  const childrenFor = (member: TreeMember): TreeMember[] =>
    tree.members.filter(
      (other) =>
        other.generation === member.generation + 1 &&
        !hasLine(tree, member.id, other.id),
    );

  /**
   * The outline that shows where a card in the air would come to rest.
   *
   * Drawn for the **whole household**, because that is what travels: a spouse
   * dragged alone would land with their partner, and a mark under one of the
   * two would promise something the drop does not deliver.
   *
   * Computed from the same conversion the drop uses, so the card cannot land
   * anywhere but where this says.
   */
  const target = (() => {
    // Guarded rather than cleared: were a drag ever cut short by the canvas
    // changing meaning, a hollow left behind would have no way to explain
    // itself. Derived state cannot get stuck.
    if (landing === null) return null;
    const dragged = tree.members.find((one) => one.id === landing.id);
    if (!dragged) return null;

    const household =
      blocks(tree, dragged.generation).find((block) =>
        block.some((one) => one.id === dragged.id),
      ) ?? [];
    const first = household[0];
    if (!first) return null;

    return {
      left: columnX(first.position + landing.columns, columns),
      top: rowY(dragged.generation, rows) + CARD_TOP,
      width:
        household.length * NODE.width + (household.length - 1) * GAP.x,
      height: NODE.height - CARD_TOP,
    };
  })();

  const run = (work: Promise<unknown>) => {
    setBusy(true);
    void work
      .catch((cause: unknown) =>
        say(
          "Modification impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setBusy(false));
  };

  /**
   * Enregistre le nom s'il a changé, et seulement ça.
   *
   * Le champ est désormais dans la carte « Modifier » plutôt que derrière un
   * bouton « Renommer », donc il n'y a plus de moment où l'on *valide* : on
   * tape, puis on s'en va. L'enregistrement se raccroche aux deux façons de
   * s'en aller — la touche « terminé » du clavier, et la fermeture de la
   * carte. Un nom vide ou inchangé ne coûte aucune écriture.
   */
  const saveName = () => {
    const wanted = name.trim();
    if (wanted === "" || wanted === tree.name) return;
    run(renameTree(tree.id, wanted));
  };

  const tap = (member: TreeMember) => {
    // A tap anywhere puts the placement menu away, wherever it was open.
    setPlacing(null);
    setOpenId(member.id);
  };

  /**
   * Joins the held member to the one just chosen.
   *
   * A child of someone married belongs to **both** of them: the line is then
   * drawn from the middle of the marriage bar rather than from either spouse,
   * which is how a genealogist says "these two had this child" — and the only
   * reading that stays true if the pair is later read from the other side.
   */
  const join = (anchor: TreeMember, kind: "couple" | "descent", toId: string) => {
    const parents =
      kind === "descent"
        ? [anchor.id, ...spouses(tree, anchor.id)]
        : [anchor.id];

    run(
      (async () => {
        for (const from of kind === "couple" ? [anchor.id] : parents) {
          // A parent that already claims this child is left alone, so giving
          // the couple a child does not undo one of the two lines.
          if (hasLine(tree, from, toId)) continue;
          await linkInTree(tree.id, kind, from, toId, true);
        }
      })(),
    );
  };

  return (
    /**
     * A screen, not a dialogue — and that distinction is the whole of a bug
     * worth remembering.
     *
     * This was a `Modal`. Every way out of it then asked iOS to dismiss one
     * controller while another was being presented from it: the sheet the
     * reader came from, a person's card, the page a card led to. The screen
     * locked up and the app had to be restarted, and the callback meant to
     * sequence the hand-overs could not be relied on to arrive.
     *
     * Laid over the map instead, it presents nothing and dismisses nothing.
     * A card opened from here is a panel over the root, with nothing under it
     * in the middle of leaving, and closing the drawing is one state change.
     */
    <View style={[StyleSheet.absoluteFill, styles.root, hidden && styles.away]}>
      <View style={styles.root}>
        <PanZoom
          held={dragging}
          magnification={magnification}
          // Tapping the paper between the cards puts the placement menu away.
          // React skips the render when there was nothing open.
          onTouch={() => setPlacing(null)}
          content={size}
          // The foot of the screen is only occupied while a line is being
          // drawn; the rest of the time the canvas may use it.
          inset={{ top: chrome, bottom: insets.bottom + space.md }}
          subject={tree.id}
        >
        {/* Under the lines and the cards: a hollow, not an object. */}
        {target ? (
          <View style={[styles.landing, target]} pointerEvents="none" />
        ) : null}

        {lines.map(({ cut: _cut, ...box }, index) => (
          <View key={index} style={[styles.line, box]} pointerEvents="none" />
        ))}

        {/* What a finger can take hold of, over the lines that stand for one
            link and nothing else — see `Segment.cut`.

            Invisible and far wider than the stroke: two points of ink cannot
            be hit. Claiming the touch is safe because the window steals it
            back the moment the finger travels, which is what lets the drawing
            still be dragged from anywhere. */}
        {lines.flatMap(({ cut, ...box }, index) => {
          if (!cut) return [];
          const thin = box.width < box.height;
          return [
            <Pressable
              key={`cut-${index}`}
              accessibilityRole="button"
              accessibilityLabel="Supprimer ce lien"
              delayLongPress={HOLD}
              onPressIn={() => setPlacing(null)}
              onLongPress={() => {
                tapLifted();
                setCutting(cut);
              }}
              style={{
                position: "absolute",
                left: box.left - (thin ? GRASP : 0),
                top: box.top - (thin ? 0 : GRASP),
                width: box.width + (thin ? GRASP * 2 : 0),
                height: box.height + (thin ? 0 : GRASP * 2),
              }}
            />,
          ];
        })}

        {placed.map((node) => (
          <TreeNode
            key={node.member.id}
            member={node.member}
            person={byId.get(node.member.characterId)}
            x={node.x}
            y={node.y}
            onPress={() => tap(node.member)}
            menu={
              placing?.id === node.member.id
                ? {
                    scale: placing.scale,
                    // The top row has nothing above it but the chrome, so its
                    // menu opens downwards instead of off the drawing.
                    // `frame` keeps one spare row above the first member, so
                    // the topmost occupied generation is `from + 1`.
                    below: node.member.generation <= rows.from + 1,
                    onImportance: (importance) => {
                      setPlacing(null);
                      if (importance === node.member.importance) return;
                      run(
                        editTreeMember(tree.id, node.member.id, { importance }),
                      );
                    },
                    onRemove: () => {
                      setPlacing(null);
                      run(removeFromTree(tree.id, node.member.id));
                    },
                    // Both, always. `ready` only decides how they look —
                    // the picker is what explains an empty one.
                    couple: {
                      ready: spousesFor(node.member).length > 0,
                      onPress: () => {
                        setPlacing(null);
                        setJoining({ id: node.member.id, kind: "couple" });
                      },
                    },
                    descent: {
                      ready: childrenFor(node.member).length > 0,
                      onPress: () => {
                        setPlacing(null);
                        setJoining({ id: node.member.id, kind: "descent" });
                      },
                    },
                  }
                : undefined
            }
            drag={
              {
                held: dragging,
                    magnification,
                    onStart: () => {
                      setOpenId(null);
                      // The hold does both: the card comes loose *and* the
                      // menu opens. Whichever the reader meant, the next
                      // moment tells us — moving drops the menu, letting go
                      // keeps it.
                      setPlacing({
                        id: node.member.id,
                        scale: 1 / magnification.current,
                      });
                      setLanding({ id: node.member.id, columns: 0 });
                    },
                    onWander: () => setPlacing(null),
                    onMove: (columns) =>
                      setLanding({ id: node.member.id, columns }),
                    onDrop: (columns) => {
                      setLanding(null);
                      if (columns === 0) return;
                      const moves = dropAt(
                        tree,
                        node.member,
                        node.member.position + columns,
                      );
                      if (moves.length > 0) run(orderRow(tree.id, moves));
                    },
              }
            }
          />
        ))}

        {/* One slot closing every row, the two empty ones included —
            which is how a generation is added above or below without a
            button anywhere else to explain it. */}
        {Array.from(
          { length: rows.to - rows.from + 1 },
          (_, index) => rows.from + index,
        ).map((generation) => (
          <Pressable
            key={generation}
            accessibilityRole="button"
            accessibilityLabel={
              rowCount(tree, generation) === 0
                ? "Ajouter une génération"
                : "Ajouter à cette génération"
            }
            disabled={busy}
            onPress={() => {
              setPlacing(null);
              setAdding(generation);
            }}
            style={({ pressed }) => [
              styles.slot,
              pressed && styles.pressed,
              {
                left: columnX(nextColumn(tree, generation), columns),
                top: rowY(generation, rows),
              },
            ]}
          >
            <Text style={styles.slotGlyph}>+</Text>
          </Pressable>
        ))}
        </PanZoom>

        {/* Header and the button under it are measured together: what the
            canvas must stay clear of is the whole of it. */}
        <View
          style={styles.top}
          // Read before the updater runs: a functional setState is called on
          // the next render, by which time React Native has recycled the
          // synthetic event and nulled its `nativeEvent`.
          onLayout={(event) => setChrome(event.nativeEvent.layout.height)}
        >
          <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
            {/* Two sides of the same width, so the title prints in the middle
                of what is left. */}
            <View style={styles.side}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retour"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
              >
                <Text style={styles.backGlyph}>‹</Text>
              </Pressable>
            </View>

            <Text style={styles.title} numberOfLines={1}>
              {tree.name}
            </Text>

            <View style={[styles.side, styles.sideRight]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Options de l'arbre"
                hitSlop={8}
                onPress={() => {
                  setPlacing(null);
                  setName(tree.name);
                  setMenu("menu");
                }}
                style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
              >
                <Text style={styles.moreGlyph}>···</Text>
              </Pressable>
            </View>
          </View>

        </View>

        {/* Le `i`, posé sur le dessin plutôt que dans l'en-tête.

            Dans la barre, il voisinait avec le retour et les ···, et les trois
            se lisaient comme un même rang de commandes alors qu'il ne commande
            rien : il explique le dessin. Posé dessus, au coin de ce qu'il
            explique, il dit de quoi il parle sans l'écrire.

            `chrome` est la hauteur mesurée de la barre — la même dont le
            dessin se tient à l'écart — pour qu'il n'y ait jamais deux idées
            de l'endroit où l'en-tête s'arrête. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comment ça marche"
          // La pastille fait 28 ; ceci ramène la cible à 44, le minimum au
          // doigt. Rapetisser le dessin ne doit pas rapetisser la prise.
          hitSlop={8}
          onPress={() => {
            setPlacing(null);
            setMenu("help");
          }}
          style={({ pressed }) => [
            styles.helpButton,
            { top: chrome + space.md },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.helpGlyph}>i</Text>
        </Pressable>

        {/* Qui faire entrer dans cette génération.

            C'est **la liste de la fenêtre Personnages**, et non une qui lui
            ressemble : le même composant, donc le même compte, les deux mêmes
            portes et les mêmes lignes. Elle avait été refaite ici en liste de
            choix nue, et les deux avaient commencé à diverger.

            Les indisponibles restent affichés, grisés et hors d'atteinte. Les
            escamoter, comme on le faisait, laissait chercher un nom qui était
            pourtant là et faisait croire la liste plus courte qu'elle n'est. */}
        <Sheet
          visible={adding !== null}
          onClose={() => setAdding(null)}
          onClosed={() => {
            if (afterPicker === null) return;
            const door = afterPicker;
            setAfterPicker(null);
            if (door === "new") onNewPerson();
            else onSeekPerson();
          }}
          title={
            adding !== null && rowCount(tree, adding) === 0
              ? "Ajouter une génération"
              : "Ajouter à cette génération"
          }
          tall
          footer={
            <InkButton
              label="Fermer"
              variant="solid"
              grow
              onPress={() => setAdding(null)}
            />
          }
        >
          <CharacterManager
            onPick={(person) => {
              if (adding === null) return;
              run(addToTree(tree.id, person.id, adding));
              setAdding(null);
            }}
            unavailable={(person) =>
              // Quelqu'un peut se tenir deux fois sur une rangée — un homme
              // est dessiné une fois près de chacune de ses femmes — mais
              // jamais sur deux, ce qui ferait de lui son propre aïeul.
              tree.members.some(
                (member) =>
                  member.characterId === person.id &&
                  member.generation !== adding,
              )
                ? "déjà à une autre génération"
                : null
            }
            // Descendre d'abord, ouvrir ensuite : `onClosed` ci-dessus s'en
            // charge une fois la feuille réellement partie.
            onSeek={() => {
              errand.current = adding;
              setAfterPicker("seek");
              setAdding(null);
            }}
            onEdit={() => {
              errand.current = adding;
              setAfterPicker("new");
              setAdding(null);
            }}
            // Jamais appelé en mode choix, mais la propriété est requise :
            // une rangée refusée ne rend rien, une rangée libre rend `onPick`.
            onRead={() => {}}
          />
        </Sheet>

        {/* The picker the two crosses open: who to marry, or whose parent to
            become. Only members of this tree — putting someone *into* the
            tree is the slot at the end of a row, and one door per job. */}
        <SelectField
          title={
            joining?.kind === "couple" ? "Marier à" : "Donner pour enfant"
          }
          placeholder=""
          options={(() => {
            const anchor = joining
              ? (tree.members.find((one) => one.id === joining.id) ?? null)
              : null;
            if (!anchor || !joining) return [];
            const candidates =
              joining.kind === "couple"
                ? spousesFor(anchor)
                : childrenFor(anchor);
            return candidates.map((one) => {
              const person = byId.get(one.characterId);
              const dates = person ? lifespan(person) : "";
              const said = person?.name ?? "Personnage supprimé";
              return {
                value: one.id,
                label: dates === "" ? said : `${said} · ${dates}`,
              };
            });
          })()}
          selected={[]}
          single={joining?.kind === "couple"}
          onToggle={(memberId) => {
            const anchor = joining
              ? (tree.members.find((one) => one.id === joining.id) ?? null)
              : null;
            if (!anchor || !joining) return;
            join(anchor, joining.kind, memberId);
            // A marriage is between two and the picker is done; children come
            // in families, so that one stays open for the next.
            if (joining.kind === "couple") setJoining(null);
          }}
          emptyMessage={
            joining?.kind === "couple"
              ? "Personne d'autre n'est libre sur cette ligne. Ajoutez quelqu'un au bout du rang, ou défaites un mariage."
              : "Personne à prendre pour enfant sur la ligne du dessous. Ajoutez-y d'abord quelqu'un, au bout du rang."
          }
          onClose={() => setJoining(null)}
          trigger={(openPicker) => (
            <Opener open={openPicker} when={joining !== null} />
          )}
        />

        {/* Held down on a line, and answered here. What goes with it is said
            before the yes, never after: erasing a marriage takes the children
            of that marriage with it — see `erasure`. */}
        <ConfirmDialog
          visible={cutting !== null}
          title="Supprimer ce lien ?"
          message={(() => {
            if (!cutting) return undefined;
            const going = erasure(tree, cutting.from, cutting.to);
            const also = going.length - 1;
            return also <= 0
              ? "Les personnages restent en place ; seul le trait disparaît."
              : `Les personnages restent en place, mais ${also} autre${also > 1 ? "s" : ""} trait${also > 1 ? "s" : ""} en dépend${also > 1 ? "ent" : ""} et s'effacera${also > 1 ? "ont" : ""} avec lui.`;
          })()}
          confirmLabel="Supprimer"
          onConfirm={() => {
            const line = cutting;
            setCutting(null);
            if (line) run(eraseLink(tree.id, line.from, line.to));
          }}
          onClose={() => setCutting(null)}
        />

        {/* Une carte, trois faces — ce qu'on modifie, la confirmation, et ce
            que fait chaque geste. Elle en avait quatre : le nom vivait sur la
            sienne, derrière un bouton « Renommer », pour une seule ligne de
            texte. Il est revenu dans la première.
            Jamais une seconde carte par-dessus la première : iOS refuse de
            présenter une modale depuis une autre qui en présente déjà une, et
            le bouton qui l'ouvre semblerait ne rien faire. */}
        <Dialog
          visible={menu !== null}
          onClose={() => {
            // Fermer, c'est aussi enregistrer : il n'y a pas de bouton pour
            // le faire, et un nom tapé puis perdu serait pire que tout.
            saveName();
            setMenu(null);
          }}
          title={
            menu === "delete"
              ? `Supprimer « ${tree.name} » ?`
              : menu === "help"
                ? "Comment ça marche"
                : "Modifier"
          }
          hint={
            menu === "delete"
              ? tree.origin === null
                ? "Les personnages restent dans la collection ; seul l'arbre disparaît."
                : "Les personnages restent dans la collection, et vous n'effacez que votre copie : celui de son auteur n'est pas touché."
              : menu === "help"
                ? "Toutes les possibilités pour construire votre arbre"
                : undefined
          }
          dismissLabel={menu === "menu" || menu === "help" ? null : "Retour"}
          onDismiss={() => setMenu("menu")}
        >
          {menu === "help" ? (
            <ScrollView style={styles.helpBody}>
              <View style={styles.help}>
                {HELP.map((entry) => (
                  <View key={entry.question} style={styles.gesture}>
                    <Text style={styles.gestureDoing}>{entry.question}</Text>
                    <Text style={styles.gestureMeans}>{entry.answer}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : menu === "delete" ? (
            <InkButton
              label="Supprimer"
              variant="solid"
              tone="danger"
              disabled={busy}
              onPress={() => {
                setMenu(null);
                run(removeTree(tree.id).then(onClose));
              }}
            />
          ) : (
            <>
              {/* Le nom, modifiable sur place. Pas de bouton pour valider :
                  voir `saveName`. Pas d'`autoFocus` non plus — ouvrir cette
                  carte, c'est le plus souvent venir partager ou supprimer, et
                  un clavier qui jaillit recouvrirait les deux. */}
              <InkField
                label="Nom de l'arbre"
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                onSubmitEditing={saveName}
              />

              {/* No `locked` here, and that is the exception rather than an
                  omission: every other kind of copy is barred from the
                  community to keep it free of duplicates, but a copied tree
                  is a starting point — branches get added, filiations
                  corrected — and what it becomes is the reader's own work,
                  worth offering back. See `whyLocked`. */}
              <ShareRow
                what="cet arbre"
                shared={tree.shared}
                onChange={(next) => share("tree", tree.id, next)}
              />
              <InkButton
                label="Supprimer l'arbre"
                variant="solid"
                tone="danger"
                onPress={() => setMenu("delete")}
              />
            </>
          )}
        </Dialog>

        {dialog}

        {/* The same page the map opens. What belongs to the *placement* —
            the weight, and whether they stand here at all — is held down for
            instead, which is why the sheet this replaced is gone. */}
        <CharacterDetailModal
          key={open?.id ?? "none"}
          person={open ? (byId.get(open.characterId) ?? null) : null}
          // The tree being drawn is not offered as somewhere to go: the
          // reader is already in it, and "open it" would mean closing this
          // drawing to open the same one again.
          exceptTree={tree.id}
          onEdit={(person) => leaveFor(() => onEditPerson(person.id))}
          onOpenEvent={(id) => leaveFor(() => onOpenEvent(id))}
          onOpenTree={(id) => leaveFor(() => onOpenTree(id))}
          onClose={() => setOpenId(null)}
          onClosed={() => {
            if (leaving === null) return;
            const deed = leaving;
            setLeaving(null);
            deed();
          }}
        />
      </View>
    </View>
  );
}

/** Does this member already claim that one as their child? */
function hasLine(tree: Tree, parentId: string, childId: string): boolean {
  return tree.links.some(
    (link) =>
      link.kind === "descent" && link.from === parentId && link.to === childId,
  );
}

/**
 * Opens the picker when the canvas asks, and renders nothing.
 *
 * `SelectField` owns the sheet and the list; all this needs is a way in that
 * is not a grey field sitting in the middle of a drawing. In an effect and not
 * during the render: calling the parent's setter while rendering a child is
 * exactly the update-during-render React refuses.
 */
function Opener({ open, when }: { open: () => void; when: boolean }) {
  useEffect(() => {
    if (when) open();
    // `open` is rebuilt every render; following it would reopen endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when]);
  return null;
}

const SLOT = 72;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.paper },
  /** Hors de vue, toujours en mémoire — voir la propriété `hidden`. */
  away: { display: "none" },
  line: { position: "absolute", backgroundColor: palette.inkSoft },
  /**
   * Dashed and empty, in wax: the colour the app keeps for "this is where you
   * are". An outline rather than a filled shape, so it reads as a place being
   * held open and not as another card.
   */
  landing: {
    position: "absolute",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.wax,
    backgroundColor: palette.paperDeep,
  },
  slot: {
    position: "absolute",
    width: SLOT,
    height: SLOT,
    // Placed from the corner of a node box, then nudged onto the portrait
    // axis: the `+` belongs on the same line as the faces of its generation.
    marginLeft: (NODE.width - SLOT) / 2,
    marginTop: FACE_AXIS - SLOT / 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SLOT / 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.inkFaint,
  },
  slotGlyph: { fontSize: 24, lineHeight: 28, color: palette.inkSoft },
  pressed: { opacity: 0.55 },

  top: { position: "absolute", left: 0, right: 0, top: 0 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.paperLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  title: {
    flex: 1,
    ...type.heading,
    fontWeight: "700",
    color: palette.ink,
    textAlign: "center",
  },
  /** Equal on both sides, so the title between them sits in the middle. */
  side: { flexDirection: "row", width: TOUCH * 2 },
  sideRight: { justifyContent: "flex-end" },
  icon: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  backGlyph: { fontSize: 34, lineHeight: 38, color: palette.ink, marginTop: -4 },
  moreGlyph: { fontSize: 22, lineHeight: 26, color: palette.ink, marginTop: -6 },
  /** Tall enough for the list, short enough that the card stays a card. */
  helpBody: { maxHeight: 400 },
  help: { gap: space.md, paddingBottom: space.xs },
  gesture: { gap: 2 },
  gestureDoing: { fontSize: 15, fontWeight: "700", color: palette.ink },
  gestureMeans: { ...type.caption, color: palette.inkSoft },

  /**
   * Le `i`, flottant au coin du dessin.
   *
   * En cire, comme tout ce que l'application offre de toucher, et avec le même
   * bord coupé que les disques de la carte. Petit — vingt-huit points contre
   * les quarante-quatre d'un bouton ordinaire — parce qu'il ne se cherche que
   * la première fois : au-dessus d'un dessin qu'on veut voir, une pastille
   * discrète suffit, et le `hitSlop` garde la cible à la bonne taille pour le
   * doigt.
   */
  helpButton: {
    position: "absolute",
    right: space.lg,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.wax,
    borderWidth: 1.5,
    borderColor: palette.waxDeep,
    ...shadow.soft,
  },

  /** A serif i: the mark a plate uses for a note in the margin. */
  helpGlyph: {
    ...type.plate,
    fontSize: 15,
    lineHeight: 18,
    color: palette.paperLight,
  },

});
