import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { useHidden } from "./HiddenProvider";
import { Silhouette } from "./Silhouette";
import { PlaceList } from "../places/PlaceList";
import {
  ConfirmDialog,
  GlyphButton,
  InkButton,
  Roster,
  RosterEmpty,
  RosterLegend,
  RosterRow,
  SegmentedControl,
  Sheet,
  THUMB,
  useNotice,
} from "../../components/ui";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { space } from "../../theme/tokens";

/**
 * Un crayon, et c'est un renversement.
 *
 * Ce bouton portait une **carte pliée** : il ouvre la liste des territoires,
 * et le crayon appartenait au moment où l'on peint — `DrawPolityBar` le
 * garde. La distinction était juste et elle a cessé de l'être le jour où ce
 * bouton est devenu le seul de la planche : il ne se lit plus à côté de deux
 * voisins qui ajoutent à la collection, il se lit seul, et son nom est
 * « Dessiner ».
 *
 * Les deux crayons restent distincts — celui-ci droit, celui de la barre de
 * dessin couché à quarante-cinq degrés — donc on ne confond pas la porte
 * avec l'outil qu'elle ouvre.
 */
/**
 * **Dessiné à la main, et hors de la chaîne d'icônes.** Les PNG de
 * `assets/icons` sont normalement fabriqués par `npm run icons` depuis les
 * SVG de `assets/icons/src`, et celui-ci n'en a pas : il garde donc un nom
 * qu'aucune source ne réclame, ce qui est exactement ce qui le protège.
 *
 * Il portait le nom `pencil.png`, que la chaîne revendique — le SVG du même
 * nom étant resté le vieux crayon en contour. Une régénération l'a donc
 * remplacé sans que personne l'ait demandé, et le bouton de la planche s'est
 * retrouvé avec un trait fin là où il veut un aplat. Le renommer est ce qui
 * ferme le piège.
 */
const TERRITORIES = require("../../../assets/icons/pencil_bouton.png");
/**
 * Le bandeau du panneau : ce que la planche contient, peint à la main.
 *
 * Elle se termine par une vague blanche qui rend la page au papier du
 * panneau — c'est pour cela qu'elle vit en haut d'un panneau blanc et nulle
 * part ailleurs.
 */
const BANNER = require("../../../assets/banniere_dessiner.png");
const TRASH = require("../../../assets/icons/trash.png");
/** Putting a territory back is exactly "show it on the map again". */
const BACK_ON_MAP = require("../../../assets/icons/view-map.png");

/**
 * Les deux choses qu'on ajoute à la planche elle-même.
 *
 * Deux onglets et non deux boutons : ce sont deux façons de la même chose —
 * changer la carte sur laquelle la collection se lit — et un second bouton
 * dans la colonne aurait fait trois crayons côte à côte.
 */
const PARTS = [
  { value: "territory" as const, label: "Territoires" },
  { value: "place" as const, label: "Villes" },
];

type Part = (typeof PARTS)[number]["value"];

export type DrawTerritoryButtonProps = {
  /** Hands the map over to the brush. */
  onDraw: () => void;
  /** Donne la carte au viseur, pour y poser une ville. */
  onPose: () => void;
};

/**
 * The plate's own panel: what the reader has added to the map, and removed
 * from it.
 *
 * The same sheet as the events and the people, down to the full height and the
 * dashed slot at the top of the list — because it is the same kind of panel. A
 * count, a way to make one more, then the rows. It was a small centred card
 * while it held two buttons; it holds two lists.
 *
 * The button is under the `+` and deliberately apart from it: one adds an
 * event to the collection, the other changes the map the collection is read
 * on. Two different kinds of making.
 *
 * Le panneau s'appelle « Dessiner » et non plus « Territoires », qui était le
 * nom de son premier onglet. Deux raisons : il en porte deux, et surtout le
 * verbe est ce qui le distingue des deux autres boutons. Le `+` ajoute une
 * note à la collection, le second ouvre ce qu'on a déjà écrit, celui-ci
 * **dessine sur la planche**. Nommer l'un par son contenu et les autres par
 * leur geste laissait trois boutons sans rapport entre eux.
 */
