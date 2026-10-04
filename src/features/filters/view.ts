/**
 * Carte ou liste, et de quoi le demander.
 *
 * Ce choix vivait dans la fenêtre « Votre compte », où il n'avait rien à faire :
 * la vue n'est pas un réglage de compte, c'est ce qu'on regarde. Il est passé
 * dans les filtres, auprès des trois calques — on y décide de la même chose,
 * ce que l'écran montre.
 */
export type ScreenView = "map" | "list";

export const VIEWS = [
  {
    value: "map" as const,
    label: "Carte",
    icon: require("../../../assets/icons/view-map.png"),
  },
  {
    value: "list" as const,
    label: "Liste",
    icon: require("../../../assets/icons/view-list.png"),
  },
];
