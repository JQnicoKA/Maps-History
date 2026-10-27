import { type ReactNode } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { palette } from "../../theme/palette";
import { radius, shadow, space, TOUCH, type } from "../../theme/tokens";

const PENCIL = require("../../../assets/icons/pencil.png");

/* Plus de fond gravé sur la porte de la bibliothèque.
   Elle a porté `fond_bouton_rechercher.png` sous un voile d'un tiers de noir,
   et toute une machinerie avec : la largeur mesurée à la pose pour en déduire
   la hauteur, une vue clipée pour que le découpage n'emporte pas l'ombre, et
   un voile pour que le blanc tienne sur une gravure claire. Un aplat noir ne
   demande rien de tout cela — le blanc y pèse 21 contre 1 — et c'est le même
   chemin que les trois boutons de la page Étudier, qui ont rendu leurs
   images. L'asset reste dans `assets`, inemployé. */

export const THUMB = 46;

/** The lens's ring, and the stroke both it and its handle are drawn with. */
const GLASS = 20;
const STROKE = 2.5;

export type RosterProps = {
  /**
   * Le titre de la liste, rendu avec son compte entre parenthèses.
   *
   * **Sous les deux portes et non au-dessus d'elles.** Le compte vivait en
   * tête, en petites capitales, et il y annonçait une liste qu'on ne voyait
   * pas encore — deux portes plus bas. Il est redevenu ce qu'il a toujours
   * été : l'en-tête des rangées qu'il compte. C'est le même geste que les
   * trois pages de collection, et pour la même raison.
   */
  owned: string;
  count: number;
  /**
   * The empty slot at the top, when this list is a place one adds to.
   *
   * Absent for a list that is only a **choice** — the people a tree or an
   * event may name. There, "make one more" is a door out of a half-finished
   * job, and the same rows have to serve without it.
   */
  addLabel?: string;
  onAdd?: () => void;
  /**
   * The other way to fill a list: what the community has already made.
   *
   * **Above** "make one", and the order is the argument: a list that is
   * missing something is answered better by what already exists than by
   * writing it again. Offering the blank slot first invites the duplicate
   * this whole feature is meant to prevent.
   */
  seekLabel?: string;
  /** A line under it, saying what is there. */
  seekDetail?: string;
  onSeek?: () => void;
  children: ReactNode;
};


export type SeekRowProps = {
  label: string;
  /** A line under it, saying what is there. */
  detail?: string;
  onPress: () => void;
};

/**
 * The door to what the community has already made.
 *
 * Its own component because it is wanted in two places now — at the head of
 * every list in the Add sheet, and at the foot of the picker that fills a
 * generation of a tree. Copied, the two would have drifted apart the first
 * time one of them was touched.
 */
export function SeekRow({ label, detail, onPress }: SeekRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.seek, pressed && styles.pressed]}
    >
      {/* Rien derrière la loupe et les mots : l'aplat du bouton est tout le
          fond. La vue qui portait l'image et son voile a disparu avec eux. */}
      <Lens />
      <View style={styles.seekText}>
        <Text style={styles.seekLabel}>{label}</Text>
        {detail === undefined ? null : (
          <Text style={styles.seekDetail}>{detail}</Text>
        )}
      </View>
      <Text style={styles.seekMore}>›</Text>
    </Pressable>
  );
}

/**
 * A magnifying glass, drawn: a ring of wax and a handle off its corner.
 *
 * Drawn rather than set as a glyph because 🔍 arrives in somebody else's
 * colours and at somebody else's angle, and the door to the community sits
 * beside text in wax.
 *
 * **Exported because it was twice a stylesheet, and the two drifted.** The
 * copy in the event form had its handle 5 points from the corner where this
 * one had 11, which on a box of `THUMB` put it clear outside the ring — a lens
 * in two pieces. A number going quietly wrong in a second stylesheet is not
 * something anybody reviews; one drawing leaves nothing to keep in step.
 */
export function Lens() {
  return (
    <View style={styles.lens}>
      <View style={styles.lensGlass} />
      <View style={styles.lensHandle} />
    </View>
  );
}

export type AddSlotProps = { label: string; onPress: () => void };