export function DrawTerritoryButton({
  onDraw,
  onPose,
}: DrawTerritoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<Part>("territory");
  /**
   * Ce qu'il faudra lever une fois ce panneau parti, s'il faut lever quelque
   * chose — iOS refuse de présenter depuis un panneau qui se retire encore.
   */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  /** Baisser, puis lever : la suite est jouée par `onClosed`. */
  const after = (deed: () => void) => {
    setLeaving(() => deed);
    setOpen(false);
  };

  return (
    <>
      <GlyphButton
        accessibilityLabel="Dessiner sur la carte"
        size={DISC}
        style={styles.disc}
        onPress={() => setOpen(true)}
      >
        <Image source={TERRITORIES} style={styles.glyph} resizeMode="contain" />
      </GlyphButton>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        onClosed={() => {
          if (!leaving) return;
          const deed = leaving;
          setLeaving(null);
          deed();
        }}
        title="Dessiner"
        banner={BANNER}
        // Two lists that grow as the reader works; a panel resizing itself
        // around them would never be still.
        tall
        footer={
          <InkButton
            label="Fermer"
            variant="tonal"
            grow
            onPress={() => setOpen(false)}
          />
        }
      >
        <View style={styles.switcher}>
          <SegmentedControl segments={PARTS} value={part} onChange={setPart} />
        </View>

        <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
          {part === "territory" ? (
            <TerritoryList onDraw={() => after(onDraw)} />
          ) : (
            <PlaceList onPose={() => after(onPose)} />
          )}
        </ScrollView>
      </Sheet>
    </>
  );
}

