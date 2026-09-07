import type { ImageRequireSource } from "react-native";

import type { EventType } from "./types";

/**
 * Engraved glyphs for the map, rasterized from `assets/icons/src/*.svg` by
 * `npm run icons`. MapLibre Native draws bitmaps, so the vectors stay the
 * editable source and these PNGs are build output. The keys are the image ids
 * the symbol layer resolves through `["get", "type"]`.
 */
export const EVENT_ICONS: Record<EventType, ImageRequireSource> = {
  birth: require("../../../assets/icons/birth.png"),
  death: require("../../../assets/icons/death.png"),
  marriage: require("../../../assets/icons/marriage.png"),
  coronation: require("../../../assets/icons/coronation.png"),
  battle: require("../../../assets/icons/battle.png"),
  conquest: require("../../../assets/icons/conquest.png"),
  treaty: require("../../../assets/icons/treaty.png"),
  revolution: require("../../../assets/icons/revolution.png"),
  independence: require("../../../assets/icons/independence.png"),
  law: require("../../../assets/icons/law.png"),
  construction: require("../../../assets/icons/construction.png"),
  exploration: require("../../../assets/icons/exploration.png"),
  discovery: require("../../../assets/icons/discovery.png"),
  culture: require("../../../assets/icons/culture.png"),
  disaster: require("../../../assets/icons/disaster.png"),
  other: require("../../../assets/icons/other.png"),
};
