import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, InkButton, InkField, Sheet } from "../../../components/ui";
import { useEvents } from "../EventsProvider";
import { palette } from "../../../theme/palette";
import { BACKDROP, radius, shadow, space, type } from "../../../theme/tokens";

/**
 * Les trois façons de ranger la liste des classeurs.
 *
 * Écrites comme celles de la bibliothèque — une marque, un nom, et pourquoi
 * on le voudrait — parce que c'est le même geste au même endroit de l'écran,
 * et qu'un lecteur qui l'a appris une fois ne doit pas l'apprendre deux.
 */
const SORTS: {
  value: "name" | "recent" | "used";
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
    why: "Ceux dont vous vous êtes servi en dernier.",
    mark: "◷",
  },
  {
    value: "used",
    label: "Les plus utilisés",
    said: "utilisés",
    why: "Ceux qui rangent le plus d'événements et de personnages.",
    mark: "≡",
  },
];

type Ordering = (typeof SORTS)[number]["value"];

export type FolderSelectorProps = {
  /** Les noms déjà écrits dans la collection — voir `folderNames`. */
  known: string[];
  /** Ceux retenus ici. */
  value: string[];
  onChange: (names: string[]) => void;
  /**
   * Permet d'en nommer un qui n'existe pas encore.
   *
   * Le formulaire en a besoin — c'est le seul endroit où un classeur naît,
   * maintenant qu'il n'a plus de liste à lui. Le filtre, non : on n'y range
   * rien, on y choisit parmi ce qui est écrit.
   */
  allowNew?: boolean;
  /** Ce que dit la pastille d'ouverture avant qu'on ait rien choisi. */
  emptyLabel?: string;
};

/**
 * Les accents retirés, pour comparer et pour chercher.
 *
 * Écrit à la main plutôt que par `normalize("NFD")` et une classe Unicode : ce
 * code tourne sur Hermes, et une table de sept lettres françaises est sûre là
 * où les échappements de propriété Unicode sont une pari. Ce qu'elle couvre
 * est exactement ce qu'un nom de classeur français contient.
 */
const PLATS: Record<string, string> = {
  à: "a", â: "a", ä: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  î: "i", ï: "i",
  ô: "o", ö: "o",
  ù: "u", û: "u", ü: "u",
  ç: "c",
  œ: "oe", æ: "ae",
};

const plat = (said: string) =>
  said
    .toLowerCase()
    .split("")
    .map((lettre) => PLATS[lettre] ?? lettre)
    .join("");

/**
 * Le même nom, à la casse et aux accents près.
 *
 * Le seul vrai défaut du classement par étiquette : « Carolingiens » tapé deux
 * fois différemment ferait deux sujets là où il y en a un. On s'en garde en
 * ramenant ce qui est tapé à ce qui est déjà écrit — et non pas en interdisant
 * de taper, ce qui empêcherait d'en nommer un nouveau.
 */
const same = (a: string, b: string) => plat(a) === plat(b);

/** Les espaces en trop ôtés : « Guerres  de religion » n'est pas un nom neuf. */
const propre = (said: string) => said.trim().replace(/\s+/g, " ");

/**
 * Au-delà de combien de classeurs le clavier s'ouvre tout seul.
 *
 * Tamiser trois pastilles ne vaut pas un clavier qui couvre la moitié de la
 * feuille : à ce compte-là on les lit. Passé une poignée, chercher devient le
 * geste probable, et le champ prend la main de lui-même.
 */
const ASSEZ_POUR_CHERCHER = 8;

/**
 * Les sujets sous lesquels un événement est rangé, par leur nom.
 *
 * Des pastilles et non plus des cartes : un classeur était une entité, avec une
 * photographie de couverture et une importance par couple (événement,
 * classeur) qui demandaient chacune leur place. Il n'est plus qu'un nom, et un
 * nom se montre comme un nom.
 *
 * Ici, seulement ceux de cet événement, plus une pastille pour ouvrir le choix.
 * La collection entière vivait dans cette rangée et c'était le mauvais endroit :
 * elle grandit sans fin, alors que ce qu'un événement porte tient en deux mots.
 *
 * Le choix s'ouvre en `Sheet` et non en `Dialog`, et la raison est le voile :
 * les deux posent le même `BACKDROP`, mais le panneau d'une feuille est opaque
 * et collé au bas de l'écran, donc le voile doublé ne se voit que dans la bande
 * au-dessus. Une carte au milieu de l'écran, elle, laissait voir deux tiers de
 * brun partout. C'est le véhicule que `SelectField` emploie depuis toujours
 * depuis l'intérieur de cette même feuille.
 */
