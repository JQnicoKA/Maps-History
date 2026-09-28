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
  caption: { fontSize: 13, lineHeight: 18 },
  /** The one place the atlas voice survives: small tracked-out capitals. */
  legend: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
} as const;

export const BACKDROP = "rgba(36, 27, 16, 0.42)";
