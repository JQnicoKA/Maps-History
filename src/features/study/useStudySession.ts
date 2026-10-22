import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchTerritoriesToStudy, type StudyTerritory } from "./api";
import {
  MIN_SUBJECTS,
  buildStudy,
  tally,
  type Quizzed,
  type StudyScore,
} from "./plan";
import { gather, type Quarry, type StudySetup } from "./subjects";
import { useEvents } from "../events/EventsProvider";
import {
  fetchTerritoriesByIds,
  type TerritoryFeature,
} from "../territories/api";

/**
 * Où en est une séance.
 *
 * `leaving` est un état et non un drapeau posé à côté : pendant qu'on demande
 * « voulez-vous vraiment sortir ? », l'étude n'est plus en train de poser une
 * question, et c'est ce qui empêche de répondre derrière la confirmation.
 *
 * **`quitting` est le pas de côté qui sauve l'écran.** La confirmation et le
 * relevé sont deux modales, et iOS refuse d'en présenter une depuis un
 * contrôleur qui en retire encore une autre : passer de l'une à l'autre dans
 * le même instant laisse un voile que plus rien ne touche. Cet état-ci dure
 * le temps du fondu — la confirmation est partie, le relevé n'est pas encore
 * levé — et c'est `sealed`, appelé quand la carte a fini de s'en aller, qui
 * fait le dernier pas.
 */
type Stage = "off" | "busy" | "asking" | "leaving" | "quitting" | "done";

export type StudySession = {
  /** La carte est prise : la barre d'onglets et le mobilier s'effacent. */
  live: boolean;
  busy: boolean;
  /** Ce qui a empêché de commencer, dit en une phrase. */
  failure: string | null;
  asking: boolean;
  leaving: boolean;
  done: boolean;

  question: Quizzed | null;
  /** La chose derrière la question : l'événement, la personne, le pays. */
  subject: Quarry | null;
  /** La forme du territoire demandé, quand c'en est un. */
  shape: TerritoryFeature | null;
  /** Le rang de la question courante, à partir de un. */
  at: number;
  total: number;
  /** Ce qu'on a répondu à la question courante ; rien tant qu'on n'a pas. */
  given: string | null;
  score: StudyScore;

  begin: (setup: StudySetup) => void;
  answer: (id: string) => void;
  next: () => void;
  /** La croix : demande à sortir, sans sortir encore. */
  leave: () => void;
  stay: () => void;
  quit: () => void;
  /** La confirmation a fini de se retirer : le relevé peut se lever. */
  sealed: () => void;
  /** « D'accord » au pied du relevé : rend la carte. */
  close: () => void;
  forget: () => void;
};

const NOTHING: StudyScore = { right: 0, asked: 0, missed: [] };

/**
 * Une séance d'étude, du réglage au relevé.
 *
 * Ce module ne calcule rien : le tirage est dans `plan.ts`, le tamis dans
 * `subjects.ts`, le cadrage dans `frame.ts`, tous trois éprouvés sans React.
 * Il ne tient que l'état — où l'on en est, ce qu'on a répondu — et les deux
 * allers au serveur que les territoires demandent.
 */
