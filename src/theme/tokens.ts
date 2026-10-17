import { Platform } from "react-native";

/**
 * The measurements the interface is built from.
 *
 * The map is a deliberate antique; the chrome laid over it is not. It follows
 * current mobile conventions — bottom sheets, generous radii, soft elevation,
 * 44pt targets — while borrowing nothing but its colours from the plate. Having
 * the numbers in one place is what keeps five surfaces looking like one app.
 */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** iOS Human Interface minimum for a comfortable touch target. */
export const TOUCH = 44;

export const shadow = {
  /** Cards resting on the plate. */
  soft: {
    shadowColor: "#2A1F12",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /**
   * Ce qui flotte au-dessus de la carte.
   *
   * Plus dense et plus courte que `soft`, et jetée plus bas. Une tuile posée
   * sur une page claire se détache par son filet ; posée sur un trait de
   * côte, un lavis de territoire et trois noms de ville, elle n'a que son
   * ombre pour le faire — aucun bord ne tient sur un fond qui change tous
   * les dix points. C'est la leçon que les disques flottants avaient déjà
   * apprise.
   */
  plate: {
    shadowColor: "#2A1F12",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  /** Sheets and floating controls. */
  lifted: {
    shadowColor: "#2A1F12",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
} as const;

/**
 * The face the chrome borrows from the plate.
 *
 * Every panel in this app is a sheet of the same atlas, and an atlas is set in
 * a serif. It is used for titles only: a whole interface in Palatino would be
 * a costume, while a serif heading over sans-serif text is how a printed plate
 * has always been laid out.
 *
 * Built into both systems, so nothing is downloaded and nothing can fail to
 * arrive — Palatino on iOS, the platform serif elsewhere.
 */
export const SERIF = Platform.select({
  ios: "Palatino",
  android: "serif",
  default: "serif",
});

export const type = {
  /** A panel's name, in the atlas's own voice. */
  plate: {
    fontFamily: SERIF,
    fontSize: 25,
    letterSpacing: 0.2,
  },
  title: { fontSize: 21, letterSpacing: 0.2 },
  heading: { fontSize: 17, letterSpacing: 0.2 },
  body: { fontSize: 15, lineHeight: 22 },
  /**
   * Une phrase secondaire : sous un contrôle, sous un titre, dans une carte.
   *
   * **C'est elle et non `legend` qu'il faut pour une phrase.** La légende met
   * en capitales — c'est sa définition — et douze mots en capitales ne se
   * lisent pas, ils se déchiffrent. La règle a été posée après coup, sur une
   * douzaine de styles qui avaient emprunté la légende pour des phrases
   * entières : « VOUS SOUHAITEZ CRÉER CET ÉVÉNEMENT VOUS-MÊME. »
   */
  caption: { fontSize: 13, lineHeight: 18 },
  /**
   * The one place the atlas voice survives: small capitals.
   *
   * Tracked out, but less than they were: 1.1 drew the letters so far apart
   * that a whole sentence — "votre nom dans la communauté" — had to be read
   * letter by letter instead of recognised as words. Capitals do need air,
   * having neither ascenders nor descenders to tell them apart, so the air is
   * kept; there is simply a third of it.
   */
  legend: {
    fontSize: 11,
    letterSpacing: 0.1,
    textTransform: "uppercase",
  },
} as const;

export const BACKDROP = "rgba(36, 27, 16, 0.42)";

/**
 * Le voile d'une carte qui s'ouvre sur une surface déjà voilée.
 *
 * Le même brun, moins appuyé. Deux `BACKDROP` l'un sur l'autre font deux tiers
 * de brun sur tout l'écran, ce qui se lit comme une panne d'affichage ; aucun
 * voile du tout laisse du papier clair sur du papier clair, séparés par la
 * seule ombre, et la carte ne ressort pas. Celui-ci assombrit juste assez pour
 * que le bord de la carte se voie.
 */
export const BACKDROP_SOFT = "rgba(36, 27, 16, 0.18)";
