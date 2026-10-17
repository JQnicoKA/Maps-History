import type { ReactElement } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddSlot, JournalTitle, SeekRow } from "../../components/ui";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

export type CollectionPageProps<T> = {
  /** Le nom de la page, en tête : « Événements », « Personnages », « Arbres ». */
  title: string;
  /** « 3 arbres », « Aucun personnage » — le compte, dit en mots. */
  count: string;
  /** La porte du catalogue de la bibliothèque. */
  seekLabel: string;
  onSeek: () => void;
  /** La dalle vide : en écrire un de plus. */
  addLabel: string;
  onAdd: () => void;
  data: readonly T[];
  keyOf: (one: T) => string;
  row: (one: T) => ReactElement;
  /** Ce qui s'affiche à la place des rangées quand il n'y en a aucune. */
  empty: string;
};

/**
 * La forme que prennent les trois pages de collection.
 *
 * **Un gabarit et non trois pages qui se ressemblent.** Les personnages et
 * les arbres dessinaient chacun leur version du même objet — un compte, une
 * porte, une dalle, des rangées — et avaient déjà dérivé une fois ; `Roster`
 * les avait réunis. Celui-ci fait la même chose un étage plus haut, pour les
 * pages entières.
 *
 * **L'ordre est chercher, puis créer**, et c'est l'argument de `Roster` repris
 * tel quel : une liste à laquelle il manque quelque chose est mieux servie
 * par ce qui existe déjà que par une seconde écriture de la même chose.
 * Offrir la dalle vide d'abord invite au doublon que la bibliothèque entière
 * est faite pour éviter.
 *
 * En `FlatList` et non en `ScrollView` comme `Roster` : une collection compte
 * des centaines de lignes, et l'en-tête — titre, compte, porte, dalle —
 * défile avec elles plutôt que de rester collé en haut, parce que c'est le
 * début de la page et non un bandeau.
 */
export function CollectionPage<T>({
  title,
  count,
  seekLabel,
  onSeek,
  addLabel,
  onAdd,
  data,
  keyOf,
  row,
  empty,
}: CollectionPageProps<T>) {
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      style={styles.page}
      data={data}
      keyExtractor={keyOf}
      /* En haut la zone sûre, en bas rien de particulier : cette scène est
         un frère de la barre d'onglets dans une colonne, donc elle s'arrête
         à son sommet. Lui ajouter la hauteur de la barre la compterait deux
         fois, et la liste finirait sur un vide de quatre-vingt-dix points. */
      contentContainerStyle={[
        styles.body,
        { paddingTop: insets.top + space.md, paddingBottom: space.xl },
      ]}
      ListHeaderComponent={
        <View style={styles.head}>
          <JournalTitle title={title} />
          <Text style={styles.count}>{count}</Text>
          <SeekRow label={seekLabel} onPress={onSeek} />
          <AddSlot label={addLabel} onPress={onAdd} />
        </View>
      }
      renderItem={({ item }) => row(item)}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  body: { paddingHorizontal: space.lg },
  /** L'écart entre l'en-tête et la première rangée est celui des rangées. */
  head: { gap: space.md, paddingBottom: space.md },
  count: { ...type.legend, color: palette.inkSoft, alignSelf: "center" },
  gap: { height: space.sm },
  empty: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.xxl,
  },
});