/** The empty slot waiting to be filled — the other half of `SeekRow`. */
export function AddSlot({ label, onPress }: AddSlotProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.add, pressed && styles.pressed]}
    >
      <View style={styles.plus}>
        <Text style={styles.plusGlyph}>+</Text>
      </View>
      <Text style={styles.addLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * The shape every list in the Add sheet takes.
 *
 * Characters and trees were each drawing their own version of the same thing
 * — a count, a dashed slot to make one more, then rows — and they had drifted
 * apart in spacing, in radius, in the size of a thumbnail. They share it now,
 * so a change to the way a list feels is made once. Les classeurs en étaient
 * le troisième usage, jusqu'à ce qu'ils cessent d'être des entités.
 */
export function Roster({
  owned,
  count,
  addLabel,
  onAdd,
  seekLabel,
  seekDetail,
  onSeek,
  children,
}: RosterProps) {
  return (
    <View style={styles.list}>
      {onSeek === undefined ? null : (
        <SeekRow
          label={seekLabel ?? "Rechercher"}
          {...(seekDetail === undefined ? {} : { detail: seekDetail })}
          onPress={onSeek}
        />
      )}

      {onAdd === undefined ? null : (
        <AddSlot label={addLabel ?? "Ajouter"} onPress={onAdd} />
      )}

      <RosterLegend label={owned} count={count} />

      {children}
    </View>
  );
}

/**
 * Le titre d'une liste, avec son compte.
 *
 * Exporté parce qu'une feuille en porte parfois deux — les territoires
 * dessinés, puis ceux qu'on a retirés de la carte — et que la seconde n'a
 * ni porte ni dalle à sa tête : elle n'est qu'un titre et des rangées.
 */
export function RosterLegend({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <Text style={styles.owned}>
      {label} <Text style={styles.count}>({count})</Text>
    </Text>
  );
}

/** Shown in place of the rows, when there are none. */
export function RosterEmpty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export type RosterRowProps = {
  /** A picture, an initial, an emoji — whatever stands for this one. */
  thumb: ReactNode;
  title: string;
  detail?: string;
  /** The pencil, when there is something to edit. */
  onEdit?: () => void;
  editLabel?: string;
  /**
   * What that button shows, when a pencil would be a lie.
   *
   * Most rows open a card to be corrected. A few carry their one action on the
   * row itself — rubbing out a territory, putting one back — and a pencil over
   * a deletion is worse than no icon at all.
   */
  editIcon?: ImageSourcePropType;
  /**
   * Le rouge, pour une action qui détruit.
   *
   * Encre par défaut. `danger` n'est pas une insistance mais un
   * avertissement : sur une rangée qui porte deux boutons, c'est ce qui
   * distingue d'un coup d'œil celui qu'on vise exprès de celui qu'on peut
   * toucher sans conséquence.
   */
  editTone?: "ink" | "danger";
  /**
   * Une seconde action, posée avant la première.
   *
   * Une rangée n'en portait qu'une, ce qui suffisait tant que chaque liste
   * n'offrait qu'un geste. Les territoires en ont deux — reprendre le
   * dessin, l'effacer — et les mettre dans un menu pour deux boutons aurait
   * coûté une touche de plus à chacun des deux.
   *
   * Avant, parce que l'ordre des listes de cette application va du plus
   * anodin au plus définitif : on lit de gauche à droite, et la poubelle est
   * ce qu'on doit viser exprès.
   */
  onAside?: () => void;
  asideLabel?: string;
  asideIcon?: ImageSourcePropType;
  /** The whole row, when the row itself opens something. */
  onPress?: () => void;
  /**
   * Out of reach, and saying so.
   *
   * For a list that must show what it cannot offer: hiding those rows would
   * leave a reader hunting for a name that is right there, and let them
   * believe the list is short when it is only filtered. Pair it with no
   * `onPress` — faded *and* still pressable is the worst of both.
   */
  muted?: boolean;
};

export function RosterRow({
  thumb,
  title,
  detail,
  onEdit,
  editLabel,
  editIcon = PENCIL,
  editTone = "ink",
  onAside,
  asideLabel,
  asideIcon = PENCIL,
  onPress,
  muted = false,
}: RosterRowProps) {
  const body = (
    <>
      <View style={styles.thumb}>{thumb}</View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {detail === undefined || detail === "" ? null : (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {onAside ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={asideLabel ?? "Modifier"}
          hitSlop={8}
          onPress={onAside}
          style={({ pressed }) => [styles.edit, pressed && styles.editPressed]}
        >
          <Image source={asideIcon} style={styles.pencil} resizeMode="contain" />
        </Pressable>
      ) : null}
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editLabel ?? "Modifier"}
          hitSlop={8}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.edit,
            editTone === "danger" && styles.editDanger,
            pressed &&
              (editTone === "danger"
                ? styles.editDangerPressed
                : styles.editPressed),
          ]}
        >
          <Image
            source={editIcon}
            style={[
              styles.pencil,
              editTone === "danger" && styles.pencilDanger,
            ]}
            resizeMode="contain"
          />
        </Pressable>
      ) : null}
      {onPress && !onEdit && !onAside ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, muted && styles.muted]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        muted && styles.muted,
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const EDIT = 36;

