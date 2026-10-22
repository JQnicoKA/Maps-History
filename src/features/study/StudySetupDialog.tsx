import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AimButton } from "./AimButton";
import { PARTS } from "./parts";
import { BLANK_SETUP, aimAt, type StudySetup } from "./subjects";
import {
  Dialog,
  InkButton,
  InkField,
  SegmentedControl,
  TickRow,
} from "../../components/ui";
import { HISTORY } from "../../config/history";
import { useEvents } from "../events/EventsProvider";
import { FolderSelector } from "../events/components/FolderSelector";
import type { Importance } from "../events/types";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

const BANNER = require("../../../assets/banniere_etudier.png");

/** Les trois scènes, une par matière à réviser. */
const FONDS = {
  events: require("../../../assets/fond_bouton_evenements.png"),
  characters: require("../../../assets/fond_bouton_personnages.png"),
  territories: require("../../../assets/fond_bouton_territoires.png"),
};

/**
 * Les faces que la carte présente, et l'ordre où elle les présente.
 *
 * Deux chemins, et c'est la matière qui décide : un événement et un
 * personnage se rangent par classeur et par importance, un territoire du fond
 * de carte n'a ni l'un ni l'autre — il a une place dans le monde et des
 * années. Les deux chemins font quatre pas chacun, ce qui n'est pas une
 * coïncidence mais le même rythme tenu.
 */
type Face = "aim" | "folders" | "importance" | "part" | "years" | "order";

const COLLECTION: Face[] = ["aim", "folders", "importance", "order"];
const WORLD: Face[] = ["aim", "part", "years", "order"];

const IMPORTANCES: { value: Importance | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
];

const ORDERS = [
  { value: "chronological" as const, label: "Chronologique" },
  { value: "random" as const, label: "Aléatoire" },
];

/** Une année telle qu'on l'a tapée, ou rien si la carte ne va pas jusque-là. */
function readYear(text: string): number | null {
  const value = Number.parseInt(text.trim(), 10);
  if (Number.isNaN(value)) return null;
  return value >= HISTORY.from && value <= HISTORY.to ? value : null;
}

export type StudySetupDialogProps = {
  visible: boolean;
  onClose: () => void;
  /** Le réglage arrêté : c'est l'appelant qui va chercher et qui lance. */
  onStart: (setup: StudySetup) => void;
};

/**
 * Ce qu'on va réviser, demandé en quatre pas.
 *
 * **Une carte et non une feuille**, contre l'habitude de l'application : les
 * feuilles sont pour *remplir* — un formulaire, une recherche, une liste qu'on
 * parcourt du pouce — et rien ici ne se remplit. Ce sont quatre questions
 * fermées, une par écran, et chacune a une réponse par défaut : c'est une
 * fourche, pas un formulaire, et une fourche se pose au milieu de l'écran.
 *
 * La bannière, elle, vient des feuilles : une carte qui ouvre un chantier se
 * présente. Elle a valu à `Dialog` d'apprendre ce que `Sheet` savait déjà.
 */
