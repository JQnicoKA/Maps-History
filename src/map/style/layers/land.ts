import type { LayerSpecification } from "@maplibre/maplibre-react-native";

import { SOURCE } from "../sources";
import { palette } from "../../../theme/palette";

/**
 * The parchment itself plus the hand-applied colour washes over it. Fills stay
 * translucent so the paper tone reads through every landcover class.
 */
export function landLayers(): LayerSpecification[] {
  return [
    {
      id: "paper",
      type: "background",
      paint: { "background-color": palette.paper },
    },
    /* Plus de `globallandcover-wash`, et c'est définitif.

       Ce calque imprimait les aplats de couvert aux échelles mondiale et
       continentale, là où `landcover` ne porte que des glaciers — mesuré sur
       une vraie tuile : un kilooctet à z5, rien que de la banquise. Il ne
       coûtait rien, puisque ces cent kilooctets arrivaient déjà dans chaque
       tuile et étaient jetés sans être lus.

       Mais `globallandcover` **n'existe pas hors de chez MapTiler** : il n'est
       pas du schéma OpenMapTiles qu'implémente Planetiler, faute d'y trouver
       le raster dont il dérive. Depuis que le fond vient de notre propre
       archive, ce calque ne dessinait plus rien — exactement ce que
       `docs/brancher-les-tuiles.md` avait prévu, et ce que son propre
       commentaire annonçait : « the day we read our own archive, this draws
       nothing ».

       Les continents sont donc du parchemin nu sous z7, où `landcover`
       reprend la main. C'est l'aspect qu'avait la carte avant le 1er octobre
       2026, et il plaisait.

       Pour le retrouver un jour, la sortie est notée : fabriquer le wash de
       bas zoom depuis Natural Earth, qui est déjà l'une des quatre sources de
       Planetiler et relève du domaine public. Demande un profil sur mesure,
       en Java. */
    {
      id: "landcover-wash",
      type: "fill",
      source: SOURCE.base,
      "source-layer": "landcover",
      filter: ["!=", ["get", "class"], "ice"],
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood",
          palette.forest,
          "grass",
          palette.scrub,
          "farmland",
          palette.scrub,
          "sand",
          palette.sand,
          "wetland",
          palette.wetland,
          palette.paperDeep,
        ],
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.3,
          4,
          0.45,
          8,
          0.5,
        ],
        // Washes abut each other; antialiasing their shared edges only produces
        // seams, and turning it off is measurably cheaper at world zoom.
        "fill-antialias": false,
      },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: SOURCE.base,
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      paint: {
        "fill-color": palette.ice,
        "fill-opacity": 0.85,
        "fill-antialias": false,
      },
    },
  ];
}
