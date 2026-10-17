import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

export type NoticeRowProps = {
  /** Le visage de l'entrée, déjà en adresse. Nul : on montre une initiale. */
  photo: string | null;
  /** De quoi tirer cette initiale, et de quoi nommer la rangée à voix haute. */
  title: string;
  /** La nouvelle, en trois mots, en cire. */
  heading: string;
  /** Et ce qu'elle dit, en une phrase. */
  detail: string;
  /** Toucher la rangée. Absent quand il n'y a rien à ouvrir. */
  onPress?: () => void;
  /** Ce qui se pose à droite — la poubelle d'une notification. */
  trailing?: ReactNode;
  /** Ce qui se pose sous le texte — le bouton « Rattacher ». */
  under?: ReactNode;
  disabled?: boolean;
};

/**
 * Une nouvelle au sujet d'une entrée de la bibliothèque.
 *
 * Un visage dans un rond, la nouvelle en cire, la phrase dessous — et la
 * rangée entière mène à l'entrée dont elle parle. **Aucun bouton pour agir**,
 * et c'est le fond de l'affaire : le geste qu'elle annonce réécrit un
 * exemplaire, parfois par-dessus des corrections qu'on y a faites soi-même, et
 * on le demandait sans montrer par quoi. On va voir, puis on décide.
 *
 * Dessinée ici et employée aux deux endroits qui l'annoncent — la liste des
 * notifications, et la fiche de l'élément en retard. Elles ont vécu
 * séparément, l'une en bloc avec un bouton « Mettre à jour », l'autre en
 * carte ; les tenir à deux endroits les aurait fait dériver au premier
 * changement, comme la loupe qui s'est retrouvée en deux morceaux.
 */
export function NoticeRow({
  photo,
  title,
  heading,
  detail,
  onPress,
  trailing,
  under,
  disabled = false,
}: NoticeRowProps) {
  const body = (
    <>
      <View style={styles.face}>
        {photo === null ? (
          <Text style={styles.initial}>{title.charAt(0).toUpperCase()}</Text>
        ) : (
          <Image source={{ uri: photo }} style={styles.image} />
        )}
      </View>

      <View style={styles.said}>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.detail}>{detail}</Text>
        {under === undefined ? null : <View style={styles.under}>{under}</View>}
      </View>

      {trailing}
    </>
  );

  if (onPress === undefined) {
    return <View style={styles.frame}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${heading} — ${title}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.frame, pressed && styles.down]}
    >
      {body}
    </Pressable>
  );
}

const FACE = 46;

const styles = StyleSheet.create({
  frame: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  down: { opacity: 0.6 },
  /** Rond, comme partout où cette application montre un visage. */
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  image: { width: "100%", height: "100%" },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
  said: { flex: 1, gap: 2 },
  /**
   * En cire, et c'est le ton que l'application emploie pour ce qu'elle veut
   * montrer au lecteur maintenant. Une nouvelle est exactement cela.
   */
  heading: { ...type.legend, color: palette.wax },
  detail: { ...type.caption, color: palette.inkSoft },
  /** Aligné à gauche : sans cela il s'étirerait sur toute la colonne. */
  under: { alignSelf: "flex-start", marginTop: space.sm },
});
