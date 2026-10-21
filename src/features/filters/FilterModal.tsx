import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Dialog, SegmentedControl, TICK, TickRow } from "../../components/ui";
import { useEvents } from "../events/EventsProvider";
import { FolderSelector } from "../events/components/FolderSelector";
import type { Importance } from "../events/types";

/** Le même entonnoir que la pastille qui ouvre ce panneau. */
const FILTER = require("../../../assets/icons/filter.png");
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

/** Les trois crans, et « Toutes » que seul le filtre propose. */
const IMPORTANCES: { value: Importance | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
];

export type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * What the map is showing, and how to change it.
 *
 * Three things are drawn on the plate and each can be put away: what happened,
 * who was there, and the world underneath. They were never on one panel before
 * because only the events could be filtered — the territories were hidden one
 * by one from the pencil, and the people were not on the map at all.
 *
 * A card in the middle rather than a sheet from the bottom: the sheets are for
 * *making*, and nothing here is filled in. Every answer lands on the map the
 * moment it is given, so there is nothing to confirm and the cross is the
 * whole way out.
 *
 * **Une liste, puis les affinages**, et c'est une refonte. Le panneau donnait
 * une carte par calque, chacune avec sa case, sa phrase et ses réglages
 * dedans : trois grammaires de contrôle empilées, des cartes de hauteurs
 * inégales, et de la prose là où un filtre se balaie. Surtout, la hiérarchie
 * était à l'envers — ce qu'on vient faire le plus souvent, montrer ou cacher
 * les trois calques, était éclaté en trois objets, tandis que le réglage le
 * plus rare occupait le haut.
 *
 * Les trois calques sont donc devenus trois lignes d'une même liste, qui se
 * comparent d'un coup d'œil ; ce qui les affine vient après, chacun sous son
 * étiquette.
 */
