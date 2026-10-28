# Les polices dont nos glyphes sont tirés

Ce ne sont pas des polices **embarquées** : rien ici n'entre dans le bundle de
l'application. Ce sont les sources que `npm run glyphs` moud en dossiers de
glyphes, dans `build/glyphs/`, destinés à être servis.

| Fichier | Nom interne — celui que `typography.ts` doit écrire | Licence |
|---|---|---|
| `NotoSans-Regular.ttf` | `Noto Sans Regular` | SIL OFL 1.1 |
| `NotoSans-Bold.ttf` | `Noto Sans Bold` | SIL OFL 1.1 |
| `NotoSans-Italic.ttf` | `Noto Sans Italic` | SIL OFL 1.1 |
| `Metropolis-SemiBold.ttf` | `Metropolis Semi Bold` | Unlicense (domaine public) |

Le nom qui compte est **celui que la police porte en elle**, pas celui du
fichier : `famille` + `style`. `npm run glyphs` l'imprime à chaque passage, et
refuse de travailler si une pile réclame un nom absent — un « SemiBold » qui se
croyait « Semi Bold » ne se verrait sinon qu'à l'exécution, en étiquettes
manquantes.

## D'où elles viennent

- **Noto Sans** — <https://github.com/notofonts/latin-greek-cyrillic>,
  dossier `fonts/NotoSans/hinted/ttf` de `notofonts.github.io`. Latin, grec et
  cyrillique, 2 964 caractères.
- **Metropolis** — <https://github.com/dw5/Metropolis>,
  `Fonts/TrueType/Metropolis-SemiBold.ttf`. 306 caractères, latin seul : c'est
  pourquoi sa pile se replie sur `Noto Sans Bold`, qui bouche ses trous. Les
  accents français viennent donc de Noto, et c'est vérifié.

## Les licences voyagent avec

`OFL-NotoSans.txt` et `UNLICENSE-Metropolis.txt` sont ici parce que **l'OFL
l'exige** : la licence doit accompagner la police et tout ce qui en dérive. Les
fichiers `.pbf` de `build/glyphs/` **sont** des dérivés — ils contiennent les
contours redessinés en empreintes de distance. Si vous les servez depuis un
domaine public, posez la licence à côté.

L'OFL interdit par ailleurs de redistribuer la police sous le nom « Noto » si
vous la modifiez. Nous ne la modifions pas, nous la rasterisons : le nom reste
exact et il n'y a rien à renommer.

## Changer de police

C'est tout l'intérêt de s'être affranchi de MapTiler, qui ne servait aucune
police à empattements — d'où un style d'atlas ancien qui imite l'ancien par
l'espacement et les petites capitales, faute de pouvoir le faire par le dessin.

1. Déposer les `.ttf` ici, avec leur licence.
2. Corriger les noms dans `src/map/style/typography.ts`.
3. Reporter les piles dans `scripts/glyph-stacks.mjs` — `npm test` refuse que
   les deux listes divergent, c'est le rôle de `glyphStacks.test.ts`.
4. `npm run glyphs`, puis téléverser.

Des polices à empattements libres qui conviendraient à une planche gravée :
EB Garamond, Libre Caslon Text, Spectral, Noto Serif. Toutes en OFL.
