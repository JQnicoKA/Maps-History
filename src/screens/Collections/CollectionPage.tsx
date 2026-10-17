import type { ReactElement } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddSlot, SeekRow } from "../../components/ui";
import { palette } from "../../theme/palette";
import { shadow, space, type } from "../../theme/tokens";

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
 * des centaines de lignes.
 *
 * **Le titre ne défile pas, le reste si.** C'est la seule chose de cette page
 * qui dise *où l'on est* : la perdre au premier geste du pouce laisse trois
 * listes qui se ressemblent et rien pour les distinguer. Le compte, la porte
 * du catalogue et la dalle de création partent, eux, avec le défilement —
 * ils appartiennent au début de la liste, pas à la page.
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
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={keyOf}
        /* En bas rien de particulier : cette scène est un frère de la barre
           d'onglets dans une colonne, donc elle s'arrête à son sommet. Lui
           ajouter la hauteur de la barre la compterait deux fois, et la
           liste finirait sur un vide de quatre-vingt-dix points. La zone
           sûre du haut, elle, est portée par le bandeau. */
        contentContainerStyle={[
          styles.body,
          { paddingTop: space.lg, paddingBottom: space.xl },
        ]}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.count}>{count}</Text>
            <SeekRow label={seekLabel} onPress={onSeek} />
            <AddSlot label={addLabel} onPress={onAdd} />
          </View>
        }
        renderItem={({ item }) => row(item)}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  /**
   * Le bandeau du titre : posé sur la page, et non découpé dedans.
   *
   * Opaque, parce que la liste passe dessous : du papier clair sur le papier
   * de la page, comme toute surface que cette application lève d'un cran.
   *
   * **`zIndex` est ce qui rend l'ombre visible.** Elle déborde du bandeau par
   * le bas, et la `FlatList` est rendue après lui : sans cela, elle peindrait
   * simplement par-dessus. Sur Android c'est l'`elevation` de `shadow.soft`
   * qui joue les deux rôles à la fois, mais iOS empile les frères dans
   * l'ordre du code.
   */
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: palette.paperLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
    zIndex: 1,
    ...shadow.soft,
  },
  /**
   * Le nom de la page, sans la règle tracée dessous.
   *
   * `JournalTitle` la portait — c'est le geste d'une page de livre, et il
   * valait quand ce titre ouvrait une feuille. Un bandeau fixe se sépare de
   * ce qu'il surplombe par son filet et son ombre ; une règle en plus aurait
   * fait deux traits pour une seule séparation.
   */
  title: { ...type.plate, color: palette.ink, textAlign: "center" },
  body: { paddingHorizontal: space.lg },
  /** L'écart entre la tête de liste et la première rangée est celui des rangées. */
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