export function useStudySession(): StudySession {
  const { events, characters } = useEvents();

  const [stage, setStage] = useState<Stage>("off");
  const [failure, setFailure] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Quizzed[]>([]);
  const [quarry, setQuarry] = useState<Map<string, Quarry>>(new Map());
  const [at, setAt] = useState(0);
  const [given, setGiven] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [shape, setShape] = useState<TerritoryFeature | null>(null);

  const question = questions[at] ?? null;
  const subject =
    question === null ? null : (quarry.get(question.subject.id) ?? null);

  /**
   * Le numéro de la séance en cours.
   *
   * Deux allers au serveur peuvent être en vol quand on recommence vite — la
   * liste d'une partie du monde, la forme d'un territoire — et le plus lent
   * écrirait sur la séance suivante. Chacun relit ce numéro en revenant et se
   * tait s'il a changé.
   */
  const run = useRef(0);

  const begin = useCallback(
    (setup: StudySetup) => {
      run.current += 1;
      const mine = run.current;

      setFailure(null);
      setGiven(null);
      setAnswers(new Map());
      setShape(null);
      setAt(0);
      setStage("busy");

      const lay = (territories: StudyTerritory[]) => {
        if (run.current !== mine) return;

        const { pool, everything, quarry: found } = gather(setup, {
          events,
          characters,
          territories,
        });

        if (pool.length === 0) {
          setFailure(
            "Rien à étudier avec ces réglages : aucun élément ne leur répond.",
          );
          setStage("off");
          return;
        }
        if (everything.length < MIN_SUBJECTS) {
          setFailure(
            `Il faut au moins ${MIN_SUBJECTS} éléments pour qu'une question ait quatre réponses.`,
          );
          setStage("off");
          return;
        }

        setQuarry(found);
        setQuestions(buildStudy({ pool, everything, order: setup.order }));
        setStage("asking");
      };

      if (!setup.aims.includes("territories")) {
        lay([]);
        return;
      }

      fetchTerritoriesToStudy(setup.part)
        .then(lay)
        .catch((bad: unknown) => {
          if (run.current !== mine) return;
          setFailure(
            bad instanceof Error
              ? bad.message
              : "Les territoires n'ont pas pu être chargés.",
          );
          setStage("off");
        });
    },
    [events, characters],
  );

  /**
   * La forme du territoire demandé, cherchée question par question.
   *
   * Une à la fois, parce qu'une forme pèse des dizaines de kilo-octets et
   * qu'une étude peut en compter des centaines : les charger d'avance pour
   * les montrer une par une serait payer tout ce qu'on ne verra pas.
   */
  useEffect(() => {
    if (subject === null || subject.kind !== "territory") {
      setShape(null);
      return;
    }

    const mine = run.current;
    const wanted = subject.territory.id;
    let kept = true;

    setShape(null);
    fetchTerritoriesByIds([wanted])
      .then((found) => {
        if (!kept || run.current !== mine) return;
        setShape(found[0] ?? null);
      })
      .catch(() => {
        // Sans forme, la question reste posable : le nom et les dates sont
        // là, c'est seulement la planche qui reste nue.
        if (kept) setShape(null);
      });

    return () => {
      kept = false;
    };
  }, [subject]);

  const answer = useCallback(
    (id: string) => {
      if (question === null || given !== null) return;
      setGiven(id);
      setAnswers((one) => new Map(one).set(question.subject.id, id));
    },
    [question, given],
  );

  /**
   * La question suivante, ou le relevé s'il n'y en a plus.
   *
   * La décision est prise **avant** de poser le nouvel état et non dans la
   * mise à jour elle-même : une fonction de mise à jour doit être pure, React
   * se réservant de la rejouer, et un `setStage` dedans partirait deux fois.
   */
  const next = useCallback(() => {
    setGiven(null);
    if (at + 1 >= questions.length) {
      setStage("done");
      return;
    }
    setAt(at + 1);
  }, [at, questions.length]);

  const score = useMemo(() => tally(questions, answers), [questions, answers]);

  return {
    live: stage !== "off",
    busy: stage === "busy",
    failure,
    asking: stage === "asking",
    leaving: stage === "leaving",
    done: stage === "done",

    question,
    subject,
    shape,
    at: at + 1,
    total: questions.length,
    given,
    score: stage === "off" ? NOTHING : score,

    begin,
    answer,
    next,
    leave: useCallback(() => setStage("leaving"), []),
    stay: useCallback(() => setStage("asking"), []),
    quit: useCallback(() => setStage("quitting"), []),
    /* Gardé : la carte de confirmation annonce aussi sa sortie quand on a
       répondu « Continuer », et le relevé n'a alors rien à faire là. */
    sealed: useCallback(
      () => setStage((one) => (one === "quitting" ? "done" : one)),
      [],
    ),
    close: useCallback(() => {
      run.current += 1;
      setStage("off");
      setQuestions([]);
      setQuarry(new Map());
      setAnswers(new Map());
      setShape(null);
      setGiven(null);
      setAt(0);
    }, []),
    forget: useCallback(() => setFailure(null), []),
  };
}
