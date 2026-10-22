import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StudyOption, type OptionState } from "./StudyOption";
import type { StudySession } from "./useStudySession";
import {
  ConfirmDialog,
  Dialog,
  GlyphButton,
  InkButton,
} from "../../components/ui";
import { CharacterSummaryCard } from "../events/components/CharacterSummaryCard";
import { EventSummaryCard } from "../events/components/EventSummaryCard";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { radius, shadow, space, type } from "../../theme/tokens";

const STUDY = require("../../../assets/icons/study.png");

export type StudyBoardProps = {
  study: StudySession;
};

/**
 * Ce qui se pose sur la planche pendant une étude.
 *
 * Le compte en haut, la question en bas, et rien entre les deux : la carte est
 * la question. C'est pour cela que l'étude prend l'écran comme le fait le
 * crayon — un filtre, une frise ou un bouton « dessiner » au milieu d'un
 * examen donneraient à régler ce qui est justement en train d'être demandé.
 */
export function StudyBoard({ study }: StudyBoardProps) {
  const insets = useSafeAreaInsets();
  const { question, subject, given } = study;

  const right = question?.subject.id ?? null;

  /** Ce que vaut chaque proposition une fois la réponse donnée. */
  const stateOf = (id: string): OptionState => {
    if (given === null) return "waiting";
    if (id === right) return given === right ? "right" : "revealed";
    if (id === given) return "wrong";
    return "faded";
  };

  return (
    <>
      {/* Le bandeau dès que la planche est prise, et non seulement quand une
          question est posée : le temps que les territoires d'une partie du
          monde arrivent, la carte est déjà nue et sans lui il n'y aurait
          aucune sortie dessinée. Un appel qui traîne enfermerait le lecteur. */}
      {study.busy || study.asking || study.leaving ? (
        <>
          <View
            style={[styles.top, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            {/* Le relevé : où l'on en est, et de combien. Sans le total, « 3 »
                ne dit pas s'il en reste trente. */}
            <View style={styles.counter}>
              <Text style={styles.count}>
                {study.busy ? "Préparation…" : `${study.at} / ${study.total}`}
              </Text>
            </View>

            <GlyphButton
              accessibilityLabel="Quitter l'étude"
              size={44}
              style={styles.cross}
              onPress={study.leave}
            >
              <Text style={styles.crossGlyph}>×</Text>
            </GlyphButton>
          </View>

          {/* Rien au pied tant qu'il n'y a pas de question : un bouton
              « Continuer » grisé sous quatre cases vides se lirait comme une
              panne plutôt que comme une attente. */}
          {question === null ? null : (
            <View
              style={[styles.bottom, { bottom: insets.bottom + space.md }]}
              pointerEvents="box-none"
            >
              {/* La tuile de ce qu'on vient de voir, au-dessus des propositions
                  et seulement une fois répondu : montrée plus tôt, elle donnerait
                  la réponse.

                  Insensible au doigt, et c'est voulu : pendant une étude elle est
                  un relevé, non une porte. L'ouvrir mènerait hors de l'examen au
                  moment précis où l'on vient d'apprendre quelque chose. */}
              {given !== null && subject !== null ? (
                <View pointerEvents="none">
                  {subject.kind === "event" ? (
                    <EventSummaryCard
                      floating
                      event={subject.event}
                      onOpen={() => undefined}
                    />
                  ) : subject.kind === "character" ? (
                    <CharacterSummaryCard
                      floating
                      person={subject.person}
                      onOpen={() => undefined}
                    />
                  ) : (
                    <View style={styles.plate}>
                      <Text style={styles.plateName}>
                        {subject.territory.name}
                      </Text>
                      <Text style={styles.plateDates}>
                        {formatYear(subject.territory.from)} –{" "}
                        {formatYear(subject.territory.to)}
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.options}>
                {question.options.map((option) => (
                  <StudyOption
                    key={option.id}
                    label={option.label}
                    state={stateOf(option.id)}
                    onPress={() => study.answer(option.id)}
                  />
                ))}
              </View>

              {/* Toujours là, grisé tant qu'on n'a pas répondu : un bouton qui
                  apparaît déplace les propositions au moment où le doigt
                  descend vers elles. */}
              <InkButton
                label={study.at >= study.total ? "Terminer" : "Continuer"}
                variant="solid"
                disabled={given === null}
                onPress={study.next}
              />
            </View>
          )}
        </>
      ) : null}

      <ConfirmDialog
        visible={study.leaving}
        title="Quitter l'étude ?"
        message={
          study.score.asked === 0
            ? "Vous n'avez encore répondu à aucune question."
            : `Vous avez répondu à ${study.score.asked} question${
                study.score.asked > 1 ? "s" : ""
              } sur ${study.total}. Votre relevé vous sera montré.`
        }
        confirmLabel="Quitter"
        cancelLabel="Continuer"
        onCancel={study.stay}
        onConfirm={study.quit}
        onClose={study.stay}
        /* Le relevé n'est levé qu'une fois cette carte-ci partie pour de bon.
           Les deux sont des modales, et iOS refuse d'en présenter une depuis
           un contrôleur qui en retire encore une autre : enchaînées dans le
           même instant, elles laissent un voile que plus rien ne touche. */
        onClosed={study.sealed}
      />

      <StudyReport study={study} />

      {/* Ce qui a empêché de commencer, dit avant que la planche ait bougé :
          des réglages auxquels rien ne répond, ou une collection trop maigre
          pour qu'une question ait quatre réponses. */}
      <Dialog
        visible={study.failure !== null}
        onClose={study.forget}
        title="Rien à étudier"
        icon={STUDY}
        hint={study.failure ?? undefined}
        dismissLabel={null}
      >
        <InkButton label="D'accord" variant="solid" onPress={study.forget} />
      </Dialog>
    </>
  );
}

/**
 * Le relevé, au bout ou à la sortie.
 *
 * Une seule issue — « D'accord » — parce qu'il n'y a rien à décider : c'est
 * ce qui s'est passé. Les noms manqués sont écrits, et c'est la seule part du
 * relevé qui serve à quelque chose : un chiffre dit comment on s'en est tiré,
 * une liste dit quoi revoir.
 */
function StudyReport({ study }: { study: StudySession }) {
  const { score } = study;
  const perfect = score.asked > 0 && score.right === score.asked;

  return (
    <Dialog
      visible={study.done}
      onClose={study.close}
      title="Votre étude"
      icon={STUDY}
      hint={
        score.asked === 0
          ? "Vous êtes sorti avant la première réponse."
          : perfect
            ? "Tout juste, d'un bout à l'autre."
            : `${score.right} bonne${score.right > 1 ? "s" : ""} réponse${
                score.right > 1 ? "s" : ""
              } sur ${score.asked}.`
      }
      dismissLabel={null}
    >
      {score.missed.length === 0 ? null : (
        <View style={styles.missed}>
          <Text style={styles.legend}>À revoir</Text>
          {score.missed.map((one) => (
            <Text key={one.id} style={styles.missedOne} numberOfLines={1}>
              {one.label}
            </Text>
          ))}
        </View>
      )}

      <InkButton label="D'accord" variant="solid" onPress={study.close} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  top: {
    position: "absolute",
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  /** La même pastille creusée que les filtres : c'est un relevé, comme eux. */
  counter: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    backgroundColor: palette.sunken,
    borderRadius: radius.pill,
    shadowColor: "#2A1F12",
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  count: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: palette.ink,
  },
  /** Creusée elle aussi : sortir n'est pas l'acte qu'on est venu faire. */
  cross: {
    backgroundColor: palette.sunken,
    borderWidth: 0,
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  crossGlyph: {
    fontSize: 26,
    lineHeight: 30,
    marginTop: -2,
    color: palette.ink,
  },
  bottom: { position: "absolute", left: 10, right: 10, gap: space.sm },
  options: { gap: space.sm },
  /** La tuile d'un territoire, qui n'en avait pas : un nom et des années. */
  plate: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadow.plate,
  },
  plateName: { ...type.heading, fontWeight: "700", color: palette.ink },
  plateDates: { ...type.caption, color: palette.inkSoft },
  missed: { gap: 2, marginBottom: space.xs },
  legend: { ...type.legend, color: palette.inkFaint },
  missedOne: { ...type.body, color: palette.inkSoft },
});
