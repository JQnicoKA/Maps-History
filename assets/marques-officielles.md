# Les marques de Google et de Meta

`google-g.png`, `google-g@2x.png`, `google-g@3x.png` et `facebook-f.png` sont
les deux marques des portes de connexion — voir `src/features/auth/SocialSignIn.tsx`.

Ce ne sont pas des dessins : Google et Meta publient des règles d'identité qui
exigent leurs fichiers, non redessinés, non recolorés. Ce n'est pas une
exigence esthétique mais une **condition d'usage de leur connexion**, et un
bouton non conforme est un motif de rejet à la revue de l'App Store. Les trois
lettres dessinées qui les précédaient — un `G`, un `f` et un `@` en texte
coloré — étaient un ersatz. Le `@` reste dessiné : il n'appartient à personne.

## D'où elles viennent

| Fichier | Source |
|---|---|
| `google-g*.png` | <https://developers.google.com/identity/branding-guidelines> → archive → `iOS / PNG @Nx / Neutral / Theme=Neutral, Show text=No, Shape=Square` |
| `facebook-f.png` | <https://about.meta.com/brand/resources/facebook/logo/> → *Secondary Logo* (le `f` blanc à fond transparent) |

**Ne les prenez pas ailleurs.** Meta prévient explicitement contre les logos
trouvés par une recherche d'images, souvent périmés.

## Comment le `G` a été préparé

L'archive de Google ne livre pas le `G` seul : c'est une **tuile** avec sa
marge, et le `G` n'y occupe que **45 % de la largeur** — mesuré, 59 pixels dans
une tuile de 132. Posé tel quel dans une boîte de 24 points, il n'en faisait
qu'une dizaine, et paraissait minuscule.

Il a donc été recadré, au centre, à la moitié de la tuile :

```sh
# depuis le dossier de l'archive dézippée
for x in 1 2 3; do
  src="iOS/PNG @${x}x/Neutral/Theme=Neutral, Show text=No, Shape=Square, Platform=iOS"
  [ $x -gt 1 ] && src="${src}@${x}x"
  out="google-g.png"; [ $x -gt 1 ] && out="google-g@${x}x.png"
  cp "${src}.png" "$out"
  sips -c $((24*x)) $((24*x)) "$out"      # recadrage centré
done
```

Rien n'est redessiné ni recoloré : seul le pourtour de la tuile est ôté.

> **La tuile neutre, et pas la claire.** Recadrer retire le bord, pas le fond.
> La tuile claire est blanche à l'intérieur, et le `G` paraissait alors dans un
> carré blanc posé sur le gris du bouton. La tuile neutre est remplie de
> `#F2F2F2`, exactement la couleur du bouton : la jonction ne se voit plus.
>
> **Donc le fichier est lié au fond.** Changer `google.backgroundColor` dans
> `SocialSignIn.tsx` sans reprendre la tuile du thème correspondant ferait
> réapparaître le carré. Les trois fonds que Google autorise sont `#FFFFFF`
> (Light), `#F2F2F2` (Neutral) et `#131314` (Dark).

Le `f` de Meta n'a rien demandé : c'est un disque blanc plein au `f` évidé, sur
fond transparent, employé tel quel sur leur bleu `#1877F2`.

## Les archives complètes

Téléchargées puis **retirées du dépôt** : 139 fichiers, 1,9 Mo, dont quatre
servaient. Elles se retéléchargent aux deux adresses ci-dessus, qui sont de
toute façon les seules sources qu'il faille employer.

## Ce qui reste à vérifier avant publication

Le libellé « Continuer avec Facebook ». La page *Login for Devices* de Meta
cite « Log in with Facebook » et « Connect to Facebook ». Il a été conservé
parce que les quatre portes partagent une voix — Apple, Google, Facebook, une
adresse mail — et qu'en changer une seule la casserait. À confirmer sur leur
page de marque.
