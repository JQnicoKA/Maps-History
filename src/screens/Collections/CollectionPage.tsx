import type { ReactElement } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddSlot, Failure, SeekRow } from "../../components/ui";
import { ProfileButton } from "../Account/ProfileButton";
import { palette } from "../../theme/palette";
import { shadow, space, type } from "../../theme/tokens";

export type CollectionPageProps<T> = {
  /** Le nom de la page, en tête : « Événements », « Personnages », « Arbres ». */
  title: string;
  /**
   * Le titre de la liste elle-même : « Vos événements », « Vos arbres ».
   *
   * Rendu avec son compte entre parenthèses, et posé **sous** les deux
   * portes plutôt qu'au-dessus. Le compte vivait seul en haut de page, en
   * petites capitales sous le titre, et il y annonçait une liste qu'on ne
   * voyait pas encore — deux écrans de boutons plus haut qu'elle. Ici il est
   * ce qu'il a toujours été : l'en-tête de la liste.
   */
  owned: string;
  count: number;
  /** La porte du catalogue de la bibliothèque. */
  seekLabel: string;
  onSeek: () => void;
  /** La dalle vide : en écrire un de plus. */
  addLabel: string;
  onAdd: () => void;
  data: readonly T[];
  keyOf: (one: T) => string;
  row: (one: T) => ReactElement;
  /**
   * Ce qui s'affiche à la place des rangées quand il n'y en a aucune.
   *
   * **Et seulement quand elle est vraiment vide.** Trois états se cachaient
   * derrière « aucune rangée » : la lecture en cours, la lecture échouée, et
   * la collection réellement vide. Les trois disaient « Écrivez un
   * événement », ce qui annonçait à un lecteur hors réseau que son travail
   * avait disparu.
   */
  empty: string;
  /** La première lecture est en cours : rien à dire encore. */
  loading: boolean;
  /** Elle a échoué, et voici pourquoi. */
  failed: string | null;
  onRetry: () => void;
  /**
   * La porte du compte, au bord du bandeau.
   *
   * Elle est ici et non sur la carte, qui n'a plus de bouton de compte : un
   * compte n'est pas une chose de la planche, et le bandeau de ces trois
   * pages est le seul endroit fixe que l'application ait.
   */
  unread: number;
  onProfile: () => void;
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
  owned,
  count,
  seekLabel,
  onSeek,
  addLabel,
  onAdd,
  data,
  keyOf,
  row,
  empty,
  unread,
  onProfile,
  loading,
  failed,
  onRetry,
}: CollectionPageProps<T>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {/* Posée en absolu, du haut du titre à son bas : le titre reste
            centré sur la page et non sur ce que la porte lui laisse, et le
            glyphe se centre sur la bande du titre plutôt que de pendre à
            son bord haut. */}
        <View
          style={[
            styles.profile,
            { top: insets.top + space.sm, bottom: space.md },
          ]}
        >
          <ProfileButton unread={unread} onPress={onProfile} />
        </View>
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
            <SeekRow label={seekLabel} onPress={onSeek} />
            <AddSlot label={addLabel} onPress={onAdd} />
            {/* Le compte se tait tant qu'on ne le connaît pas. « Vos
                événements (0) » au-dessus d'un échec de lecture serait un
                chiffre faux posé à côté de la raison pour laquelle on ne
                l'a pas. */}
            <Text style={styles.owned}>
              {owned}
              {failed === null && !loading ? (
                <Text style={styles.count}> ({count})</Text>
              ) : null}
            </Text>
          </View>
        }
        renderItem={({ item }) => row(item)}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          failed !== null ? (
            <Failure reason={failed} onRetry={onRetry} retrying={loading} />
          ) : loading ? (
            <Text style={styles.empty}>Chargement…</Text>
          ) : (
            <Text style={styles.empty}>{empty}</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.surface },
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
    backgroundColor: palette.surfaceRaised,
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
  profile: { position: "absolute", right: space.md, justifyContent: "center" },
  body: { paddingHorizontal: space.lg },
  /** L'écart entre la tête de liste et la première rangée est celui des rangées. */
  head: { gap: space.md, paddingBottom: space.md },
  /**
   * L'en-tête de la liste, aligné à gauche où l'œil commence sa colonne.
   *
   * Un peu d'air au-dessus : il ferme la série des deux portes et ouvre
   * celle des rangées, et sans cela les trois se liraient comme une seule
   * pile de quatre choses.
   */
  owned: {
    ...type.heading,
    fontWeight: "700",
    color: palette.ink,
    paddingTop: space.sm,
  },
  /**
   * Le compte, en encre plus pâle : c'est une précision, pas le titre.
   *
   * Il ne redit pas la graisse, il l'hérite — `type.heading` ne nomme pas de
   * `fontWeight`, donc ce style-ci n'en impose aucun et le gras du parent
   * passe au travers. Seule la couleur change, ce qui est tout ce qu'on
   * voulait.
   */
  count: { ...type.heading, color: palette.inkFaint },
  gap: { height: space.sm },
  empty: {
    ...type.body,
    color: palette.inkFaint,
    textAlign: "center",
    paddingVertical: space.xxl,
  },
});
