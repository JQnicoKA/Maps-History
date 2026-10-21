import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as api from "./api";
import { fetchStale, refreshFromLibrary, type Stale } from "./updates";
import { LOOKS } from "./looks";
import { SharedCard } from "./SharedCard";
import { windowed } from "./trail";
import { ThingRow } from "./ThingRow";
import {
  ANYTHING,
  REASONS,
  type Cursor,
  type Kind,
  type Look,
  type Ordering,
  type Reason,
  type Search,
  type SharedThing,
} from "./types";
import {
  Chip,
  ConfirmDialog,
  InkButton,
  InkField,
  Sheet,
  useNotice,
} from "../../components/ui";
import { DateWheels } from "../events/components/EventDateField";
import {
  PhotoViewer,
  type Shown,
} from "../events/components/PhotoViewer";
import { TreePreview } from "../genealogy/TreePreview";
import type { Face } from "../genealogy/TreeFace";
import { asLabelWidth, type Tree, type TreeMember } from "../events/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEvents } from "../events/EventsProvider";
import { formatHistoricalDate } from "../events/historicalDate";
import { widthsFor } from "./period";
import { usePlacement } from "../placement";
import { ANSWER_WITHIN, CONTACT } from "../../config/contact";
import { palette } from "../../theme/palette";

/**
 * Le bandeau du panneau, comme ceux des trois feuilles d'écriture.
 *
 * Elle se termine par une vague blanche qui rend la page au papier du
 * panneau — c'est pour cela qu'elle vit en haut d'un panneau blanc et nulle
 * part ailleurs.
 */
const BANNER = require("../../../assets/banniere_bibliotheque.png");

/** Un glyphe par face de la carte de réglage — voir `Dialog`, qui fait de même. */
const SORT_ICON = require("../../../assets/icons/sort.png");
const FILTER_ICON = require("../../../assets/icons/filter.png");
const ERA_ICON = require("../../../assets/icons/era.png");
import { BACKDROP, radius, shadow, space, type } from "../../theme/tokens";

/** Where a rising card starts from: below the panel, whatever its height. */
const OFFSCREEN = Dimensions.get("window").height;

const SORTS: {
  value: Ordering;
  label: string;
  /** Said on the button, where there is room for one word. */
  said: string;
  /** And why one would want it, on the card where there is room to say. */
  why: string;
  mark: string;
}[] = [
  {
    value: "stars",
    label: "Les plus copiés",
    said: "étoiles",
    why: "Les éléments que la communauté a le plus copié depuis la bibliothèque",
    mark: "★",
  },
  {
    value: "recent",
    label: "Les plus récents",
    said: "récents",
    why: "Les derniers éléments ajoutés à la bibliothèque",
    mark: "◷",
  },
  {
    value: "oldest",
    label: "Ordre chronologique",
    said: "chronologique",
    /* Le temps du récit, et non celui de l'écriture — c'est tout ce qui le
       sépare du tri au-dessus, et il faut le dire, les deux étant des
       dates. */
    why: "Les éléments du plus ancien au plus récent",
    mark: "↑",
  },
];

export type CatalogueProps = {
  kind: Kind;
  look: Look;
  visible: boolean;
  /**
   * L'entrée à ouvrir d'emblée, carte en avant, sans passer par la liste.
   *
   * Pour « Voir » : une notification et le formulaire d'un exemplaire en
   * retard mènent ici, sur la version que la bibliothèque a corrigée. On
   * arrive pour lire *celle-là* et pas pour chercher.
   */
  open?: string | null;
  onClose: () => void;
  /** Fired once the panel is off the screen — see `Sheet`. */
  onClosed?: () => void;
};

/**
 * What everybody else has written, and a way to take some of it.
 *
 * The catalogue is not the collection and is deliberately not drawn like it:
 * every line carries a name that is not yours and a count of how many readers
 * found it worth keeping. Those two are the whole difference between a list
 * of things and a history written by many hands.
 *
 * Two faces rather than two panels — the list, and one event read whole.
 * iOS will not present a sheet from a sheet that is already presenting one,
 * and the app has settled on turning a card over instead of stacking cards.
 *
 * The filters lean on what the reader is already doing: "cette époque" is the
 * century the frieze has come to rest on, "cette région" is what the plate is
 * centred over. A form asking for four numbers would be answered by nobody.
 */
