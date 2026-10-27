import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Chip, InkButton, InkField, Sheet } from "../../../components/ui";
import { matching, propre, same } from "../folderNames";
import { palette } from "../../../theme/palette";
import { BACKDROP, radius, shadow, space, type } from "../../../theme/tokens";

/** Le dossier pour la feuille, les deux flèches pour sa carte de tri. */
const FOLDERS_ICON = require("../../../../assets/icons/folders.png");
const SORT_ICON = require("../../../../assets/icons/sort.png");

/**
 * Ce que chaque classeur pèse, et quand on s'en est servi pour la dernière
 * fois.
 *
 * Donné par l'appelant et non calculé ici, parce que les deux nombres ne se
 * lisent pas au même endroit : la collection les tire de ses propres
 * événements, qu'elle a tous en mémoire ; la bibliothèque les demande à
 * `library_folders`, n'ayant jamais plus d'une page sous la main. Un classeur
 * absent de ces deux tables compte pour zéro emploi et pour maintenant — ce
 * qui est littéralement vrai de celui qu'on vient de nommer.
 */
export type FolderWeights = {
  uses: Map<string, number>;
  /** En millisecondes, comparables en nombres. */
  last: Map<string, number>;
};

/**
 * Les mots qui changent d'une liste de classeurs à l'autre.
 *
 * La feuille est la même, et c'est tout l'objet de ce composant ; ce qu'elle
 * dit ne l'est pas. « Les plus utilisés » désigne les miens dans la
 * collection et ceux de tout le monde dans la bibliothèque, et un classeur
 * manquant s'explique autrement selon qu'on écrit ou qu'on cherche.
 */
export type FolderWords = {
  /** « Mes classeurs », ou « Classeurs » tout court. */
  title: string;
  /** Quand il n'y a aucun classeur du tout. */
  none: string;
  /** Quand le tamis n'a rien trouvé. */
  missing: string;
  /** Le tri qui pèse, nommé par ce qu'il pèse ici. */
  used: { label: string; said: string; why: string };
  /** Et celui qui date, daté de ce qui s'y range ici. */
  recent: { why: string };
};

type Ordering = "name" | "recent" | "used";

/**
 * Au-delà de combien de classeurs le clavier s'ouvre tout seul.
 *
 * Tamiser trois pastilles ne vaut pas un clavier qui couvre la moitié de la
 * feuille : à ce compte-là on les lit. Passé une poignée, chercher devient le
 * geste probable, et le champ prend la main de lui-même.
 */
const ASSEZ_POUR_CHERCHER = 8;

export type FolderSheetProps = {
  visible: boolean;
  onClose: () => void;
  words: FolderWords;
  /** Tous les noms choisissables. */
  known: string[];
  weights: FolderWeights;
  /** Ceux retenus. */
  value: string[];
  onChange: (names: string[]) => void;
  /**
   * Permet d'en nommer un qui n'existe pas encore.
   *
   * Le formulaire en a besoin — c'est le seul endroit où un classeur naît,
   * maintenant qu'il n'a plus de liste à lui. Les filtres, non : on n'y range
   * rien, on y choisit parmi ce qui est écrit.
   */
  allowNew?: boolean;
};

/**
 * Choisir des classeurs, en pleine hauteur.
 *
 * **Tirée de `FolderSelector` le jour où la bibliothèque a demandé la même
 * feuille.** Elle y avait d'abord reçu une carte au milieu de l'écran, à
 * l'imitation de ses cartes Tri et Époque, et c'était le mauvais gabarit :
 * une carte se dimensionne sur deux choix et une paire de roues, tandis
 * qu'une liste de classeurs grandit sans fin. Recopier la feuille aurait fait
 * deux feuilles à tenir en phase, qui auraient divergé à la première
 * retouche ; elle est donc sortie d'ici une fois pour les deux.
 *
 * Une feuille et non un `Dialog`, et la raison est le voile : les deux posent
 * le même `BACKDROP`, mais le panneau d'une feuille est opaque et collé au bas
 * de l'écran, donc le voile doublé ne se voit que dans la bande au-dessus. Une
 * carte au milieu, elle, laissait voir deux tiers de brun partout.
 *
 * **Elle s'ouvre depuis une feuille**, et c'est permis : `EventFormModal` le
 * fait depuis toujours. Ce qu'iOS refuse est de présenter une modale depuis un
 * panneau qui *s'en va* — c'est le gel que le filtre de région a coûté, celui
 * qui renvoie à la carte.
 */
