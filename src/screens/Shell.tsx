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
 * **Aucune page ne connaît la barre.** Elle est leur frère dans cette
 * colonne, pas un calque posé dessus : chaque scène s'arrête donc d'elle-même
 * à son sommet, et aucune n'a à réserver sa hauteur. En lui passant la mesure
 * on la comptait deux fois — quatre-vingt-dix points de vide sous la frise et
 * au pied de chaque liste.
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
  const takenOver = aiming || drawing;

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

      {/* Au-dessus des onglets et dans la même colonne : elle rétrécit la
          scène plutôt que de la recouvrir — voir `OfflineBar`. Elle reste
          quand le viseur prend l'écran : viser un point sans réseau est
          exactement le moment où il faut le savoir. */}
      <OfflineBar />

      {takenOver ? null : <TabBar value={tab} onChange={setTab} />}

      {/* Après la barre, donc par-dessus : l'arbre dessiné est une vue et
          non une modale, et il doit couvrir les onglets comme il couvre
          tout le reste. Il porte sa propre sortie. */}
      {pages.layer}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  stage: { flex: 1 },
  /**
   * Masqué, et non démonté — voir le commentaire du composant.
   *
   * `position: absolute` par-dessus `display: none` : les quatre scènes se
   * superposent dans le même cadre, et celle qui se voit prend toute la
   * place sans que les trois autres n'en réclament.
   */
  hidden: { display: "none" },
});