export function Catalogue({
  kind,
  look,
  visible,
  open = null,
  onClose,
  onClosed,
}: CatalogueProps) {
  const { year, refresh } = useEvents();
  const { aiming, placeRegion, showShape, looking } = usePlacement();
  const insets = useSafeAreaInsets();
  const { say, dialog } = useNotice();

  const [search, setSearch] = useState<Search>(ANYTHING);
  const [rows, setRows] = useState<SharedThing[]>([]);
  const [loading, setLoading] = useState(false);
  const [drained, setDrained] = useState(false);
  /**
   * What is being read, and what it was reached from.
   *
   * A stack rather than one thing, because a tree's card lists its people
   * and those have to be openable — nobody takes twenty-seven lives on the
   * strength of their names. "Retour" then means one step back to the tree,
   * not all the way out to the list.
   */
  const [trail, setTrail] = useState<{ kind: Kind; thing: SharedThing }[]>([]);
  const reading = trail[trail.length - 1] ?? null;
  /** Drawn as the thing it is, not as the thing that held it. */
  const readingLook = reading === null ? look : LOOKS[reading.kind];

  /**
   * How far off the bottom the card being read is.
   *
   * It rises on every step deeper — the list to a tree, the tree to one of
   * its people — because that is what the gesture said: something has
   * come forward. Going back sends it down and only then pops the trail, so
   * the card is seen leaving rather than blinking out.
   */
  const rise = useRef(new Animated.Value(OFFSCREEN)).current;
  /**
   * True while a card is on its way down.
   *
   * The buttons at the foot belong to whatever the reader is arriving at,
   * not to what is still leaving: waiting for the slide to end made them
   * change once the card had already gone. Told at the moment "Retour" is
   * pressed, they change with the gesture and the card finishes travelling
   * under them.
   */
  const [descending, setDescending] = useState(false);

  /**
   * Whether the buttons at the foot belong to a card.
   *
   * On the way down it looks at where the step lands: back out of a person
   * opened inside a tree returns to the tree, so they stay the
   * card's; back out of the last one returns to the list, so "Fermer" comes
   * back — with the gesture, not after the slide.
   */
  const atCard = descending ? trail.length > 1 : trail.length > 0;

  const rose = useRef(0);
  /**
   * Laid out before the frame is drawn, not after it.
   *
   * As a passive effect this ran *after* the new card had been committed, so
   * one frame showed it sitting at its final position before it jumped
   * offscreen and sprang back up. That flash was always there and was always
   * invisible: the card used to carry the previous thing's body, so the
   * flashed frame looked exactly like the card already on screen. Mounting a
   * fresh card per step made it flash an empty one instead, which is the
   * stutter a reader notices. A layout effect puts the starting position in
   * the same commit as the card.
   */
  useLayoutEffect(() => {
    if (trail.length === 0) {
      rose.current = 0;
      return;
    }
    // Only a step deeper travels. Coming back to a tree from one of its
    // people, the tree is already there and should not be thrown down and
    // hauled up again.
    const deeper = trail.length > rose.current;
    rose.current = trail.length;
    if (!deeper) {
      // Back at rest, and this is load-bearing now that the trail stays
      // mounted: the card that just left was carrying `rise` at OFFSCREEN,
      // and the parent inherits that transform the moment it becomes the top
      // of the stack. Put back in the same commit as the pop, so the parent
      // is never painted off the bottom of the screen.
      rise.setValue(0);
      return;
    }
    rise.setValue(OFFSCREEN);
    Animated.spring(rise, {
      toValue: 0,
      damping: 26,
      stiffness: 240,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [trail.length, rise]);

  /**
   * One step back: the top card leaves, and what it came from is revealed.
   *
   * Nothing is rebuilt. The parent has been mounted underneath the whole
   * time, with what it read and where it was scrolled, so this is a card
   * sliding off something rather than a card being replaced. Popping only
   * after the slide is what keeps it on screen while it travels; the layout
   * effect above puts `rise` back for whoever becomes the top.
   */
  const back = () => {
    if (descending) return;
    setDescending(true);
    Animated.timing(rise, {
      toValue: OFFSCREEN,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      setDescending(false);
      if (finished) setTrail((was) => was.slice(0, -1));
    });
  };
  const [taking, setTaking] = useState<string | null>(null);
  /**
   * Which of the four faces is up.
   *
   * Faces and not panels: a sheet cannot present a sheet, and turning a card
   * over is what the rest of the app does with the same problem.
   */
  const [face, setFace] = useState<"list" | "report">("list");
  /**
   * Which setting is open over the panel, if either.
   *
   * A card laid on the sheet rather than a face of it: two choices and a pair
   * of wheels do not deserve the whole screen, and the list underneath is
   * what the settings are about — seeing it behind them is the point.
   *
   * Drawn **inside** the sheet and not as a modal of its own, which is the
   * whole reason it can exist: the region filter sends the reader to the map,
   * and a modal presented over this panel would be dismissed along with it —
   * that is the freeze the tree cost us.
   */
  /**
   * Quelle carte est posée sur le panneau, s'il y en a une.
   *
   * **`era` est une carte à elle seule, et c'était un dépliement.** Le réglage
   * d'époque s'ouvrait dans la carte des filtres : les roues, la date, les
   * largeurs et la sortie s'ajoutaient d'un coup sous leur étiquette, et la
   * carte grandissait de moitié sous le doigt. Ce qui est perturbant n'est
   * pas la taille mais le mouvement — on a touché une ligne, et c'est le
   * cadre entier qui a bougé. Une seconde carte ne bouge pas : elle arrive.
   */
  const [sifting, setSifting] = useState<"sort" | "filters" | "era" | null>(
    null,
  );
  /**
   * A genealogy being looked at, drawn over the panel.
   *
   * Not a card and not the map: a lineage of forty across six generations
   * needs room, and the sheet is already most of the screen. Fetched on the
   * tap rather than carried in the row — unlike a territory's outline, a
   * whole tree is too much to send for every line of a list.
   */
  const [drawn, setDrawn] = useState<{
    thing: SharedThing;
    tree: Tree;
    faces: Map<string, Face>;
  } | null>(null);
  /**
   * La photographie qu'on regarde en grand, s'il y en a une.
   *
   * Tenue ici et non dans la fiche, pour la même raison que l'arbre juste
   * au-dessus : une photographie plein écran doit couvrir l'en-tête de la
   * feuille et son pied, ce qu'une vue montée dans la fiche ne peut pas faire.
   */
  const [viewing, setViewing] = useState<Shown | null>(null);
  /**
   * La copie demandée, pas encore faite.
   *
   * Toutes les portes vers la copie passent par là — le pied d'une fiche, le
   * bouton d'une ligne, le bouton de la carte, celui du dessin d'arbre. Elles
   * **demandaient** quatre fois la même chose sans jamais dire ce qu'une copie
   * fait : ce qui vient avec, ce qui reste à la bibliothèque, et qu'elle ne
   * pourra pas y repartir. Un geste irréversible qui s'explique
   * après coup ne s'explique pas.
   *
   * Le genre est porté avec la chose : une copie peut partir d'un personnage
   * ouvert depuis un arbre, donc deux genres plus loin que la liste.
   */
  const [asking, setAsking] = useState<{
    one: SharedThing;
    kind: Kind;
  } | null>(null);

  /**
   * Whether the era's wheels are out.
   *
   * Closed, the row says one thing: "Toute l'histoire", or the period that
   * was set. A date and the words "toute l'histoire" on screen at once
   * contradict each other, which is what this replaced.
   */
  const [why, setWhy] = useState<Reason>("offensive");
  const [said, setSaid] = useState("");

  /**
   * Which request is the current one.
   *
   * Typing fires a search per keystroke's worth of pause, and the answers do
   * not come back in the order they were asked. Without this, a slow early
   * page can land after a fast later one and show the wrong list.
   */
  const asked = useRef(0);

  const fetchPage = useCallback(
    async (from: Cursor) => {
      const mine = ++asked.current;
      setLoading(true);
      try {
        const page = await api.search(kind, search, from);
        if (asked.current !== mine) return;
        setRows((current) => (from === null ? page : [...current, ...page]));
        setDrained(page.length < api.PAGE);
      } catch (cause) {
        if (asked.current !== mine) return;
        say(
          "Recherche impossible",
          cause instanceof Error ? cause.message : String(cause),
        );
      } finally {
        if (asked.current === mine) setLoading(false);
      }
    },
    // `say` is rebuilt on every render; following it would search endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, search],
  );

  // A pause before asking: a search per keystroke is a search per keystroke.
  useEffect(() => {
    if (!visible) return;
    const waiting = setTimeout(() => void fetchPage(null), 250);
    return () => clearTimeout(waiting);
  }, [visible, fetchPage]);

  /**
   * Arrivé par « Voir » : la carte demandée monte d'emblée.
   *
   * La liste se charge quand même derrière — c'est elle qu'on retrouve en
   * reculant, et sans elle « Retour » laisserait un panneau vide.
   */
  useEffect(() => {
    if (!visible || open === null) return;
    let alive = true;
    void api
      .fetchWhole(kind, open)
      .then((found) => {
        if (!alive || found === null) return;
        setTrail([{ kind, thing: found }]);
      })
      .catch(() => {
        // Muette : la liste est là, et une entrée retirée entre la
        // notification et le geste n'est pas une panne à annoncer.
      });
    return () => {
      alive = false;
    };
  }, [visible, open, kind]);

  /**
   * Ce que ce lecteur détient et que la bibliothèque a corrigé depuis.
   *
   * Demandé ici plutôt que reçu du parent, pour la même raison que dans
   * `UpdateRow` : la question ne coûte qu'une requête, elle revient presque
   * toujours vide, et un état de plus à tenir à jour dans l'application
   * coûterait davantage. Ce qu'elle décide est le bouton du pied — « Déjà
   * copié » est faux quand ce qu'on détient est en retard.
   */
  const [behind, setBehind] = useState<Stale[]>([]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void fetchStale()
      .then((all) => {
        if (alive) setBehind(all);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible]);

  /** L'exemplaire en retard de ce qu'on lit, s'il y en a un. */
  const stale =
    reading === null
      ? null
      : (behind.find((one) => one.entry === reading.thing.id) ?? null);
  /** Celui dont on vient de demander la reprise, le temps de la confirmer. */
  const [updating, setUpdating] = useState<Stale | null>(null);

  /**
   * The two filters open on what the reader is already looking at.
   *
   * Seeded rather than fixed: the field shows the year of the frieze and the
   * point the plate is centred over, and both can then be moved. Nothing is
   * narrowed until a width is chosen, so seeding changes no results.
   */
  useEffect(() => {
    if (!visible) return;
    setSearch((was) => ({
      ...was,
      at: was.at ?? (year === null ? null : { year: Math.trunc(year) }),
      near: was.near ?? looking.current,
    }));
    // Once, on opening: following the frieze would move the filter under the
    // reader while they were setting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const report = () => {
    const one = reading?.thing;
    if (!one) return;
    setTaking(one.id);
    void api
      .report(reading.kind, one.id, why, said)
      .then(() => {
        setRows((current) =>
          current.map((row) =>
            row.id === one.id ? { ...row, reported: true } : row,
          ),
        );
        setTrail((was) =>
          was.map((step) =>
            step.thing.id === one.id
              ? { ...step, thing: { ...step.thing, reported: true } }
              : step,
          ),
        );
        setFace("list");
        setSaid("");
        say(
          "Signalement envoyé",
          `Nous le regardons sous ${ANSWER_WITHIN}. Vous pouvez aussi nous écrire à ${CONTACT}.`,
        );
      })
      .catch((cause: unknown) =>
        say(
          "Signalement impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  /**
   * How many of the two filters are doing something, for the button.
   *
   * **Both halves, for both filters.** A point alone narrows nothing — the
   * query sends `within_m: null` without a radius, exactly as it sends no
   * era without a width — and the panel opens with a point already seeded on
   * whatever the plate is centred over. Testing `near` alone therefore lit
   * the Filtres chip and counted « 1 » on every single opening, over a row
   * that read « Partout ». The seeding effect's own comment promises that
   * nothing is narrowed until a width is chosen; this is what keeps it.
   */
  const era = search.span !== null && search.at !== null;
  const region = search.near !== null && search.withinMetres !== null;
  const narrowed = (era ? 1 : 0) + (region ? 1 : 0);
  /** The date in the wheels, which stand on today when nothing was said. */
  const when = search.at ?? { year: new Date().getFullYear() };
  /** And the width, named — "± 1 semaine" — for the closed row. */
  const spanSaid =
    widthsFor(when).find((one) => one.years === search.span)?.label ?? "";

  /** Puts the two settings away, wheels included. */
  /**
   * L'époque telle qu'elle était avant qu'on ouvre sa carte.
   *
   * **Les roues écrivent dans la recherche à mesure qu'on les tourne**, et
   * c'est voulu : la liste derrière se refait sous les yeux, ce qui est la
   * meilleure réponse à « est-ce la bonne date ». Mais écrire tout de suite
   * veut dire qu'il n'y a rien à annuler, et une croix qui ne peut rien
   * annuler est un second « Valider ».
   *
   * Elle est donc gardée ici le temps du réglage, et rendue si l'on ferme.
   * Ce n'est pas un brouillon — la recherche, elle, est bien modifiée — mais
   * de quoi revenir en arrière.
   */
  const [eraWas, setEraWas] = useState<Pick<Search, "at" | "span"> | null>(
    null,
  );

  /**
   * Refuser la carte ouverte : la croix, et le voile autour d'elle.
   *
   * **Depuis la carte d'époque, refuser veut dire annuler et remonter**, et
   * non fermer. Elle est une sous-carte de celle des filtres — on n'y vient
   * que de là —, donc la quitter rend aux filtres ; ce qui l'en distingue de
   * « Valider », c'est qu'elle rend aussi l'époque qu'on avait avant. La
   * croix et le bouton sortent par la même porte et n'emportent pas la même
   * chose.
   *
   * Partout ailleurs, il n'y a rien au-dessous : refuser ferme.
   */
  const close = () => {
    if (sifting === "era") {
      if (eraWas) {
        setSearch((was) => ({ ...was, at: eraWas.at, span: eraWas.span }));
      }
      setEraWas(null);
      setSifting("filters");
      return;
    }
    setEraWas(null);
    setSifting(null);
  };

  /**
   * Revenir aux filtres, d'où l'on vient quand on règle une époque.
   *
   * Le retour en arrière est oublié au passage : on est sorti par un bouton
   * qui garde ce qui vient d'être réglé.
   */
  const toFilters = () => {
    setEraWas(null);
    setSifting("filters");
  };

  /**
   * Lays a row's shape on the plate, and takes it if the reader says so.
   *
   * For the kinds whose whole substance is a shape: the card is skipped
   * because it has nothing to add, and copying from the map saves the trip
   * back for a second decision.
   */
  /**
   * Opens a genealogy over the panel, once it has been fetched.
   *
   * The payload arrives flat — members, lines, faces — and is assembled into
   * the shape the canvas draws, which is the same shape the builder draws.
   */
  const openDrawing = (one: SharedThing) => {
    setTaking(one.id);
    void api
      .fetchWhole("tree", one.id)
      .then((whole) => {
        if (whole?.drawing == null) return;
        setDrawn({
          thing: one,
          tree: {
            id: one.id,
            name: one.title,
            note: null,
            shared: true,
            origin: null,
            members: whole.drawing.members.map(
              (m): TreeMember =>
                m.text === null
                  ? {
                      kind: "person",
                      id: m.id,
                      characterId: m.characterId ?? "",
                      generation: m.generation,
                      position: m.position,
                      importance: m.importance,
                      note: null,
                    }
                  : {
                      kind: "label",
                      id: m.id,
                      text: m.text,
                      generation: m.generation,
                      position: m.position,
                      width: asLabelWidth(m.width),
                    },
            ),
            links: whole.drawing.links,
          },
          faces: new Map(
            whole.drawing.people.map((who) => [
              who.id,
              {
                name: who.name,
                photo: who.photo,
                dates: who.dates,
                tint: who.tint,
              },
            ]),
          ),
        });
      })
      .catch((cause: unknown) =>
        say(
          "Arbre illisible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  const onTheMap = (one: SharedThing) => {
    if (kind === "tree") {
      openDrawing(one);
      return;
    }
    if (one.shape === undefined) return;
    void showShape(one.shape, {
      name: one.title,
      said: look.under(one),
      take: look.take,
      takeable: !one.mine && !one.copied,
    }).then((taken) => {
      if (taken) setAsking({ one, kind });
    });
  };

  const takeIt = (one: SharedThing, its: Kind = kind) => {
    setTaking(one.id);
    void api
      .copy(its, one.id)
      .then(async () => {
        // Une copie arrive par une route que la collection ne connaît pas,
        // et elle est tenue en mémoire : il faut la lui dire. Il y avait trois
        // réserves à prévenir ici, du temps où l'on copiait aussi des
        // territoires et des villes ; ceux-là vont maintenant dans le fond de
        // carte, que la base redessine sans qu'on lui demande rien.
        await refresh();
        // The drawing has served its purpose once the copy is taken.
        setDrawn(null);
        setRows((current) =>
          current.map((row) =>
            row.id === one.id
              ? { ...row, copied: true, stars: row.stars + 1 }
              : row,
          ),
        );
        setTrail((was) =>
          was.map((step) =>
            step.thing.id === one.id
              ? {
                  ...step,
                  thing: {
                    ...step.thing,
                    copied: true,
                    stars: step.thing.stars + 1,
                  },
                }
              : step,
          ),
        );
      })
      .catch((cause: unknown) =>
        say(
          "Copie impossible",
          cause instanceof Error ? cause.message : String(cause),
        ),
      )
      .finally(() => setTaking(null));
  };

  return (
    <Sheet
      // Out of the way while the reader aims at the map — the region filter
      // asks for a point the same way everything else in this app does — and
      // back afterwards with the sieve exactly as they left it.
      visible={visible && !aiming}
      onClose={onClose}
      onClosed={aiming ? undefined : onClosed}
      tall
      liftsForKeyboard={false}
      /**
       * The heading never changes while a card is read, and that is the
       * point.
       *
       * It used to name the thing — "Un arbre" over a tree — which
       * said nothing the card does not say better with its own name three
       * lines down. Taking it away instead made the opening two events: the
       * title vanished, then the card rose into the gap. Left alone, it is
       * simply the name of the catalogue one is in, the card slides up
       * beneath it, and nothing flickers.
       */
      title={face === "report" ? "Signaler" : look.many}
      /* Elle suit le titre, et pour la même raison que lui : elle reste en
         place pendant qu'une fiche monte, et ne cède qu'au signalement, qui
         n'est pas la bibliothèque mais une lettre qu'on y écrit. */
      banner={face === "report" ? undefined : BANNER}
      /* Le seul panneau à motifs de l'application. Il ne demande rien à son
         lecteur — on y parcourt ce que d'autres ont fait — donc un fond y a
         la place de se voir, là où il disputerait l'œil à un formulaire.
         Gardé jusque sous le signalement : c'est le fond du panneau, et le
         voir disparaître en changeant de face serait un clignotement. */
      pattern
      footer={
        face === "report" ? (
          <>
            <InkButton
              label="Annuler"
              variant="tonal"
              grow
              onPress={() => setFace("list")}
            />
            <InkButton
              label={taking === null ? "Envoyer" : "…"}
              variant="solid"
              tone="danger"
              grow
              disabled={taking !== null}
              onPress={report}
            />
          </>
        ) : !atCard || reading === null ? (
          <InkButton label="Fermer" variant="tonal" grow onPress={onClose} />
        ) : (
          /* The card slides; the chrome around it does not. Putting these
             inside the sliding panel made them travel with it, which was
             prettier — and left the sheet's own footer showing underneath,
             two rows of buttons at once. */
          <>
            {/* `grow` only when "Retour" is alone. Beside the copy button it
                must not: six letters claiming half the footer left the other
                one 121pt of room, and "Copier le personnage" needs 156. So
                "Retour" takes what it needs and the copy button, whose label
                is the long one and the one that matters, takes the rest. */}
            <InkButton
              label="Retour"
              variant="tonal"
              grow={reading.thing.mine}
              onPress={back}
            />
            {/* Rien à prendre dans sa propre bibliothèque.
                `mine` ne peut plus être vrai que pour un seul compte : le
                catalogue ne montre que les entrées publiées de la
                bibliothèque, donc on ne rencontre sa propre entrée que si
                l'on *est* la bibliothèque. Un bouton éteint marqué « Le
                vôtre » le disait alors sur chaque carte, sans rien
                apprendre. La ligne de la liste n'en montre aucun depuis
                toujours (`ThingRow`) ; la carte fait pareil. */}
            {reading.thing.mine ? null : stale !== null ? (
              /* Ce qu'on détient est en retard sur ce qu'on lit : « Déjà
                 copié » serait vrai et inutile. C'est ici que la reprise se
                 demande, parce que c'est ici qu'on vient de lire ce qu'elle
                 apporte — le bouton de la notification et celui du formulaire
                 ne font plus que mener à cette page. */
              <InkButton
                label={taking === reading.thing.id ? "Reprise…" : "Mettre à jour"}
                variant="solid"
                grow
                disabled={taking !== null}
                onPress={() => setUpdating(stale)}
              />
            ) : (
              <InkButton
                label={
                  reading.thing.copied
                    ? "Déjà copié"
                    : taking === reading.thing.id
                      ? "Copie…"
                      : // `readingLook`, not `look`: the foot belongs to the
                        // card in front of it, which may be two kinds away
                        // from the list that was searched.
                        readingLook.take
                }
                variant="solid"
                grow
                disabled={reading.thing.copied || taking !== null}
                onPress={() =>
                  setAsking({ one: reading.thing, kind: reading.kind })
                }
              />
            )}
          </>
        )
      }
    >
      {dialog}

      {face === "report" ? (
        /* La feuille ne monte pas avec le clavier — elle fait déjà la hauteur
           de l'écran, et la soulever ne ferait que coller ses boutons aux
           touches. C'est donc au contenu défilant d'amener le champ visé à
           l'écran, exactement comme dans les deux autres formulaires longs de
           l'app. Sans ces deux réglages, « Ce qui vous a fait le signaler »
           s'écrivait sous le clavier, invisible. */
        <ScrollView
          contentContainerStyle={styles.reading}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.lead}>
            Dites-nous ce qui ne va pas avec « {reading?.thing.title} ».
            Assez de signalements et l'élément est retiré de la bibliothèque en
            attendant d'être relu.
          </Text>

          {REASONS.map((one) => (
            <Pressable
              key={one.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: why === one.value }}
              onPress={() => setWhy(one.value)}
              style={({ pressed }) => [
                styles.reason,
                why === one.value && styles.reasonOn,
                pressed && styles.dim,
              ]}
            >
              <Text
                style={[
                  styles.reasonLabel,
                  why === one.value && styles.reasonLabelOn,
                ]}
              >
                {one.label}
              </Text>
            </Pressable>
          ))}

          <InkField
            label="À préciser (facultatif)"
            value={said}
            onChangeText={setSaid}
            multiline
            maxLength={600}
            placeholder="Ce qui vous a fait le signaler…"
          />

          <Text style={styles.aside}>
            Nous répondons sous {ANSWER_WITHIN}. Vous pouvez aussi écrire à{" "}
            {CONTACT}.
          </Text>
        </ScrollView>
      ) : (
        <>
          <View style={styles.stack}>
            <View style={styles.sieve}>
              {/* `look`, non `readingLook` : le champ interroge la liste
                  qu'on parcourt, pas la fiche qu'on lit par-dessus. */}
              <InkField
                label={look.named}
                value={search.words}
                onChangeText={(words) =>
                  setSearch((was) => ({ ...was, words }))
                }
                placeholder={look.hint}
                autoCorrect={false}
                returnKeyType="search"
              />

              {/* Two buttons rather than every control at once: the sieve is
                three questions deep and only the name is asked often. */}
              <View style={styles.tools}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trier"
                  onPress={() => setSifting("sort")}
                  style={({ pressed }) => [styles.tool, pressed && styles.dim]}
                >
                  <Text style={styles.toolLabel}>
                    Tri · {SORTS.find((one) => one.value === search.sort)?.said}
                  </Text>
                  <Text style={styles.toolMore}>⌄</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Filtrer"
                  onPress={() => setSifting("filters")}
                  style={({ pressed }) => [
                    styles.tool,
                    narrowed > 0 && styles.toolOn,
                    pressed && styles.dim,
                  ]}
                >
                  <Text
                    style={[
                      styles.toolLabel,
                      narrowed > 0 && styles.toolLabelOn,
                    ]}
                  >
                    {narrowed === 0 ? "Filtres" : `Filtres · ${narrowed}`}
                  </Text>
                  <Text
                    style={[
                      styles.toolMore,
                      narrowed > 0 && styles.toolLabelOn,
                    ]}
                  >
                    ⌄
                  </Text>
                </Pressable>

              </View>
            </View>

            <FlatList
              style={styles.fill}
              data={rows}
              keyExtractor={(one) => one.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (loading || drained || rows.length === 0) return;
                const last = rows[rows.length - 1];
                if (last) void fetchPage({ rank: last.rank, id: last.id });
              }}
              ListEmptyComponent={
                loading ? null : (
                  <Text style={styles.nothing}>{look.nothing}</Text>
                )
              }
              ListFooterComponent={
                loading ? (
                  <ActivityIndicator
                    color={palette.inkFaint}
                    style={styles.wait}
                  />
                ) : null
              }
              renderItem={({ item }) => (
                <ThingRow
                  one={item}
                  look={look}
                  busy={taking === item.id}
                  onOpen={() =>
                    look.onTheMap === true
                      ? onTheMap(item)
                      : setTrail([{ kind, thing: item }])
                  }
                  onTake={() => setAsking({ one: item, kind })}
                />
              )}
            />

            {/* The trail, mounted — the last few steps of it, deepest last.

                One card used to stand here and every step swapped what it
                drew, which cost the two things a step back ought to be: free
                and unchanged. The parent had to read itself from the network
                again, and it came back scrolled to the top — a reader who had
                worked down a long lineage to its fortieth name lost their
                place by looking at one of them.

                Kept mounted, each card holds what it loaded and where it was
                scrolled, so "Retour" is nothing but the card above it
                leaving. It also means the parent is *already there*,
                underneath, while that card slides down: the gesture reveals
                it rather than racing to rebuild it.

                How many is `windowed`'s business, and its reason is memory:
                this walk has no ceiling, since a person stands in a tree and
                that tree holds the person.

                Order is the whole of the paint: `risen` is opaque and
                full-bleed, so the deeper card simply covers the one it came
                from. Later siblings win, and `trail` is in the order it was
                walked — which is why these must stay inside `styles.stack`
                and before the settings card, not after it. */}
            {windowed(trail).map(({ step, depth }) => {
              const top = depth === trail.length - 1;
              /** Drawn as the thing it is, not as the thing that held it. */
              const its = LOOKS[step.kind];

              return (
                <Animated.View
                  key={`${depth}:${step.thing.id}`}
                  style={[
                    styles.risen,
                    // Only the top card travels. The ones under it are at
                    // rest and covered; moving them would be moving scenery
                    // nobody can see.
                    top ? { transform: [{ translateY: rise }] } : null,
                  ]}
                  // Buried cards are unreachable by paint order already —
                  // but a ScrollView under an opaque sibling can still catch
                  // a pan on some paths, and a screen reader would happily
                  // read all three. Said plainly instead of relied upon.
                  pointerEvents={top ? "auto" : "none"}
                  accessibilityElementsHidden={!top}
                  importantForAccessibility={
                    top ? "auto" : "no-hide-descendants"
                  }
                >
                  <SharedCard
                    one={step.thing}
                    kind={step.kind}
                    look={its}
                    // What a tree holds is openable: nobody takes
                    // twenty-seven lives on the strength of their names.
                    //
                    // Le genre était écrit « event » en dur, pour ce qu'un
                    // classeur contenait — et un arbre, qui tient des
                    // personnages, menait donc à `shared_event` avec un
                    // identifiant de personnage, c'est-à-dire à rien. Seuls
                    // les arbres répondent `held` aujourd'hui.
                    onOpenHeld={(one) =>
                      setTrail((was) => [
                        ...was,
                        { kind: "character", thing: one },
                      ])
                    }
                    // And the other way up: from a person to an arbre they
                    // stand in.
                    // The trail already runs both ways, so "Retour" comes back
                    // to what was being read rather than out to the list — a
                    // reader can look at the box and decide against it without
                    // losing their place.
                    //
                    // Where it leads is the look's business (`filedKind`), not
                    // a list kept here.
                    onOpenFiled={(one) => {
                      const to = its.filedKind;
                      if (to === undefined) return;
                      // Un arbre n'a pas de fiche qui vaille : toute sa
                      // substance est le dessin, et c'est ce que « Voir
                      // l'arbre » promet. Même porte que depuis une ligne de
                      // la liste.
                      if (to === "tree") {
                        openDrawing(one);
                        return;
                      }
                      setTrail((was) => [...was, { kind: to, thing: one }]);
                    }}
                    // A territory is its outline: the card cannot show one,
                    // so it hands the reader to the map. Taking it from there
                    // avoids the trip back for a second decision.
                    onShowShape={(shape) => {
                      const one = step.thing;
                      void showShape(shape, {
                        name: one.title,
                        said: its.under(one),
                        take: its.take,
                        takeable: !one.mine && !one.copied,
                      }).then((taken) => {
                        if (taken) setAsking({ one, kind: step.kind });
                      });
                    }}
                    // La fiche demande, le panneau dessine — voir
                    // `onShowPhoto` dans `SharedCard`.
                    onShowPhoto={setViewing}
                    onReport={() => setFace("report")}
                  />
                </Animated.View>
              );
            })}
          </View>

          {/* A genealogy, over the whole panel: it needs the room, and the
              sheet is already most of the screen. Above the settings card,
              which cannot be open at the same time but would otherwise win
              by being written later. */}
          {drawn === null ? null : (
            <View style={styles.wide}>
              <TreePreview
                tree={drawn.tree}
                faces={drawn.faces}
                said={look.under(drawn.thing)}
                takeable={!drawn.thing.mine && !drawn.thing.copied}
                busy={taking === drawn.thing.id}
                onTake={() => setAsking({ one: drawn.thing, kind: "tree" })}
                onClose={() => setDrawn(null)}
                // The panel reaches the foot of the screen, so the buttons
                // must clear the home indicator themselves — the sheet's own
                // footer, which usually does it, is behind this.
                inset={{ top: 0, bottom: insets.bottom }}
              />
            </View>
          )}

          {/* A card laid on the panel, never a modal over it. See `sifting`.
              Last among its siblings and layered above them, because a
              fragment creates no view: the sheet's own footer is a sibling
              too, and it is written after this. */}
          {sifting === null ? null : (
            <View style={styles.over}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                style={StyleSheet.absoluteFill}
                onPress={close}
              />

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeading}>
                    <View style={styles.cardTitleRow}>
                      <Image
                        source={
                          sifting === "sort"
                            ? SORT_ICON
                            : sifting === "era"
                              ? ERA_ICON
                              : FILTER_ICON
                        }
                        style={styles.cardIcon}
                        resizeMode="contain"
                        accessible={false}
                      />
                      <Text style={styles.cardTitle}>
                        {sifting === "sort"
                          ? "Trier"
                          : sifting === "era"
                            ? "Époque"
                            : "Filtres"}
                      </Text>
                    </View>
                    <View style={styles.cardRule} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fermer"
                    hitSlop={10}
                    onPress={close}
                    style={({ pressed }) => [pressed && styles.dim]}
                  >
                    {/* Une croix sur les trois cartes. Sur celle de
                        l'époque, elle remonte aux filtres **et** rend
                        l'époque qu'on avait avant — voir `close`. C'est ce
                        rétablissement, et lui seul, qui la distingue de
                        « Valider » : les deux reviennent au même endroit,
                        l'une les mains vides. */}
                    <Text style={styles.cardClose}>×</Text>
                  </Pressable>
                </View>

                {sifting === "era" ? (
                  /* No scrolling container: the wheels are a virtualized
                     list, and React Native refuses to window one inside a
                     scroll view of the same direction. */
                  <View style={styles.cardBody}>
                    <DateWheels
                      value={when}
                      onChange={(at) =>
                        setSearch((was) => {
                          // A width the new precision no longer offers would
                          // be a week around a date known only to the year.
                          const kept = widthsFor(at).some(
                            (one) => one.years === was.span,
                          );
                          return {
                            ...was,
                            at,
                            span: kept ? was.span : widthsFor(at)[0]!.years,
                          };
                        })
                      }
                    />
                    <Text style={styles.siftAt}>
                      {formatHistoricalDate(when)}
                    </Text>
                    <View style={styles.siftRow}>
                      {widthsFor(when).map((one) => (
                        <Chip
                          key={one.label}
                          label={one.label}
                          selected={search.span === one.years}
                          onPress={() =>
                            setSearch((was) => ({ ...was, span: one.years }))
                          }
                        />
                      ))}
                    </View>
                    {/* Deux boutons à parts égales, dans l'ordre des pieds
                        de feuille de l'application : la sortie à gauche, ce
                        qu'on est venu faire à droite.

                        « Valider » ne valide rien à proprement parler — les
                        roues écrivent dans la recherche à mesure qu'on les
                        tourne, et la liste derrière est déjà filtrée. Il dit
                        « j'en ai fini », ce qui est la seule chose qu'un
                        lecteur ait à dire ici. */}
                    <View style={styles.siftActions}>
                      <InkButton
                        label="Pas de filtre"
                        variant="tonal"
                        grow
                        onPress={() => {
                          setSearch((was) => ({ ...was, span: null }));
                          toFilters();
                        }}
                      />
                      <InkButton
                        label="Valider"
                        variant="solid"
                        grow
                        onPress={toFilters}
                      />
                    </View>
                  </View>
                ) : sifting === "sort" ? (
                  <View style={styles.cardBody}>
                    {SORTS.map((one) => {
                      const chosen = search.sort === one.value;
                      return (
                        <Pressable
                          key={one.value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: chosen }}
                          onPress={() => {
                            setSearch((was) => ({ ...was, sort: one.value }));
                            close();
                          }}
                          style={({ pressed }) => [
                            styles.choice,
                            chosen && styles.choiceOn,
                            pressed && styles.dim,
                          ]}
                        >
                          <Text
                            style={[styles.choiceMark, chosen && styles.onWax]}
                          >
                            {one.mark}
                          </Text>
                          <View style={styles.choiceText}>
                            <Text
                              style={[
                                styles.choiceTitle,
                                chosen && styles.onWax,
                              ]}
                            >
                              {one.label}
                            </Text>
                            <Text
                              style={[
                                styles.choiceWhy,
                                chosen && styles.onWaxSoft,
                              ]}
                            >
                              {one.why}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  /* Plus de conteneur défilant : les roues sont une liste
                     virtualisée, et React Native refuse d'en fenêtrer une
                     dans une vue défilante de même direction. La contrainte
                     vaut encore, puisque les roues sont parties dans leur
                     propre carte et non dans un panneau à elles. */
                  <View style={styles.cardBody}>
                    <Text style={styles.siftLegend}>Époque</Text>

                    {/* Une rangée, et rien d'autre : le réglage s'ouvre dans
                        sa propre carte. Fermée, elle ne dit qu'une chose —
                        une date et les mots « toute l'histoire » ensemble à
                        l'écran se contredisent, ce que cette rangée a
                        remplacé. */}
                    <Row
                      said={
                        era
                          ? `${formatHistoricalDate(when)} · ${spanSaid}`
                          : "Toute l'histoire"
                      }
                      lit={era}
                      onPress={() => {
                        /* L'instantané d'abord, et la largeur par défaut
                           ensuite : celle-ci est déjà une modification, et
                           fermer par la croix doit la défaire aussi. */
                        setEraWas({ at: search.at, span: search.span });
                        /* Une largeur par défaut avant d'ouvrir : sans elle,
                           la carte s'ouvrirait sur des roues qui ne filtrent
                           rien et sur une liste de largeurs dont aucune n'est
                           choisie. */
                        setSearch((was) => ({
                          ...was,
                          span: was.span ?? widthsFor(when)[0]!.years,
                        }));
                        setSifting("era");
                      }}
                    />

                    <View style={styles.siftRule} />

                    <Text style={styles.siftLegend}>Région</Text>
                    <Row
                      said={
                        // `region` implique désormais les deux valeurs ; le
                        // second test ne reste que pour le compilateur.
                        region && search.withinMetres !== null
                          ? `${Math.round(search.withinMetres / 1000)} km autour de ${search.near?.latitude.toFixed(1)}°, ${search.near?.longitude.toFixed(1)}°`
                          : "Partout"
                      }
                      lit={region}
                      onPress={() => {
                        // The point and the reach are set on the map, where
                        // the circle can be seen against the coastlines.
                        void placeRegion(
                          search.near,
                          search.withinMetres ?? 500_000,
                        ).then((zone) => {
                          if (zone === null) return;
                          setSearch((was) => ({
                            ...was,
                            near: {
                              longitude: zone.longitude,
                              latitude: zone.latitude,
                            },
                            withinMetres: zone.metres,
                          }));
                        });
                      }}
                    />
                    {region ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setSearch((was) => ({
                            ...was,
                            near: null,
                            withinMetres: null,
                          }))
                        }
                        style={({ pressed }) => [pressed && styles.dim]}
                      >
                        <Text style={styles.clear}>Chercher partout</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          )}
        </>
      )}

      {/* Enfant direct de la feuille, exactement comme dans
          `EventDetailModal` : c'est ce qui lui donne tout l'écran, et c'est
          cette place-là qui marche sur Android. */}
      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />

      {/* La question, avant le geste. `ConfirmDialog` est monté dans la
          feuille et non à la racine — iOS refuse une seconde modale depuis un
          contrôleur qui en présente déjà une. */}
      {asking === null ? null : (
        <ConfirmDialog
          visible
          title={LOOKS[asking.kind].ask}
          message={LOOKS[asking.kind].means}
          confirmLabel={LOOKS[asking.kind].take}
          /* Encre et non rouge : copier ne retire rien, et peindre ce bouton
             en rouge mettrait en garde contre ce que le lecteur est venu
             faire. */
          tone="ink"
          cancelLabel="Annuler"
          onConfirm={() => {
            const { one, kind: its } = asking;
            setAsking(null);
            takeIt(one, its);
          }}
          onClose={() => setAsking(null)}
        />
      )}

      {updating === null ? null : (
        <ConfirmDialog
          visible
          title="Reprendre cette version ?"
          /* Deux tons, pour une ligne de code. Sans modification il n'y a rien
             à perdre, et agiter un avertissement devant quelqu'un qui ne
             risque rien lui apprend à les ignorer tous. */
          message={
            updating.touched
              ? "Votre exemplaire sera entièrement réécrit : le texte, les dates, le lieu, et les photographies que vous y avez ajoutées. Ce que vous avez modifié sera perdu."
              : "Vous n'avez rien modifié sur votre exemplaire : rien ne sera perdu."
          }
          confirmLabel="Reprendre"
          tone={updating.touched ? "danger" : "ink"}
          cancelLabel="Annuler"
          onConfirm={() => {
            const mine = updating;
            setUpdating(null);
            setTaking(mine.entry);
            void refreshFromLibrary(mine.kind, mine.id)
              .then(async () => {
                // Elle n'est plus en retard : le pied retrouve « Déjà copié ».
                setBehind((all) => all.filter((one) => one.id !== mine.id));
                await refresh();
              })
              .catch((cause: unknown) =>
                say(
                  "Reprise impossible",
                  cause instanceof Error ? cause.message : String(cause),
                ),
              )
              .finally(() => setTaking(null));
          }}
          onClose={() => setUpdating(null)}
        />
      )}
    </Sheet>
  );
}

/**
 * A setting at rest: what it is now, and a way to change it.
 *
 * Wax once it is narrowing something, so a card opened at a glance says
 * whether anything is being held back.
 */
function Row({
  said,
  lit,
  onPress,
}: {
  said: string;
  lit: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={said}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        lit && styles.rowOn,
        pressed && styles.dim,
      ]}
    >
      <Text style={[styles.rowSaid, lit && styles.onWax]} numberOfLines={2}>
        {said}
      </Text>
      <Text style={[styles.rowMore, lit && styles.onWax]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /** The padding a face's own scrolling body takes. */
  reading: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
  },
  sieve: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.md,
  },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  /** A drawn button, like the discs on the plate: edged and lifted. */
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  /** Wax once it is doing something, so a narrowed list says so. */
  toolOn: { backgroundColor: palette.wax, borderColor: palette.waxDeep },
  toolLabel: { ...type.legend, fontWeight: "700", color: palette.ink },
  toolLabelOn: { color: palette.surfaceRaised },
  toolMore: { ...type.legend, color: palette.inkFaint },

  /** The drawing, over everything the sheet holds. */
  wide: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },

  /**
   * The settings, laid over the panel.
   *
   * Absolute against the **panel** and not against the list's own room, so
   * the dim reaches the heading above and the button below: a card that
   * darkened the middle of a sheet and left its two ends lit read as a
   * mistake rather than as a card.
   *
   * It clips to the sheet, so it looks centred on it, and the list stays
   * faintly visible behind — it is what the settings are about. And being no
   * modal at all is what lets the region filter hand the screen to the
   * reticle without anything being dismissed from underneath it.
   */
  /**
   * The room the list and the card being read share.
   *
   * The card is absolute inside *this* rather than inside the panel, and it
   * has to stay so for two reasons that were each learnt the hard way: laid
   * over the panel it hid the very heading that says what is being read, and
   * it covered the sheet's own footer — the buttons that take a copy and go
   * back were still there, behind it.
   *
   * The settings card is the opposite case and sits outside: it dims, and a
   * dim that stops short of the heading reads as a mistake.
   */
  stack: { flex: 1 },
  risen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: palette.surfaceRaised,
  },

  over: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    /**
     * Above every sibling, and the footer is one of them.
     *
     * Drawing order alone is not enough: a fragment creates no view, so this
     * card, the list, the header and the sheet's own footer are all children
     * of the same panel — and the footer is written after them. Being last
     * among its own siblings puts the card over the list; the layer puts it
     * over the footer as well, which it must cover, or a tap meant for the
     * card's backdrop would close the whole sheet.
     */
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    backgroundColor: BACKDROP,
  },
  /**
   * Les mêmes nombres que la carte de `Dialog`, et ce n'est pas une
   * coïncidence à entretenir.
   *
   * Cette carte-ci est écrite à la main parce qu'elle doit vivre **dans** une
   * feuille sans être une modale — iOS refuse d'en présenter une depuis un
   * panneau qui s'ouvre — et non parce qu'elle voudrait un autre style. Elle
   * en avait pourtant pris un : titre d'un point plus petit, trait à 42 % au
   * lieu de 58, quatre points de marge en moins, croix de deux points plus
   * grosse. On croisait donc deux gabarits dans le même panneau, la carte de
   * tri étant manuscrite quand le « Reprendre cette version ? » juste après
   * est un `Dialog`.
   *
   * Toute divergence retrouvée ici est un défaut, pas une intention.
   */
  card: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "94%",
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.lifted,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardHeading: { flex: 1, gap: space.xs },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  /** Vingt, comme dans `Dialog` : accordé au titre de vingt-deux. */
  cardIcon: { width: 20, height: 20, tintColor: palette.ink },
  cardTitle: { ...type.plate, fontSize: 22, color: palette.ink },
  /** Drawn under the word, the way every heading in this app is. */
  cardRule: {
    height: 3,
    width: "58%",
    minWidth: 56,
    marginTop: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
  },
  /**
   * La croix de `Dialog`, moins son décalage.
   *
   * Sa taille et son interligne sont les mêmes ; le `marginTop`, non, et le
   * recopier l'aurait décalée. Là-bas le glyphe est centré dans un bouton de
   * trente-deux points qui porte lui-même un retrait de quatre ; ici il est
   * seul dans sa touche. Les deux chemins mènent au même endroit — le centre
   * du glyphe à dix points du haut de la ligne, soit la hauteur de la
   * première ligne du titre — par deux arithmétiques différentes.
   */
  cardClose: {
    fontSize: 24,
    lineHeight: 28,
    color: palette.inkFaint,
    marginTop: -4,
  },
  cardBody: { gap: space.md },

  /**
   * One of two ways to order the list: a mark, a name, and why.
   *
   * Written out rather than left to a segmented control, because the two are
   * not two settings of one thing — they are two different questions about
   * what matters, and one line each is what says so.
   */
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
  },
  choiceOn: { backgroundColor: palette.wax },
  choiceMark: {
    fontSize: 18,
    width: 22,
    textAlign: "center",
    color: palette.wax,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 15.5, fontWeight: "700", color: palette.ink },
  choiceWhy: { ...type.caption, color: palette.inkSoft },
  onWax: { color: palette.surfaceRaised },
  onWaxSoft: { color: palette.surfaceRaised, opacity: 0.78 },

  /**
   * Le pied de la carte d'époque : deux boutons, toute la largeur.
   *
   * Pas de `justifyContent` — chacun porte `grow`, donc il n'y a plus de
   * place à distribuer. Un peu d'air au-dessus, parce qu'ils ferment la
   * carte et ne font pas partie du réglage qu'ils closent.
   */
  siftActions: { flexDirection: "row", gap: space.sm, paddingTop: space.xs },

  /** A rule between the two questions, drawn rather than ruled across. */
  siftRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
    marginVertical: space.xs,
  },
  /** A closed setting: what it is now, and a way in. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  rowOn: { backgroundColor: palette.wax },
  rowSaid: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.ink },
  rowMore: { fontSize: 20, lineHeight: 22, color: palette.inkFaint },

  sift: { gap: space.sm },
  siftLegend: {
    ...type.legend,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.inkFaint,
  },
  siftRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  siftAt: {
    ...type.body,
    fontWeight: "700",
    color: palette.wax,
    textAlign: "center",
  },
  clear: {
    ...type.legend,
    color: palette.inkFaint,
    textDecorationLine: "underline",
    alignSelf: "flex-start",
  },
  list: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
  nothing: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.md,
  },
  wait: { paddingVertical: space.lg },

  dim: { opacity: 0.6 },
  lead: { ...type.body, color: palette.inkSoft },
  reason: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  reasonOn: { backgroundColor: palette.wax },
  reasonLabel: { fontSize: 15, fontWeight: "600", color: palette.ink },
  reasonLabelOn: { color: palette.surfaceRaised },

  aside: { ...type.caption, color: palette.inkFaint },
});