export function FolderSheet({
  visible,
  onClose,
  words,
  known,
  weights,
  value,
  onChange,
  allowNew = false,
}: FolderSheetProps) {
  /** Ce qui est tapé : à la fois le tamis et le nom d'un classeur à naître. */
  const [typed, setTyped] = useState("");
  const [sort, setSort] = useState<Ordering>("name");
  /** La carte de tri, posée par-dessus la feuille. */
  const [sifting, setSifting] = useState(false);

  /**
   * Les trois façons de ranger la liste.
   *
   * Écrites comme celles de la bibliothèque — une marque, un nom, et pourquoi
   * on le voudrait — parce que c'est le même geste au même endroit de
   * l'écran, et qu'un lecteur qui l'a appris une fois ne doit pas l'apprendre
   * deux. Deux des trois phrases viennent de l'appelant : elles ne comptent
   * pas la même chose selon la liste.
   */
  const SORTS: {
    value: Ordering;
    label: string;
    /** Dit sur le bouton, où il n'y a la place que d'un mot. */
    said: string;
    /** Et pourquoi on le voudrait, sur la carte où il y a la place de le dire. */
    why: string;
    mark: string;
  }[] = [
    {
      value: "name",
      label: "Ordre alphabétique",
      said: "A→Z",
      why: "De A à Z, sans égard pour ce qu'ils contiennent.",
      mark: "A",
    },
    {
      value: "recent",
      label: "Les plus récents",
      said: "récents",
      why: words.recent.why,
      mark: "◷",
    },
    {
      value: "used",
      label: words.used.label,
      said: words.used.said,
      why: words.used.why,
      mark: "≡",
    },
  ];

  /**
   * Tout ce qui est choisissable : ce que l'appelant connaît, plus ce qui est
   * retenu sans y figurer.
   *
   * Le second cas arrive des deux côtés : un classeur qu'on vient de nommer
   * ici et qui n'est encore écrit nulle part, et un classeur de la
   * bibliothèque dont la dernière entrée a été retirée pendant qu'on
   * cherchait. Il filtre encore, donc la feuille doit offrir de le décocher —
   * rien d'autre ne le permettrait.
   */
  const all = [...known, ...value.filter((one) => !known.includes(one))];

  const wanted = propre(typed);
  const found = matching(all, typed);

  /**
   * La liste tamisée, dans l'ordre demandé.
   *
   * Le nom départage toujours, quel que soit le tri : sans lui, deux
   * classeurs à égalité de poids changeraient de place d'un rendu à l'autre,
   * et une liste qui bouge toute seule sous le doigt est une liste qu'on
   * croit cassée.
   */
  const matches = useMemo(() => {
    const byName = (a: string, b: string) => a.localeCompare(b);
    if (sort === "name") return [...found].sort(byName);
    if (sort === "used") {
      return [...found].sort(
        (a, b) =>
          (weights.uses.get(b) ?? 0) - (weights.uses.get(a) ?? 0) ||
          byName(a, b),
      );
    }
    const now = Date.now();
    return [...found].sort(
      (a, b) =>
        (weights.last.get(b) ?? now) - (weights.last.get(a) ?? now) ||
        byName(a, b),
    );
    // `found` est reconstruit à chaque frappe ; le dépendre par son contenu
    // plutôt que par sa référence n'économiserait qu'un tri de dix noms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, sort, weights]);

  /** Rien de tel sous ce nom : il reste à l'écrire. */
  const creatable =
    allowNew && wanted !== "" && !all.some((one) => same(one, wanted));

  const toggle = (name: string) => {
    onChange(
      value.includes(name)
        ? value.filter((one) => one !== name)
        : [...value, name],
    );
  };

  const create = () => {
    if (!creatable) return;
    onChange([...value, wanted]);
    // Le tamis se rouvre : la pastille neuve paraît dans la liste, choisie, ce
    // qui est la seule confirmation dont le geste a besoin.
    setTyped("");
  };

  const shut = () => {
    setTyped("");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={shut}
      title={words.title}
      icon={FOLDERS_ICON}
      tall
      footer={
        <InkButton label="Fermer" variant="solid" grow onPress={shut} />
      }
    >
      <View style={styles.picker}>
        {/* Sans étiquette : le titre de la carte dit déjà de quoi il s'agit,
            et la seule chose à faire ici est de taper. L'invite porte un
            exemple, ce qui vaut mieux qu'un mode d'emploi au-dessus. */}
        <InkField
          value={typed}
          onChangeText={setTyped}
          placeholder="Rechercher un classeur..."
          autoFocus={all.length > ASSEZ_POUR_CHERCHER}
          autoCorrect={false}
          returnKeyType={allowNew ? "done" : "search"}
          onSubmitEditing={create}
        />

        {/* Un seul bouton, et il ne paraît qu'au-delà de deux classeurs :
            trier une liste de deux noms est une question qu'on ne pose pas.
            Il est dessiné comme celui de la bibliothèque, puisque c'est le
            même geste. */}
        {all.length > 2 ? (
          <View style={styles.tools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trier les classeurs"
              onPress={() => setSifting(true)}
              style={({ pressed }) => [styles.tool, pressed && styles.dim]}
            >
              <Text style={styles.toolLabel}>
                Tri · {SORTS.find((one) => one.value === sort)?.said}
              </Text>
              <Text style={styles.toolMore}>⌄</Text>
            </Pressable>
          </View>
        ) : null}

        {matches.length > 0 ? (
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            {matches.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={value.includes(name)}
                tone="wax"
                onPress={() => toggle(name)}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.nothing}>
            {all.length === 0 ? words.none : words.missing}
          </Text>
        )}

        {creatable ? (
          <InkButton
            label={`Créer « ${wanted} »`}
            /* Plein, et en cire. Il n'apparaît que lorsqu'on a tapé un nom
               qui ne correspond à rien, et il est alors la seule chose à
               faire de ce qu'on vient d'écrire ; un bouton gris proposait
               cette issue au même rang que les classeurs qu'on venait de
               ne pas trouver.

               La couleur est posée ici et non demandée au composant :
               `InkButton` remplit ses boutons pleins à l'encre sépia, et
               il n'y a pas de « bouton de cire » dans le système — il y a
               ce bouton-là. C'est ce que fait déjà le disque « Dessiner »
               avec `GlyphButton`. */
            variant="solid"
            style={styles.create}
            onPress={create}
          />
        ) : null}
      </View>

      {/* Posée par-dessus la feuille entière, et sœur de son pied.
          Un fragment ne crée pas de vue : cette carte, le corps et le pied
          du panneau sont donc frères, et le pied est écrit après. Le rang
          de calque est ce qui la met par-dessus lui — sans quoi une touche
          destinée au voile fermerait la feuille entière. */}
      {sifting ? (
        <View style={styles.over}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFill}
            onPress={() => setSifting(false)}
          />

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeading}>
                <View style={styles.cardTitleRow}>
                  <Image
                    source={SORT_ICON}
                    style={styles.cardIcon}
                    resizeMode="contain"
                    accessible={false}
                  />
                  <Text style={styles.cardTitle}>Trier</Text>
                </View>
                <View style={styles.cardRule} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                hitSlop={10}
                onPress={() => setSifting(false)}
                style={({ pressed }) => [pressed && styles.dim]}
              >
                <Text style={styles.cardClose}>×</Text>
              </Pressable>
            </View>

            <View style={styles.cardBody}>
              {SORTS.map((one) => {
                const chosen = sort === one.value;
                return (
                  <Pressable
                    key={one.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: chosen }}
                    onPress={() => {
                      setSort(one.value);
                      setSifting(false);
                    }}
                    style={({ pressed }) => [
                      styles.choice,
                      chosen && styles.choiceOn,
                      pressed && styles.dim,
                    ]}
                  >
                    <Text style={[styles.choiceMark, chosen && styles.onWax]}>
                      {one.mark}
                    </Text>
                    <View style={styles.choiceText}>
                      <Text
                        style={[styles.choiceTitle, chosen && styles.onWax]}
                      >
                        {one.label}
                      </Text>
                      <Text
                        style={[styles.choiceWhy, chosen && styles.onWaxSoft]}
                      >
                        {one.why}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  /** La cire, pour le seul bouton de cette feuille qui fabrique quelque chose. */
  create: { backgroundColor: palette.wax },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  /**
   * La gouttière des feuilles, que la feuille ne pose pas elle-même : ses
   * sections la portent chacune, comme dans les listes et les formulaires.
   *
   * `flex: 1` pour que la liste en dessous puisse prendre ce qui reste —
   * sans lui, elle n'aurait aucune hauteur à partager.
   */
  picker: { flex: 1, paddingHorizontal: space.xl, gap: space.md },
  /**
   * Elle prend la hauteur qui reste et défile dedans.
   *
   * Elle était plafonnée à 220 points, du temps où le panneau se
   * dimensionnait sur son contenu. Dans un panneau de hauteur fixe, un plafond
   * laisserait un trou entre les pastilles et le pied — le champ en haut, le
   * bouton « Créer » en bas, et du vide au milieu.
   */
  list: { flex: 1 },
  /** Dessiné comme les boutons de la bibliothèque : bordé et levé. */
  tools: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  toolLabel: { ...type.legend, fontWeight: "700", color: palette.ink },
  toolMore: { ...type.legend, color: palette.inkFaint },

  /** Le voile et la carte, par-dessus tout ce que la feuille porte. */
  over: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    backgroundColor: BACKDROP,
  },
  /**
   * Les mêmes nombres que la carte de `Dialog`, et ce n'est pas une
   * coïncidence à entretenir.
   *
   * Cette carte-ci est écrite à la main parce qu'elle doit vivre **dans** une
   * feuille sans être une modale — iOS refuse d'en présenter une depuis un
   * panneau qui s'ouvre — et non parce qu'elle voudrait un autre style. Elle
   * en avait pourtant pris un : titre d'un point plus petit, trait à 42 % au
   * lieu de 58, quatre points de marge en moins, croix de deux points plus
   * grosse. On croisait donc deux gabarits dans le même panneau, la carte de
   * tri étant manuscrite quand le « Reprendre cette version ? » juste après
   * est un `Dialog`.
   *
   * Toute divergence retrouvée ici est un défaut, pas une intention.
   */
  card: {
    width: "100%",
    maxWidth: 380,
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.lifted,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardHeading: { flex: 1, gap: space.xs },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  /** Vingt, comme dans `Dialog` : accordé au titre de vingt-deux. */
  cardIcon: { width: 20, height: 20, tintColor: palette.ink },
  cardTitle: { ...type.plate, fontSize: 22, color: palette.ink },
  /** Tracé sous le mot, comme tout titre de cette application. */
  cardRule: {
    height: 3,
    width: "58%",
    minWidth: 56,
    marginTop: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
  },
  /**
   * La croix de `Dialog`, moins son décalage.
   *
   * Sa taille et son interligne sont les mêmes ; le `marginTop`, non, et le
   * recopier l'aurait décalée. Là-bas le glyphe est centré dans un bouton de
   * trente-deux points qui porte lui-même un retrait de quatre ; ici il est
   * seul dans sa touche. Les deux chemins mènent au même endroit — le centre
   * du glyphe à dix points du haut de la ligne, soit la hauteur de la
   * première ligne du titre — par deux arithmétiques différentes.
   */
  cardClose: {
    fontSize: 24,
    lineHeight: 28,
    color: palette.inkFaint,
    marginTop: -4,
  },
  cardBody: { gap: space.md },

  /**
   * Une des trois façons de ranger : une marque, un nom, et pourquoi.
   *
   * Écrites en toutes lettres plutôt que laissées à un contrôle segmenté :
   * ce ne sont pas trois réglages d'une même chose, ce sont trois questions
   * différentes sur ce qui compte, et une ligne chacune est ce qui le dit.
   */
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.sunken,
  },
  choiceOn: { backgroundColor: palette.wax },
  choiceMark: {
    fontSize: 18,
    width: 22,
    textAlign: "center",
    color: palette.wax,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 15.5, fontWeight: "700", color: palette.ink },
  choiceWhy: { ...type.caption, color: palette.inkSoft },
  onWax: { color: palette.surfaceRaised },
  onWaxSoft: { color: palette.surfaceRaised, opacity: 0.78 },
  dim: { opacity: 0.6 },

  nothing: {
    ...type.body,
    color: palette.inkFaint,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
});
