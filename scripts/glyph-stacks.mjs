/**
 * Les piles de polices que le style demande, et rien d'autre.
 *
 * **Lu des deux côtés de la frontière**, comme `src/config/variants.js` : par
 * `scripts/generate-glyphs.mjs`, qui tourne dans Node et fabrique un dossier
 * par pile ; et par `glyphStacks.test.ts`, qui vérifie que cette liste est
 * encore celle de `src/map/style/typography.ts`.
 *
 * Pourquoi une liste de **piles** et non de polices : MapLibre demande la pile
 * entière dans un seul segment d'URL, les noms joints par des virgules —
 * `Noto%20Sans%20Bold,Noto%20Sans%20Regular/0-255.pbf`. Un serveur de fichiers
 * ne sait pas composer à la volée, donc chaque combinaison employée doit
 * exister comme dossier. C'est ce qui interdit de se contenter d'un dossier
 * par fonte.
 *
 * L'ordre compte : la première fonte qui possède un caractère l'emporte, les
 * suivantes ne bouchent que ses trous.
 */
export const FONT_STACKS = [
  ["Metropolis Semi Bold", "Noto Sans Bold"],
  ["Noto Sans Bold", "Noto Sans Regular"],
  ["Noto Sans Regular"],
  ["Noto Sans Italic", "Noto Sans Regular"],
];
