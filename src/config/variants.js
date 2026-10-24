/**
 * Les trois applications qu'un seul code fabrique.
 *
 * **Cette table est lue des deux côtés de la frontière**, et c'est tout son
 * intérêt : par `app.config.ts`, qui tourne dans Node au moment de bâtir et
 * déclare le schéma d'URL au système ; et par `config/env.ts`, qui tourne sur
 * le téléphone et construit les adresses de retour.
 *
 * Elle existe parce que les deux l'ont fait chacun de leur côté et ont fini
 * par diverger : `app.config.ts` déclarait `mapshistory-dev`, `env.ts`
 * recollait le nom de la variante et demandait `mapshistory-development`. Le
 * système ne connaissait donc pas le schéma que l'application réclamait, et
 * Supabase, ne le trouvant pas dans sa liste blanche, renvoyait le lecteur
 * vers le site du projet — une connexion Google qui aboutissait partout sauf
 * là où il fallait.
 *
 * **En JavaScript et non en TypeScript**, avec ses types dans le `.d.ts`
 * voisin : le chargeur de configuration d'Expo compile `app.config.ts` mais
 * ne sait pas résoudre un module TypeScript importé par lui. Un fichier `.js`
 * se require sans cérémonie, et le `.d.ts` rend à l'application le typage
 * qu'elle aurait eu.
 */
const VARIANTS = {
  development: {
    suffix: ".dev",
    name: "HistoryNote dev",
    scheme: "mapshistory-dev",
  },
  preview: {
    suffix: ".preview",
    name: "HistoryNote test",
    scheme: "mapshistory-preview",
  },
  production: {
    suffix: "",
    name: "HistoryNote",
    scheme: "mapshistory",
  },
};

/** Ce que dit l'environnement, ramené à une variante connue. */
function variantOf(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed && trimmed in VARIANTS ? trimmed : "production";
}

module.exports = { VARIANTS, variantOf };