const styles = StyleSheet.create({
  list: { gap: space.md },
  /** En gras : c'est un titre. Un peu d'air au-dessus, pour fermer la série
      des portes et ouvrir celle des rangées. */
  owned: {
    ...type.heading,
    fontWeight: "700",
    color: palette.ink,
    paddingTop: space.sm,
  },
  /** Le compte hérite la graisse et change d'encre : c'est une précision. */
  count: { ...type.heading, color: palette.inkFaint },
  empty: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },

  /**
   * The empty space where the next one will be stuck.
   *
   * Dashed and unfilled, leaning the other way from the cards above it: it
   * is a gap in the page rather than a thing on it, and the difference is
   * what makes it read as an invitation.
   */
  /**
   * La dalle vide, en cire elle aussi — mais en pointillé.
   *
   * Elle était cernée d'un filet de bord et portait un carré de la même
   * teinte : sur un fond devenu presque blanc, le pointillé pesait 1,22 et
   * le `+` **blanc sur un carré pâle** valait 1,31 — il avait tout
   * simplement disparu. La porte la moins visible de la page était celle qui
   * sert à écrire.
   *
   * Elle prend donc la cire, comme sa voisine, et c'est le **trait** qui les
   * sépare désormais : plein pour un lieu qui existe déjà, pointillé pour
   * une place qu'on va remplir. Les deux se voient, et elles ne disent
   * toujours pas la même chose.
   */
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: palette.wax,
  },
  /**
   * Le carré du `+`, plein, en écho à la loupe blanche de la porte voisine.
   *
   * C'est le seul aplat de cire de cette rangée : il donne au geste un point
   * d'appui sans que la dalle entière pèse autant que la porte pleine.
   */
  plus: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.wax,
  },
  plusGlyph: { fontSize: 25, lineHeight: 29, color: palette.surfaceRaised },
  /** En cire et au même poids que « Rechercher » : deux portes, deux mots. */
  addLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: palette.wax },

  /**
   * The other way to fill a list.
   *
   * In wax rather than dashed: the slot above is an empty space waiting to be
   * filled, this is a door to somewhere that is already full.
   *
   * **Pleine, et plus seulement cernée.** Elle n'était qu'un contour de cire
   * sur du papier, du temps où le papier était du parchemin : le contraste
   * suffisait. Les surfaces ont passé au blanc et un simple filet y pesait
   * moins qu'avant, alors que c'est la porte la plus utile de la page —
   * celle qui mène à ce qui existe déjà, et qui évite le doublon que toute
   * la bibliothèque est faite pour prévenir. Elle est donc en cire pleine,
   * et la dalle de création garde son pointillé : l'une est un lieu, l'autre
   * une place vide.
   *
   * Le bord reste, assombri : c'est le bord taillé des objets pleins de
   * cette application — voir `GlyphButton` — et il donne au rectangle une
   * épaisseur que l'aplat seul ne suggère pas.
   *
   * **L'aplat est passé de la cire au cuir de reliure.** La cire veut dire
   * « voici ce que vous lisez » — elle marque l'élément sous l'œil sur la
   * planche, et l'onglet ouvert dans la barre. Cette porte-ci ne marque
   * rien : elle mène ailleurs, à ce que d'autres ont écrit. Un brun de
   * reliure appartient à la page sans y prétendre au rang de la cire.
   */
  seek: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    paddingRight: space.md,
    /* Plus rond que les cartes de la liste, qui portent `md`. L'alignement
       a été essayé et il n'a pas plu : cette porte n'est pas une rangée de
       plus, et son coin plus ouvert est ce qui le dit. */
    borderRadius: radius.lg,
    backgroundColor: palette.ink,
    /**
     * Sans bord, et c'est l'ombre qui tient la porte.
     *
     * Le filet de reliure l'a cernée tant qu'elle portait une gravure : un
     * trait brun autour d'une image brune se lit comme un cadre rapporté
     * plutôt que comme le bord de l'objet. L'aplat noir ne le rappellerait
     * pas davantage — un liseré sur du noir est soit invisible, soit un
     * second noir qu'on cherche à distinguer du premier.
     *
     * C'est le chemin déjà pris par les deux boutons de la planche, le
     * crayon et la pastille des filtres : l'un et l'autre ont perdu leur
     * liseré et se détachent par leur seule ombre.
     */
    borderWidth: 0,
    /**
     * L'ombre, qui manquait — et c'est elle qui faisait tout.
     *
     * Chaque rangée de ces pages est une carte posée sur le papier, avec
     * son ombre ; cette porte était le seul grand bloc à n'en avoir
     * aucune. Elle ne reposait pas sur la page, elle y était collée, et
     * aucun réglage de couleur ne pouvait corriger ça — on avait essayé
     * de l'éclaircir, ce qui ne faisait qu'une tache plus pâle.
     *
     * Plus dense que `shadow.soft` des rangées — 0,22 contre 0,12 — parce
     * qu'une ombre se lit par son écart au fond qu'elle assombrit, et
     * qu'un objet sombre en réclame davantage pour que l'œil la distingue
     * de l'objet lui-même. Plus courte aussi, et jetée moins loin : elle
     * lève la porte d'un cran au-dessus des cartes, pas d'un étage.
     */
    shadowColor: "#2A1F12",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  /** A lens, drawn: a ring and a handle. */
  lens: {
    width: THUMB,
    height: THUMB,
    alignItems: "center",
    justifyContent: "center",
  },
  lensGlass: {
    width: GLASS,
    height: GLASS,
    borderRadius: GLASS / 2,
    borderWidth: STROKE,
    borderColor: palette.surfaceRaised,
  },
  /**
   * Two points inside the ring's own corner, so the handle starts *under* the
   * glass rather than beside it.
   *
   * The ring is centred, so its bottom-right edge sits `(THUMB - GLASS) / 2`
   * from the corner — 13 here. Anything much larger than that leaves a gap,
   * which is precisely how the form's copy came to be broken. Written as the
   * arithmetic rather than as 11, so that changing `THUMB` or `GLASS` carries
   * the handle along instead of silently detaching it.
   */
  lensHandle: {
    position: "absolute",
    right: (THUMB - GLASS) / 2 - 2,
    bottom: (THUMB - GLASS) / 2 - 2,
    width: 9,
    height: STROKE,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    transform: [{ rotate: "45deg" }],
  },
  seekText: { flex: 1, gap: 2 },
  /** Blanc, et le mot porte le poids de la porte. */
  seekLabel: { fontSize: 15, fontWeight: "700", color: palette.surfaceRaised },
  /**
   * La seconde ligne, voilée plutôt qu'en encre pâle.
   *
   * Elle était en `inkSoft`, ce qui marchait sur du papier et disparaît sur
   * un aplat sombre. Du blanc à quatre-vingts pour cent la met un cran sous
   * le libellé sans lui donner une couleur à elle, ce qui ferait trois tons
   * sur un objet qui n'en veut qu'un. Sur le noir plein elle donne `#CCCCCC`,
   * soit 13,1:1 — c'était 7,3 sur la gravure voilée.
   */
  seekDetail: { ...type.caption, color: "rgba(255, 255, 255, 0.8)" },
  seekMore: {
    fontSize: 18,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.8)",
  },

  /** A card stuck on the page: white paper, a soft shadow, square corners. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: THUMB + 2 * space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...shadow.soft,
  },
  /**
   * A photograph, not a badge: square with a white border, the way a print
   * pasted in a notebook keeps its margin.
   */
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
    borderWidth: 3,
    borderColor: palette.surfaceRaised,
    ...shadow.soft,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15.5, fontWeight: "700", color: palette.ink },
  detail: { ...type.caption, color: palette.inkFaint },

  edit: {
    width: EDIT,
    height: EDIT,
    minWidth: TOUCH - 8,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  editPressed: { backgroundColor: palette.border },
  /**
   * Le rouge posé sur le papier, et non imprimé dedans.
   *
   * `dangerWash` est écrit dans la palette pour ce rôle exact — « le fond
   * d'un panneau d'avertissement, là où un rouge plein crierait et un gris
   * ne dirait rien ». Le carré prend donc la place qu'occupait le gris
   * creusé, à la même profondeur : 1,29 contre le papier de la rangée, où
   * le gris en valait 1,24. Rien ne bouge, seule la couleur change de
   * nature.
   *
   * **Opaque, et c'est voulu.** Un lavis translucide se poserait autrement
   * sur chaque fond — une rangée blanche, une feuille, un panneau — et le
   * même bouton n'aurait pas deux fois la même couleur. C'est l'argument
   * que porte déjà `dangerWash` dans la palette.
   */
  editDanger: { backgroundColor: palette.dangerWash },
  /** Enfoncé, le lavis se soutient d'un cran, comme les autres creux. */
  editDangerPressed: { backgroundColor: "#E8CFC2" },
  pencil: { width: 16, height: 16, opacity: 0.75 },
  /**
   * Le rouge plein sur son propre lavis : 5,1:1.
   *
   * À pleine opacité. Le voile de trois quarts qui adoucit les glyphes
   * d'encre le ramènerait vers son fond, c'est-à-dire vers le rose.
   */
  pencilDanger: { tintColor: palette.danger, opacity: 1 },
  chevron: { fontSize: 22, color: palette.inkFaint, paddingRight: space.xs },
  pressed: { opacity: 0.55 },
  /** Assez pâle pour qu'on n'essaie pas, assez lisible pour qu'on lise. */
  muted: { opacity: 0.45 },
});