export function StudySetupDialog({
  visible,
  onClose,
  onStart,
}: StudySetupDialogProps) {
  const { folderNames } = useEvents();
  const [setup, setSetup] = useState<StudySetup>(BLANK_SETUP);
  const [at, setAt] = useState(0);
  /** Les deux champs d'année, gardés en texte : « -8 » se tape caractère par
      caractère, et un nombre n'aurait pas d'état intermédiaire. */
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  /**
   * Le monde a pris la place, et les deux autres pâlissent.
   *
   * **Dans ce sens seulement, et c'est un essai qui l'a tranché.** Griser les
   * territoires dès qu'on choisit un événement était symétrique et se lisait
   * mal : on venait de faire un choix, et c'est une troisième case, qu'on
   * n'avait pas touchée, qui s'éteignait. Dans l'autre sens le geste est le
   * même mais la lecture est inverse — on prend les territoires, et ce qu'on
   * abandonne en les prenant s'efface sous les yeux.
   *
   * Les trois restent pressables de toute façon : presser une case grise
   * range les territoires, ce qui est le chemin le plus court pour revenir.
   */
  const studyingWorld = setup.aims.includes("territories");
  const route = studyingWorld ? WORLD : COLLECTION;
  /* Changer de but change de chemin : le pas courant est borné à celui-ci
     plutôt que gardé tel quel, sans quoi on tomberait sur une face qui
     n'appartient plus au voyage. */
  const face: Face = route[Math.min(at, route.length - 1)] ?? "aim";
  const last = at >= route.length - 1;

  const start = readYear(from);
  const end = readYear(to);
  const backwards = start !== null && end !== null && end < start;
  /** Toute l'histoire tant qu'on n'a pas donné deux bornes tenables. */
  const window =
    start === null || end === null || backwards ? null : { from: start, to: end };
  const allOfTime = window === null;

  /**
   * Ce qui empêche d'aller plus loin, face par face.
   *
   * Seules deux faces peuvent retenir : il faut un but, et il faut une partie
   * du monde. Les autres ont toutes une réponse par défaut — tous les
   * classeurs, toutes les importances, l'ordre du temps — et un bouton grisé
   * devant une question déjà répondue ne ferait que demander de confirmer.
   */
  const stuck =
    (face === "aim" && setup.aims.length === 0) ||
    (face === "part" && setup.part === null);

  /**
   * Le réglage arrêté, qui attend que la carte soit partie.
   *
   * **Et c'est la leçon la plus chère de cette application.** Lancer l'étude
   * depuis le bouton lève `studying`, ce qui escamote tout le mobilier de la
   * planche — dont le disque qui porte cette carte-ci. Elle serait donc
   * **démontée** au lieu d'être baissée : son fondu de sortie n'aurait pas
   * lieu, et iOS se verrait retirer une modale pendant qu'il la présente.
   *
   * On ferme donc d'abord, on attend `onClosed`, et on lance ensuite.
   */
  const [pending, setPending] = useState<StudySetup | null>(null);

  /** Remis à neuf pour la prochaine fois, une fois la carte partie. */
  const blank = () => {
    setSetup(BLANK_SETUP);
    setAt(0);
    setFrom("");
    setTo("");
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      /* La suite se joue ici et non au moment du clic — voir `pending`. */
      onClosed={() => {
        blank();
        if (pending === null) return;
        setPending(null);
        onStart(pending);
      }}
      banner={BANNER}
      /* Sans glyphe devant le titre : la bannière en porte déjà un, en grand
         et en couleur, et un mortier de vingt points sous une image qui
         annonce la même chose se lirait comme une redite. */
      title="Étudier"
      hint={
        face === "aim"
          ? "Que souhaitez-vous étudier ?"
          : face === "folders"
            ? "Depuis quel classeur voulez-vous étudier ?"
            : face === "importance"
              ? "Quelle importance voulez-vous étudier ?"
              : face === "part"
                ? "Quelle partie du monde ?"
                : face === "years"
                  ? "Entre quelles années ?"
                  : "Dans quel ordre poser les questions ?"
      }
      /* Les deux réponses se posent côte à côte dans le corps — voir plus
         bas. Au pied, « Retour » se serait posé sous « Suivant ». */
      dismissLabel={null}
    >
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {face === "aim" ? (
          <>
            <AimButton
              label="Événements"
              background={FONDS.events}
              chosen={setup.aims.includes("events")}
              dimmed={studyingWorld}
              onPress={() =>
                setSetup((one) => ({ ...one, aims: aimAt(one.aims, "events") }))
              }
            />
            <AimButton
              label="Personnages"
              background={FONDS.characters}
              chosen={setup.aims.includes("characters")}
              dimmed={studyingWorld}
              onPress={() =>
                setSetup((one) => ({
                  ...one,
                  aims: aimAt(one.aims, "characters"),
                }))
              }
            />
            <AimButton
              label="Territoires"
              background={FONDS.territories}
              chosen={studyingWorld}
              onPress={() =>
                setSetup((one) => ({
                  ...one,
                  aims: aimAt(one.aims, "territories"),
                }))
              }
            />
          </>
        ) : null}

        {face === "folders" ? (
          <>
            <FolderSelector
              known={folderNames}
              value={setup.folders}
              onChange={(next) => setSetup((one) => ({ ...one, folders: next }))}
              emptyLabel="Tous les classeurs"
            />
            <Text style={styles.aside}>
              Sans classeur choisi, toute la collection est révisée.
            </Text>
          </>
        ) : null}

        {face === "importance" ? (
          <SegmentedControl
            segments={IMPORTANCES}
            value={setup.importance[0] ?? "all"}
            onChange={(choice) =>
              setSetup((one) => ({
                ...one,
                importance: choice === "all" ? [] : [choice],
              }))
            }
          />
        ) : null}

        {face === "part" ? (
          <>
            {PARTS.map((part) => (
              <AimButton
                key={part.value}
                label={part.label}
                chosen={setup.part === part.value}
                onPress={() =>
                  setSetup((one) => ({ ...one, part: part.value }))
                }
              />
            ))}
          </>
        ) : null}

        {face === "years" ? (
          <>
            <View style={styles.years}>
              <View style={styles.year}>
                <InkField
                  label="De l'année"
                  value={from}
                  onChangeText={setFrom}
                  placeholder="800"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.year}>
                <InkField
                  label="À l'année"
                  value={to}
                  onChangeText={setTo}
                  placeholder="1200"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {/* Une case plutôt qu'un bouton : elle dit l'état où l'on est
                déjà — deux champs vides *sont* toute l'histoire — au lieu de
                proposer un troisième chemin. La cocher vide les champs, la
                décocher ne fait rien qu'on ne puisse défaire en tapant. */}
            <TickRow
              title="Toute l'histoire"
              detail={
                backwards
                  ? "La fin précède le début."
                  : `De ${HISTORY.from} à ${HISTORY.to}, une année négative est avant Jésus-Christ.`
              }
              on={allOfTime}
              onToggle={() => {
                setFrom("");
                setTo("");
              }}
            />
          </>
        ) : null}

        {face === "order" ? (
          <>
            <SegmentedControl
              segments={ORDERS}
              value={setup.order}
              onChange={(order) => setSetup((one) => ({ ...one, order }))}
            />
            <Text style={styles.aside}>
              {setup.order === "chronological"
                ? "Les questions suivent le fil du temps."
                : "Les questions arrivent dans le désordre."}
            </Text>
          </>
        ) : null}
      </ScrollView>

      {/* À parts égales sur une ligne, la sortie à gauche et ce qu'on est venu
          faire à droite : la mise des pieds de l'application. Au premier pas,
          il n'y a rien derrière, et le bouton seul tient la ligne. */}
      <View style={styles.actions}>
        {at > 0 ? (
          <InkButton
            label="Retour"
            variant="tonal"
            grow
            onPress={() => setAt((one) => Math.max(0, one - 1))}
          />
        ) : null}
        <InkButton
          label={last ? "Commencer à étudier" : "Suivant"}
          variant="solid"
          grow
          disabled={stuck}
          onPress={() => {
            if (!last) {
              setAt((one) => one + 1);
              return;
            }
            setPending({ ...setup, window });
            onClose();
          }}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  /** Assez haut pour les trois buts, assez court pour rester une carte. */
  body: { maxHeight: 340 },
  content: { gap: space.sm, paddingBottom: space.xs },
  /** Une phrase sous un contrôle : `caption`, jamais `legend` — voir tokens. */
  aside: { ...type.caption, color: palette.inkFaint, marginTop: space.xs },
  years: { flexDirection: "row", gap: space.sm },
  year: { flex: 1 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
});
