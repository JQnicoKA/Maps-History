/**
 * Aged-atlas palette. Single source of truth for both the MapLibre style and
 * the surrounding UI, so map and chrome never drift apart.
 */
export const palette = {
  /**
   * Land base — the parchment the map is printed on.
   *
   * **La planche a été éclaircie de vingt points par canal**, le jour où
   * l'interface est passée au blanc : à côté d'elle, le parchemin tirait au
   * brun. Douze d'abord, puis huit de plus. Un décalage additif et non une fraction vers le blanc, parce qu'il
   * **préserve les écarts** — le désert se détache de la terre exactement
   * comme avant (1,072 contre 1,069), tandis qu'un éclaircissement
   * proportionnel les aurait tous resserrés et aurait fondu le sable dans le
   * sol.
   *
   * Seules les **surfaces** ont monté : les fonds, les lavis, l'eau, la
   * lumière du relief et les neuf teintes de territoire. L'encre, les
   * rivières, l'ombre du relief et le liseré des frontières n'ont pas
   * bougé — on éclaircit le papier, pas le dessin, et la lisibilité y gagne
   * (l'encre sur la terre passe de 7,8:1 à 8,8:1).
   *
   * Plusieurs tons ont pris moins que leur dû, faute de place avant le
   * blanc : écrêter un canal aurait déplacé la teinte au lieu de
   * l'éclaircir. `ice` et `reliefHighlight` sont au plafond, et `sand` n'a
   * pris que six points au second passage — c'est tout le prix de ce
   * réglage, et il se paie sur le désert, qui se détache un peu moins de la
   * terre nue (1,07 à 1,05). Le sable *est* de la terre nue ; la forêt et la
   * mer, qui portent la structure de la planche, n'ont rien perdu.
   *
   * **Ces trois-là appartiennent à la planche**, et plus à l'interface. Ils
   * peignent le fond de terre, le halo des étiquettes et les deux nuances de
   * relief ; la chrome, elle, a pris `surface` et `surfaceRaised`.
   *
   * La séparation date du jour où l'interface s'est éclaircie d'un cran.
   * Permuter les valeurs ici aurait suffi — ce fichier était la source unique
   * des deux — mais la terre serait devenue si claire que le lavis `sand` des
   * déserts s'y serait fondu (écart de 1,07 à 1,04), et chaque nom de ville
   * aurait porté un liseré blanc pur sur du sépia. Une carte ancienne et une
   * interface contemporaine ne veulent pas le même blanc.
   */
  paper: "#FBECCC",
  paperLight: "#FFF3D9",
  paperDeep: "#F1DFB9",

  /**
   * Les deux surfaces de l'interface, et rien de la carte.
   *
   * `surface` est le sol d'une page — ce sur quoi on pose. `surfaceRaised`
   * est tout ce qui s'en détache d'un cran : un bandeau fixe, une feuille,
   * une carte, un champ, la barre d'onglets.
   *
   * Le sol a d'abord pris le ton que les panneaux portaient — une permutation
   * exacte, chaque chose montant d'un cran. Il se lisait encore comme du
   * parchemin, ce qui était vrai : c'en était. Il est donc monté d'un cran de
   * plus. Il garde un fil de chaleur, assez pour tenir avec la carte, trop
   * peu pour qu'on y voie du crème.
   *
   * L'écart avec le blanc levé est de 1,08 — à peine moins que les 1,12 que
   * le parchemin avait avec les panneaux. Ce n'est pas lui qui détache un
   * bandeau ou une carte : c'est leur filet et leur ombre, et c'est pour cela
   * qu'ils en portent un.
   */
  surface: "#FAF6EC",
  surfaceRaised: "#FFFFFF",

  /**
   * Le bord d'une surface d'interface : un filet de feuille, le pointillé
   * d'une dalle vide, le liseré d'une case à cocher.
   *
   * **Il valait `paperDeep`, et c'était un couplage silencieux.** Ce ton-là
   * appartient à la planche — il y peint deux nuances de relief — et il
   * servait en même temps à border la chrome. Éclaircir la carte de vingt
   * points a donc pâli ces bords au passage, sans que personne l'ait
   * demandé. Rien n'a cassé cette fois ; la prochaine, un réglage de la
   * carte redéplacerait encore des traits d'interface.
   *
   * La valeur est exactement celle que les bords portaient à l'issue de cet
   * éclaircissement : rien ne change à l'écran, seule la dépendance est
   * coupée. Elle est désormais un choix et non un effet de bord.
   *
   * `line` est son voisin et reste distinct : plus marqué (1,61 sur le blanc
   * contre 1,31), il sépare deux choses de même nature — deux rangées d'une
   * liste — là où celui-ci cerne une surface.
   */
  border: "#F1DFB9",

  /** Sepia printing ink, from heavy plate lines to faded engraving. */
  ink: "#4A3927",
  inkSoft: "#6E5940",
  inkFaint: "#8C7A5F",

  /** Hand-applied washes over the base colour. */
  forest: "#DDD0A4",
  scrub: "#F0E3B7",
  sand: "#FFF2CE",
  ice: "#FFFAED",
  wetland: "#DAD7B4",

  /** Hydrography. */
  ocean: "#BDD4D6",
  oceanDeep: "#A0BDC1",
  lake: "#C7DCDD",
  river: "#7F9DA1",
  waterInk: "#5C787D",

  /** Relief shading. */
  reliefHighlight: "#FFF7E3",
  reliefShadow: "#7A6242",

  /** Border wash printed under the plate line. */
  borderWash: "#B08A5E",

  /**
   * Flat washes for territories, in the manner of a hand-coloured plate.
   *
   * **Nine, and the count is not arbitrary.** The washes are handed out by map
   * colouring, so that no two polities that ever shared a border share a wash.
   * On this graph — the union of every date's map, and therefore not planar —
   * eight colours leave exactly one border uncoloured and nine leave none.
   * Adding or removing one means re-running `scripts/colour-polities.mjs`,
   * whose `COLOURS` must match this length.
   *
   * All nine sit near L 60 and C 19 so no polity shouts louder than another;
   * they are told apart by hue, and the periwinkle fills the one wide gap the
   * other eight left between slate and mauve.
   */
  washes: [
    "#C49C72", // terre cuite
    "#A3B48E", // vert-de-gris
    "#BC9492", // vieux rose
    "#92A4AC", // bleu ardoise
    "#C7AE77", // ocre
    "#A89A93", // taupe
    "#93A382", // olive
    "#BB9EAA", // mauve
    "#A2A2C2", // pervenche
  ],

  /** Hairlines and dividers: ink at a whisper, for modern chrome. */
  line: "#D8CBAE",
  /**
   * Recessed surfaces — inputs, tracks, unselected segments.
   *
   * **Éclairci avec les surfaces, et il avait été oublié.** Il valait
   * `#E3D6B8`, réglé pour creuser un panneau de parchemin : 1,14 contre son
   * fond, le temps qu'il faut pour voir un champ sans qu'il fasse un trou.
   * Les panneaux sont passés au blanc et lui n'a pas bougé — le même creux
   * y pesait 1,44, soit trois fois le pas d'origine, et chaque champ se
   * lisait comme une tache.
   *
   * À 1,24 sur le blanc, le champ se trouve sans se jeter dessus. Il garde
   * 1,15 contre le fond des pages, ce qui compte autant : un champ ne vit
   * pas toujours dans une feuille, et à peine plus pâle il y aurait disparu.
   *
   * **Puis il a été désaturé, à clarté rigoureusement égale.** Éclairci, il
   * valait `#F3E6C8` et paraissait jaune : à cette hauteur, 43 points
   * d'écart entre le rouge et le bleu ne se lisent plus comme du parchemin
   * mais comme une couleur. Le fond des pages n'en a que 14. Celui-ci en a
   * 15 — la même température que ce sur quoi il se pose, simplement un cran
   * plus sombre, ce qui est tout ce qu'un creux doit être.
   *
   * La profondeur est inchangée : désaturer ne touche pas à la luminance,
   * et les deux rapports valent au point près ce qu'ils valaient.
   */
  sunken: "#EBE7DC",

  /**
   * Ce qui a abouti, et rien d'autre.
   *
   * **Il a manqué d'exister, et ça s'est vu.** Trois endroits employaient
   * `forest` — un **lavis de la carte** — comme encre de réussite : la jauge
   * d'un mot de passe complet, la coche d'une entrée déjà copiée, la phrase
   * qui dit qu'un mot de passe a changé. Le jour où la planche a été
   * éclaircie de vingt points, ce lavis est passé à 1,54 sur le blanc : les
   * trois ont disparu sans que rien ne le signale, parce qu'un lavis n'a
   * aucune raison d'être lisible — il est fait pour couvrir des pays, pas
   * pour écrire.
   *
   * Celui-ci est une encre : 5,7:1 sur le blanc, 4,6 sur un champ creusé.
   * Vert franc et un peu sourd, pour tenir à côté de la cire sans lui
   * disputer l'attention.
   */
  good: "#44704A",

  /**
   * Deletion, and nothing else.
   *
   * A true red rather than the wax: the wax means "here is what you are
   * reading", and the two must not be confused on a button that destroys
   * something. Still slightly warm, so it belongs to this paper.
   */
  danger: "#B3261E",

  /**
   * The same red laid on the paper rather than printed in it.
   *
   * For the ground of a warning panel, where a solid red would shout and a
   * plain grey would say nothing. Opaque rather than translucent, so it sits
   * the same whatever is behind it — the grain included.
   */
  dangerWash: "#F3DFD4",

  /** Sealing wax — marks the event currently under the reader's eye. */
  wax: "#8C3A2B",
  waxDeep: "#6E2C21",
} as const;