export function FolderSelector({
  known,
  value,
  onChange,
  allowNew = false,
  emptyLabel = "+ Ranger dans un classeur",
}: FolderSelectorProps) {
  const { events, characters } = useEvents();
  const [open, setOpen] = useState(false);
  /** Ce qui est tapé : à la fois le tamis et le nom d'un classeur à naître. */
  const [typed, setTyped] = useState("");
  const [sort, setSort] = useState<Ordering>("name");
  /** La carte de tri, posée par-dessus la feuille. */
  const [sifting, setSifting] = useState(false);

  /**
   * Ce que chaque classeur pèse, et quand on s'en est servi pour la dernière
   * fois.
   *
   * Les deux se lisent dans la collection et nulle part ailleurs : un
   * classeur n'a pas de ligne à lui, il n'est qu'un nom porté par ce qui s'y
   * range — c'est tout ce que `folders` gagne, et c'est ce qu'il coûte ici.
   *
   * Les dates sont comparées en nombres et non en chaînes. Les deux marchent
   * tant que la base rend le même format avec le même décalage horaire, ce
   * qu'elle fait ; `Date.parse` ne suppose rien de tout cela.
   */
  const weights = useMemo(() => {
    const uses = new Map<string, number>();
    const last = new Map<string, number>();
    const note = (names: string[], at: string) => {
      const when = Date.parse(at);
      for (const name of names) {
        uses.set(name, (uses.get(name) ?? 0) + 1);
        const seen = last.get(name);
        if (seen === undefined || when > seen) last.set(name, when);
      }
    };
    for (const one of events) note(one.folders, one.createdAt);
    for (const one of characters) note(one.folders, one.createdAt);
    return { uses, last };
  }, [events, characters]);

  /**
   * Tout ce qui est choisissable : ce que la collection connaît, plus ce qui
   * vient d'être nommé ici et n'est encore écrit nulle part.
   */
  const all = [...known, ...value.filter((one) => !known.includes(one))];

  const wanted = propre(typed);
  const found =
    wanted === "" ? all : all.filter((name) => plat(name).includes(plat(wanted)));

  /**
   * La liste tamisée, dans l'ordre demandé.
   *
   * Le nom départage toujours, quel que soit le tri : sans lui, deux
   * classeurs à égalité de poids changeraient de place d'un rendu à l'autre,
   * et une liste qui bouge toute seule sous le doigt est une liste qu'on
   * croit cassée.
   *
   * Un classeur que la collection ne connaît pas encore — celui qu'on vient
   * de nommer ici — n'a ni emploi ni date. Il compte donc pour zéro usage, et
   * pour maintenant : c'est littéralement vrai des deux côtés.
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
    setOpen(false);
    setTyped("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {value.map((name) => (
          <Chip
            key={name}
            label={name}
            selected
            tone="wax"
            onPress={() => toggle(name)}
          />
        ))}
        {/* La porte garde le ton neutre : ce n'est pas un classeur. */}
        <Chip
          label={value.length === 0 ? emptyLabel : "+ Autre"}
          onPress={() => setOpen(true)}
        />
      </View>

      {/* Une feuille qui monte du bas, comme toutes les autres de
          l'application. Elle a été une carte centrée un moment, et le voile
          doublé la rendait trouble ; ce défaut avait une vraie correction
          — `veil="soft"` sur `Dialog`, qui reste — mais une feuille n'a jamais
          eu le problème : son panneau est opaque et collé au bas, donc le
          voile doublé ne se voit que dans la bande au-dessus.

          Pleine hauteur, comme les autres : le panneau se dimensionnait sur
          son contenu, et tamiser lui faisait perdre une rangée de pastilles —
          donc il se resserrait sous les doigts à chaque lettre tapée. C'est
          exactement le cas que `tall` décrit : un contenu qui va et vient veut
          un panneau qui ne bouge pas. La liste prend la hauteur qui reste. */}
      <Sheet
        visible={open}
        onClose={shut}
        title="Mes classeurs"
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
              {all.length === 0
                ? allowNew
                  ? "Aucun classeur encore. Nommez le premier : un sujet, pas un fait — Mérovingiens, croisades, Renaissance…"
                  : "Aucun classeur. Un événement en reçoit un quand vous l'écrivez."
                : "Rien de tel parmi vos classeurs."}
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
                  <Text style={styles.cardTitle}>Trier</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
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
  card: {
    width: "100%",
    maxWidth: 380,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.lifted,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  cardHeading: { flex: 1, gap: space.xs },
  cardTitle: { ...type.plate, fontSize: 21, color: palette.ink },
  /** Tracé sous le mot, comme tout titre de cette application. */
  cardRule: {
    height: 3,
    width: "42%",
    minWidth: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
  },
  cardClose: {
    fontSize: 26,
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