/** L'onglet Territoires : ce que le lecteur a peint, et ce qu'il a ôté. */
function TerritoryList({ onDraw }: { onDraw: () => void }) {
  const { hidden, show, drawn, erase } = useHidden();
  const [busy, setBusy] = useState<string | null>(null);
  /** The drawn territory awaiting a "yes" before it is rubbed out. */
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(
    null,
  );
  const { say, dialog } = useNotice();

  const work = (key: string, deed: Promise<void>, failed: string) => {
    setBusy(key);
    void deed
      .catch((cause: unknown) =>
        say(failed, cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setBusy(null));
  };

  return (
    <>
      {dialog}

      <ConfirmDialog
        visible={asking !== null}
        title={`Effacer « ${asking?.name ?? ""} » ?`}
        /* Plus de `stake` : un territoire n'est jamais une copie, puisqu'il
           ne se copie plus. L'enjeu est donc toujours le même. */
        message="Il n'existe que sur votre carte : l'effacer est définitif."
        confirmLabel="Effacer"
        onConfirm={() => {
          const target = asking;
          setAsking(null);
          if (target) {
            work(target.id, erase(target.id), "Suppression impossible");
          }
        }}
        onClose={() => setAsking(null)}
      />

      <Roster
        owned="Vos territoires"
        count={drawn.length}
        addLabel="Dessiner un territoire"
        onAdd={onDraw}
      >
        {drawn.length === 0 ? (
          /* Une invitation, et rien de plus.
             Il y avait ici une explication — « un territoire dessiné est à
             vous seul, il apparaît aux années que vous lui donnez, et nulle
             part ailleurs ». Trois lignes sous un bouton qui dit déjà
             « Dessiner un territoire » : le lecteur apprend cela en le
             faisant, pas en lisant qu'il pourrait le faire. */
          <RosterEmpty>Dessinez votre premier territoire.</RosterEmpty>
        ) : (
          drawn.map((one) => (
            <RosterRow
              key={one.id}
              thumb={
                // Its own outline, the only likeness a territory has.
                // The initial stands in for a shape with no area, which
                // ought not to exist but costs one line to survive.
                one.shape ? (
                  <Silhouette shape={one.shape} size={THUMB - 6} />
                ) : (
                  <Text style={styles.initial}>
                    {one.name.charAt(0).toUpperCase()}
                  </Text>
                )
              }
              title={one.name}
              detail={
                busy === one.id
                  ? "Suppression…"
                  : `${formatYear(one.from)} – ${formatYear(one.to)}`
              }
              onEdit={() =>
                setAsking({ id: one.id, name: one.name })
              }
              editLabel={`Effacer ${one.name}`}
              editIcon={TRASH}
            />
          ))
        )}
      </Roster>

      {/* Only when there is something to say. An empty half-panel headed
          "Territoires retirés" would be a promise of a feature the reader
          has not used.

          Le même titre que celui de la liste du dessus, et sans porte ni
          dalle : on ne retire pas un territoire depuis ici, on l'y retrouve.
          La phrase comptée qui s'y trouvait — « 3 territoires retirés de
          votre carte » — disait son contenu au lieu de le nommer, et les
          deux moitiés de la feuille ne se lisaient plus de la même façon. */}
      {hidden.length === 0 ? null : (
        <View style={styles.section}>
          <RosterLegend label="Territoires retirés" count={hidden.length} />
          {hidden.map((name) => (
            <RosterRow
              key={name}
              thumb={
                <Text style={styles.initialFaded}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              }
              title={name}
              detail={busy === name ? "…" : "masqué à toutes les époques"}
              onEdit={() => work(name, show(name), "Impossible de le rétablir")}
              editLabel={`Rétablir ${name}`}
              editIcon={BACK_ON_MAP}
            />
          ))}
        </View>
      )}
    </>
  );
}

/**
 * Plus large que la cible tactile ordinaire, et c'est voulu.
 *
 * Il fut un disque de quarante-quatre points parmi trois. Il est seul
 * désormais — les deux autres sont devenus des onglets —, et un unique
 * bouton à la taille minimale sur une planche entière se lit comme un oubli
 * plutôt que comme une invitation.
 */
const DISC = 58;

const styles = StyleSheet.create({
  /**
   * Plein, en cire, et sans le bord taillé des disques de parchemin.
   *
   * `GlyphButton` reste générique — un disque flottant, sa forme et son
   * ombre — et c'est ici que ce bouton-ci prend sa couleur : il n'y a pas de
   * « disque de cire » dans le système, il y a ce bouton, qui agit sur la
   * planche et le dit.
   *
   * Le liseré clair du composant passe en cire sombre : clair, il aurait
   * cerné l'aplat d'un anneau pâle au lieu de lui donner l'épaisseur d'un
   * disque taillé.
   */
  disc: {
    backgroundColor: palette.wax,
    borderColor: palette.waxDeep,
    /**
     * Le relief, et il se fait **par-dessous**.
     *
     * `GlyphButton` porte déjà une ombre de disque flottant — opacité 0,26,
     * rayon 9, jetée quatre points plus bas. Celle-ci est plus dense, plus
     * étalée et tombe plus loin : le disque cesse de reposer sur la planche
     * pour s'en détacher franchement.
     *
     * Aucun reflet sur le haut, et c'est une leçon déjà apprise —
     * `GlyphButton` la garde écrite : un dégradé assez fort pour se lire
     * comme de la lumière se lit d'abord comme une seconde couleur, et le
     * disque paraît coupé en deux. Ce qui lève un objet, c'est le sombre
     * dessous, pas le clair dessus.
     */
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  /**
   * Blanc sur la cire, et large dans son disque sans le remplir.
   *
   * Vingt-six points sur cinquante-huit : il reste seize points de cire de
   * chaque côté, soit un peu moins de la moitié du disque pour le glyphe.
   * Au-delà, il touchait presque le bord et le disque cessait de se lire
   * comme un disque pour devenir un cadre.
   */
  glyph: { width: 26, height: 26, tintColor: palette.surfaceRaised },
  fill: { flex: 1 },
  switcher: { paddingHorizontal: space.xl, paddingBottom: space.md },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  section: { gap: space.md },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
  initialFaded: { fontSize: 18, fontWeight: "700", color: palette.line },
});
