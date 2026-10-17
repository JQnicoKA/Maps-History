import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CharactersScreen } from "./Collections/CharactersScreen";
import { EventsScreen } from "./Collections/EventsScreen";
import { TreesScreen } from "./Collections/TreesScreen";
import { MapScreen } from "./MapScreen";
import { usePages } from "./Pages";
import { TabBar, TAB_BAR_HEIGHT, type TabKey } from "./TabBar";
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
 * **La frise n'appartient qu'à la carte.** Elle est dessinée par `MapScreen`
 * et non ici : lire une collection n'est pas lire un instant, et les trois
 * pages recensent là où la planche montre une année.
 */
export function Shell() {
  const insets = useSafeAreaInsets();
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

  const pages = usePages({ drawing });
  /** Ce que la barre couvre, et que les pages doivent laisser libre. */
  const bottomInset = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={styles.screen}>
      <View style={[styles.stage, tab === "map" ? null : styles.hidden]}>
        <MapScreen
          onRaise={pages.raise}
          onDrawingChange={setDrawing}
          bottomInset={bottomInset}
        />
      </View>

      <View style={[styles.stage, tab === "events" ? null : styles.hidden]}>
        <EventsScreen
          onOpen={(id) => pages.raise({ kind: "event", id })}
          onCreate={() => pages.compose(null)}
          onSeek={() => pages.raise({ kind: "searchEvents" })}
          bottomInset={bottomInset}
        />
      </View>

      <View style={[styles.stage, tab === "people" ? null : styles.hidden]}>
        <CharactersScreen
          onOpen={(id) => pages.raise({ kind: "person", id })}
          /* Le formulaire d'un personnage est une page et non une feuille :
             placer quelqu'un donne l'écran entier au viseur. */
          onCreate={() => pages.raise({ kind: "editPerson", id: null })}
          onSeek={() => pages.raise({ kind: "searchCharacters" })}
          bottomInset={bottomInset}
        />
      </View>

      <View style={[styles.stage, tab === "trees" ? null : styles.hidden]}>
        <TreesScreen
          onOpen={(id) => pages.raise({ kind: "tree", id })}
          onSeek={() => pages.raise({ kind: "searchTrees" })}
          bottomInset={bottomInset}
        />
      </View>

      {takenOver ? null : <TabBar value={tab} onChange={setTab} />}

      {/* Après la barre, donc par-dessus : l'arbre dessiné est une vue et
          non une modale, et il doit couvrir les onglets comme il couvre
          tout le reste. Il porte sa propre sortie. */}
      {pages.layer}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
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