export function FilterModal({ visible, onClose }: FilterModalProps) {
  const {
    events,
    folderNames,
    characters,
    visibleCharacters,
    filters,
    setFilters,
    visibleEvents,
  } = useEvents();

  /** Combien de gens ont reçu un point : sans point, nul ne peut paraître. */
  const placed = characters.filter(
    (person) => person.longitude !== null && person.birth !== null,
  ).length;

  const narrowed =
    filters.folders.length > 0 || filters.importance !== null;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Filtres"
      icon={FILTER}
      /* Le titre à gauche, à la taille des autres cartes.
         Il fut `centred` — c'est-à-dire titré comme une feuille, au milieu
         et plus gros — au motif que ce panneau est un panneau et non une
         question. L'argument tenait tant que les cartes de l'application
         étaient toutes des questions ; la bibliothèque en a désormais trois
         qui règlent quelque chose, toutes titrées à gauche sous leur trait.
         Ce panneau-ci était donc devenu le seul de son espèce, ce qui est
         exactement le reproche que `centred` cherchait à éviter. */
      /* Every change lands on the map at once: nothing to confirm, nothing to
         back out of, and a row of buttons would only be furniture. */
      dismissLabel={null}
    >
      {/* Bounded and scrolling: le classement s'allonge d'une pastille par
          classeur ouvert, et le panneau sortirait des deux bouts de l'écran. */}
      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.note}>Afficher sur la carte</Text>

          {/* Une seule carte pour les trois, séparées par un filet.
              Trois cartes faisaient trois objets là où il y a une question :
              qu'est-ce que la planche porte. */}
          <View style={styles.card}>
            <TickRow
              title="Événements"
              /* Le compte de ce qui reste après tamisage, et le total avec
                 lui dès que quelque chose tamise — sans le total, « 12 » ne
                 dit pas s'il en manque. Rien quand la case est décochée :
                 elle dit déjà qu'on n'en voit aucun. */
              count={
                !filters.events
                  ? undefined
                  : narrowed
                    ? `${visibleEvents.length} / ${events.length}`
                    : `${events.length}`
              }
              on={filters.events}
              onToggle={() => setFilters({ events: !filters.events })}
            />

            {/* Dépliée sous la case et seulement quand elle est cochée : un
                cran d'importance réglé sur un calque rangé ne réglerait
                rien, et un contrôle qui ne fait rien est un contrôle qu'on
                croit cassé.

                Indentée de la largeur de la case et de son écart, donc son
                bord gauche tombe sur le mot « Événements » : c'est cet
                alignement, et non un titre, qui dit à quoi elle appartient. */}
            {filters.events ? (
              <View style={styles.inside}>
                <Text style={styles.note}>Importance</Text>
                <SegmentedControl
                  segments={IMPORTANCES}
                  value={filters.importance ?? "all"}
                  onChange={(choice) =>
                    setFilters({ importance: choice === "all" ? null : choice })
                  }
                />
              </View>
            ) : null}

            <View style={styles.rule} />

            <TickRow
              title="Personnages"
              /* La seule phrase qui survit à la refonte, et elle ne paraît
                 que dans le cas où le chiffre mentirait : un lecteur qui a
                 dix personnages et n'en a placé aucun lirait « 0 » comme une
                 panne du filtre. */
              detail={
                filters.characters && placed === 0 && characters.length > 0
                  ? "aucun n'est placé sur la carte"
                  : undefined
              }
              count={
                filters.characters ? `${visibleCharacters.length}` : undefined
              }
              on={filters.characters}
              onToggle={() => setFilters({ characters: !filters.characters })}
            />

            <View style={styles.rule} />

            {/* Sans compte : les territoires de l'année lue se comptent au
                fil du temps, et un nombre qui change en faisant glisser la
                frise se lirait comme un réglage du filtre. */}
            <TickRow
              title="Territoires"
              on={filters.territories}
              onToggle={() => setFilters({ territories: !filters.territories })}
            />
          </View>
        </View>

        {/* Au-dessous des calques et non dedans : il les traverse tous les
            deux. Logé sous « Événements », comme il le fut du temps où eux
            seuls se rangeaient, il passerait pour une propriété de ce calque
            et on chercherait en vain le second. */}
        <View style={styles.section}>
          <Text style={styles.note}>Classement</Text>
          {/* Le même contrôle qu'à l'étape « Classement » des formulaires,
              sans le droit d'en nommer un : on ne range rien depuis un
              filtre. */}
          <FolderSelector
            known={folderNames}
            value={filters.folders}
            onChange={(next) => setFilters({ folders: next })}
            emptyLabel="Filtrer par classeur"
          />
        </View>
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  /** Tall enough for the three sections, short enough to stay a card itself. */
  body: { maxHeight: 420 },
  /** L'air entre les sections, qui est ce qui les sépare — rien d'autre. */
  content: { gap: space.lg, paddingBottom: space.xs },
  /** Une étiquette et ce qu'elle commande, serrés l'un contre l'autre. */
  section: { gap: space.sm },

  card: {
    borderRadius: radius.lg,
    /* Le même air tout autour. En haut et en bas il n'y a rien d'autre que
       lui — les rangées n'ont pas de rembourrage à elles —, donc sans cette
       ligne la première case toucherait le filet de la carte. */
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  /**
   * Ce qui affine un calque, rangé sous lui.
   *
   * La largeur de la case plus l'écart qui la sépare de son mot : le bloc
   * commence donc exactement où commence « Événements ». C'est ce décalage
   * qui dit la portée du réglage — logé au même retrait que la case
   * suivante, on ne saurait plus lequel des deux calques il commande.
   */
  inside: { paddingLeft: TICK + space.md, paddingTop: space.md, gap: space.sm },
  /**
   * Le filet entre deux lignes, et le rembourrage qui le borde.
   *
   * Vertical sur la ligne et non sur la carte : posé sur la carte, il aurait
   * écarté le filet des bords, et un trait qui s'arrête avant le bord d'une
   * liste se lit comme une rature. Les lignes portent donc leur air
   * elles-mêmes, par la marge de ce trait.
   */
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
    marginVertical: space.sm,
  },
  /**
   * L'étiquette d'une section : un mot, en petites capitales, la voix de
   * l'atlas. Les phrases qui vivaient ici sont parties avec la refonte — un
   * filtre se balaie, il ne se lit pas.
   */
  note: { ...type.legend, color: palette.inkFaint },
});
