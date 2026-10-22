import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CharactersScreen } from "./Collections/CharactersScreen";
import { EventsScreen } from "./Collections/EventsScreen";
import { TreesScreen } from "./Collections/TreesScreen";
import { MapScreen } from "./MapScreen";
import { usePages } from "./Pages";
import { TabBar, type TabKey } from "./TabBar";
import { useNotices } from "../features/community/NoticeList";
import { OfflineBar } from "../features/network/OfflineBar";
import { usePlacement } from "../features/placement";
import { palette } from "../theme/palette";

/**
 * Les quatre onglets de l'application, et ce qui se lève par-dessus.
 *
 * **Les quatre restent montés, et un seul se voit.** Démonter la carte en
 * changeant d'onglet jetterait la caméra que le lecteur a réglée et
 * rechargerait ses tuiles à chaque retour ; une liste de trois cents lignes
 * reperdrait sa position de défilement. C'est la technique que `MapScreen`
 * employait déjà pour sa propre bascule carte/liste, reprise un étage plus
 * haut — `display: none` plutôt qu'un démontage.
 *
 * **La barre est un frère dans cette colonne, et c'est ce qui rend la mise en
 * page muette.** Elle a flotté un temps, détachée du bord : elle ne prenait
 * alors plus de place, le contenu passait dessous, et chaque scène devait
 * recevoir d'ici la hauteur qu'elle couvrait pour ne pas enterrer sa
 * dernière rangée. Ancrée, elle reprend sa place : la scène visible s'arrête
 * d'elle-même à son sommet et aucune n'a besoin de la connaître. C'est la
 * même mesure, faite par Yoga au lieu d'être calculée et descendue à six
 * fichiers.
 *
 * **La frise n'appartient qu'à la carte.** Elle est dessinée par `MapScreen`
 * et non ici : lire une collection n'est pas lire un instant, et les trois
 * pages recensent là où la planche montre une année.
 */
export function Shell() {
  const { aiming } = usePlacement();
  const [tab, setTab] = useState<TabKey>("map");
  /**
   * Le crayon, rapporté par la carte.
   *
   * La coquille ne peut pas le deviner — c'est un état de la planche — et
   * elle en a besoin pour deux choses : effacer la barre, et dire à l'arbre
   * dessiné de s'escamoter.
   */
  const [drawing, setDrawing] = useState(false);
  /**
   * Une étude est en cours sur la planche.
   *
   * Gardée à part du crayon bien qu'elle efface la même barre : `usePages` ne
   * reçoit que le crayon, puisque c'est lui seul qui escamote l'arbre dessiné.
   */
  const [studying, setStudying] = useState(false);
  /**
   * Les notifications, lues **une fois** pour toute l'application.
   *
   * `useNotices` interroge le serveur à chaque montage, et les quatre pages
   * restent montées en permanence : une par page aurait fait quatre requêtes
   * au lancement et quatre compteurs qui dérivent dès qu'on en efface une.
   * Elles sont lues ici et passées — à la porte du compte dans les bandeaux,
   * et à la page du compte, qui est la seule à pouvoir les changer.
   */
  const notices = useNotices();

  /**
   * Le viseur et le crayon prennent l'écran entier.
   *
   * La barre s'efface alors, et l'onglet bascule sur la carte : viser un
   * point sur une planche qu'on ne voit pas n'est pas viser. Les deux
   * gestes se demandent depuis n'importe quel onglet — « Créer un
   * événement » depuis la page des événements mène à placer son point —
   * donc la bascule est ici plutôt qu'à chacun des endroits qui les
   * déclenchent.
   */
  const takenOver = aiming || drawing || studying;

  useEffect(() => {
    if (takenOver) setTab("map");
  }, [takenOver]);

  const pages = usePages({ drawing, notices });

  return (
    <View style={styles.screen}>
      <View style={[styles.stage, tab === "map" ? null : styles.hidden]}>
        <MapScreen
          onRaise={pages.raise}
          onDrawingChange={setDrawing}
          onStudyingChange={setStudying}
        />
      </View>

      <View style={[styles.stage, tab === "events" ? null : styles.hidden]}>
        <EventsScreen
          onOpen={(id) => pages.raise({ kind: "event", id })}
          onCreate={() => pages.compose(null)}
          onSeek={() => pages.raise({ kind: "searchEvents" })}
          unread={notices.notices.length}
          onProfile={() => pages.raise({ kind: "account" })}
        />
      </View>

      <View style={[styles.stage, tab === "people" ? null : styles.hidden]}>
        <CharactersScreen
          onOpen={(id) => pages.raise({ kind: "person", id })}
          /* Le formulaire d'un personnage est une page et non une feuille :
             placer quelqu'un donne l'écran entier au viseur. */
          onCreate={() => pages.raise({ kind: "editPerson", id: null })}
          onSeek={() => pages.raise({ kind: "searchCharacters" })}
          unread={notices.notices.length}
          onProfile={() => pages.raise({ kind: "account" })}
        />
      </View>

      <View style={[styles.stage, tab === "trees" ? null : styles.hidden]}>
        <TreesScreen
          onOpen={(id) => pages.raise({ kind: "tree", id })}
          onSeek={() => pages.raise({ kind: "searchTrees" })}
          unread={notices.notices.length}
          onProfile={() => pages.raise({ kind: "account" })}
        />
      </View>

      {/* Au-dessus de la barre, et seulement quand il y a lieu.
          Elle reste quand le viseur prend l'écran : viser un point sans
          réseau est exactement le moment où il faut le savoir. */}
      <OfflineBar />

      {takenOver ? null : <TabBar value={tab} onChange={setTab} />}

      {/* Ce qui se lève par-dessus tout, dans un calque qui le dit.
          ====================================================================

          **L'ordre du code ne suffisait pas, et c'est une leçon.** Ce bloc
          était simplement écrit après la barre d'onglets, au motif qu'un
          frère plus tardif se peint par-dessus les précédents. C'est vrai
          tant que personne ne porte de `zIndex` ; dès qu'un descendant en
          porte un, l'arbitrage cesse d'être celui du code et l'on ne peut
          plus le lire en regardant ce fichier.

          Le défaut observé : ouvrir un arbre depuis la page Arbres laissait
          le bandeau « Arbres » par-dessus lui. Les deux barres étant
          blanches à huit points de hauteur près, il n'en dépassait qu'un
          second filet — et le retour de l'arbre, enterré dessous, rendait le
          dessin sans issue.

          Un rang explicite, et strictement au-dessus du seul autre en jeu :
          le bandeau fixe des pages de collection et celui du compte portent
          `zIndex: 1`, pour que leur ombre se voie par-dessus leur propre
          liste. Deux, ici, met la question hors de portée d'un réglage fait
          trois étages plus bas.

          `box-none` parce que ce calque couvre l'écran en permanence : il ne
          doit rien intercepter lui-même, et tout laisser à ses occupants —
          qui sont soit des modales, soit des vues plein écran en absolu. */}
      <View style={styles.over} pointerEvents="box-none">
        {pages.layer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  stage: { flex: 1 },
  /** Masqué, et non démonté — voir le commentaire du composant. */
  hidden: { display: "none" },
  /** Le calque des pages levées : tout l'écran, au-dessus des scènes. */
  over: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
});
