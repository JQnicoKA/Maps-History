import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, Dialog, InkButton, InkField } from "../../../components/ui";
import { palette } from "../../../theme/palette";
import { radius, space, type } from "../../../theme/tokens";

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
  emptyLabel = "Ranger dans un classeur",
}: FolderSelectorProps) {
  const [open, setOpen] = useState(false);
  /** Ce qui est tapé : à la fois le tamis et le nom d'un classeur à naître. */
  const [typed, setTyped] = useState("");

  /**
   * Tout ce qui est choisissable : ce que la collection connaît, plus ce qui
   * vient d'être nommé ici et n'est encore écrit nulle part.
   */
  const all = [...known, ...value.filter((one) => !known.includes(one))];

  const wanted = propre(typed);
  const matches =
    wanted === "" ? all : all.filter((name) => plat(name).includes(plat(wanted)));
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
          <Chip key={name} label={name} selected onPress={() => toggle(name)} />
        ))}
        <Chip
          label={value.length === 0 ? emptyLabel : "+ Autre"}
          onPress={() => setOpen(true)}
        />
      </View>

      {/* Sans titre : la carte est tout entière sa propre réponse — un champ
          et ce qu'il tamise. La nommer « Classeurs » ne dirait rien que les
          pastilles ne disent déjà. Sans bouton au pied non plus : choisir
          s'applique sur le coup, donc il n'y a rien à confirmer ni à annuler,
          et la croix suffit. */}
      <Dialog
        visible={open}
        onClose={shut}
        /* Elle s'ouvre depuis une feuille — ou, pour le filtre, depuis une
           autre carte — qui a déjà posé le voile. */
        veil="soft"
        dismissLabel={null}
      >
        {/* Rien ici ne porte `grow` : dans une colonne dimensionnée par son
            contenu, `flex: 1` donne une base nulle et les enfants débordent de
            la carte. La `ScrollView` est bornée par sa hauteur maximale, pas
            par un `flex`. */}
        <View style={styles.picker}>
          <InkField
            label={allowNew ? "Chercher ou nommer" : "Chercher"}
            value={typed}
            onChangeText={setTyped}
            placeholder="Carolingiens"
            autoFocus={all.length > ASSEZ_POUR_CHERCHER}
            autoCorrect={false}
            returnKeyType={allowNew ? "done" : "search"}
            onSubmitEditing={create}
          />

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
              variant="tonal"
              onPress={create}
            />
          ) : null}
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  /** La carte porte déjà sa gouttière ; ce bloc n'ajoute que le rythme. */
  picker: { gap: space.md },
  /**
   * Plafonnée et défilante : le nombre de classeurs grandit sans fin, la
   * hauteur de la carte non. Le champ reste en vue au-dessus, et le bouton
   * « Créer » en dessous.
   */
  list: { maxHeight: 220 },
  nothing: {
    ...type.body,
    color: palette.inkFaint,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
});
