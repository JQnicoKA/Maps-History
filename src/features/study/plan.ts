/**
 * Ce qu'une étude demande, et dans quel ordre.
 *
 * Tout ici est de l'arithmétique : tirer des propositions, les mêler, ranger
 * les questions. Rien ne connaît React, la carte ni la base — c'est ce qui
 * permet de l'éprouver sous `vitest`, qui tourne sans configuration et refuse
 * donc tout module important `react-native`.
 *
 * Le module ignore aussi ce qu'il interroge. Un événement, un personnage et un
 * territoire n'ont en commun qu'un nom à retrouver et une date qui les range :
 * c'est tout ce que `Subject` porte, et c'est l'appelant qui réduit sa
 * collection à cela. Un quiz qui connaîtrait les trois espèces aurait trois
 * fois le même code.
 */

/** Ce qu'une question a besoin de savoir de son sujet, et rien de plus. */
export type Subject = {
  id: string;
  /** Le nom qu'il faut retrouver : un titre, un nom de personne, un pays. */
  label: string;
  /**
   * L'année qui le range.
   *
   * Celle de l'événement, de la naissance, du début du règne. Elle sert deux
   * fois : à mettre les questions dans l'ordre du temps, et à choisir des
   * fausses réponses crédibles — voir `NEAR`.
   */
  at: number;
};

/** Une question posée : son sujet, et les réponses offertes, déjà mêlées. */
export type Quizzed = {
  subject: Subject;
  /** La bonne est celle dont l'`id` est celui du sujet. */
  options: Subject[];
};

/** Dans l'ordre du temps, ou tiré au sort. */
export type StudyOrder = "chronological" | "random";

/** Combien de réponses sont offertes, quand la collection le permet. */
export const OPTIONS = 4;

/**
 * Le plus petit nombre de sujets avec quoi une étude a un sens.
 *
 * Il en faut quatre pour remplir une question. En dessous, les propositions
 * se répètent d'une question à l'autre au point que la troisième se devine :
 * mieux vaut le dire avant de commencer que de laisser l'étude se vider
 * d'elle-même.
 */
export const MIN_SUBJECTS = OPTIONS;

/**
 * Parmi combien de voisins dans le temps on tire les fausses réponses.
 *
 * **Pas au hasard dans toute la collection, et c'est le choix pédagogique du
 * module.** Les dates du sujet sont écrites sous son marqueur ; si les trois
 * leurres viennent de trois siècles étrangers, la date les élimine sans qu'on
 * ait à savoir quoi que ce soit, et l'étude n'enseigne rien. Les leurres sont
 * donc pris chez les voisins — assez nombreux pour que la réponse ne soit pas
 * toujours la même triade, assez proches pour qu'il faille reconnaître le
 * lieu et le nom, et non lire la date.
 *
 * Douze : trois fois ce qu'une question consomme, de quoi varier franchement
 * d'une fois sur l'autre sans aller chercher au loin.
 */
export const NEAR = 12;

/**
 * Un hasard que l'on peut rejouer.
 *
 * `Math.random` suffit à l'application, mais un tirage qu'on ne peut pas
 * reproduire ne s'éprouve pas : les tests passent une graine et lisent un
 * résultat arrêté. C'est `mulberry32`, qui tient en cinq lignes et dont la
 * qualité est très au-delà de ce qu'un quiz demande.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = state;
    drawn = Math.imul(drawn ^ (drawn >>> 15), drawn | 1);
    drawn ^= drawn + Math.imul(drawn ^ (drawn >>> 7), drawn | 61);
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, sur une copie : l'appelant garde sa liste. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const mixed = [...items];
  for (let at = mixed.length - 1; at > 0; at -= 1) {
    const other = Math.floor(rng() * (at + 1));
    const held = mixed[at] as T;
    mixed[at] = mixed[other] as T;
    mixed[other] = held;
  }
  return mixed;
}

/**
 * Les réponses offertes pour un sujet : la bonne et ses voisins, mêlées.
 *
 * `others` est **toute** la collection et non le sous-ensemble étudié : qui
 * révise un seul classeur ne doit pas voir les fausses réponses se réduire à
 * ce classeur, ce qui le désignerait. Le sujet lui-même y figure
 * probablement ; il en est retiré ici.
 *
 * Les homonymes sont écartés : deux propositions portant le même mot font une
 * question sans réponse juste.
 */
export function chooseOptions(
  subject: Subject,
  others: readonly Subject[],
  rng: () => number,
  count: number = OPTIONS,
): Subject[] {
  const seen = new Set([subject.label]);
  const candidates: Subject[] = [];
  for (const other of others) {
    if (other.id === subject.id || seen.has(other.label)) continue;
    seen.add(other.label);
    candidates.push(other);
  }

  // Les voisins dans le temps d'abord — voir `NEAR`. À distance égale, l'ordre
  // de la collection décide, ce qui garde le tri prévisible.
  const near = [...candidates]
    .sort(
      (one, two) =>
        Math.abs(one.at - subject.at) - Math.abs(two.at - subject.at),
    )
    .slice(0, Math.max(NEAR, count - 1));

  const decoys = shuffle(near, rng).slice(0, count - 1);
  return shuffle([subject, ...decoys], rng);
}

export type StudyPlan = {
  pool: readonly Subject[];
  /** Toute la collection, où se prennent les fausses réponses. */
  everything: readonly Subject[];
  order: StudyOrder;
  rng?: () => number;
};

/**
 * Les questions d'une étude, prêtes à poser.
 *
 * Toutes celles que le filtre retient, sans plafond : le compteur annonce le
 * total, et une étude qui s'arrêterait avant d'avoir tout demandé laisserait
 * croire qu'on a fait le tour.
 */
export function buildStudy({
  pool,
  everything,
  order,
  rng = Math.random,
}: StudyPlan): Quizzed[] {
  const asked =
    order === "chronological"
      ? [...pool].sort((one, two) => one.at - two.at)
      : shuffle(pool, rng);

  return asked.map((subject) => ({
    subject,
    options: chooseOptions(subject, everything, rng),
  }));
}

/** Le compte juste, sur le total : ce que la carte de résumé annonce. */
export type StudyScore = { right: number; asked: number; missed: Subject[] };

/**
 * Le relevé d'une étude, menée au bout ou abandonnée.
 *
 * `asked` est le nombre de questions auxquelles on a répondu, et non le
 * nombre prévu : partir à la troisième sur quarante ne donne pas trente-sept
 * fautes, il donne un score sur deux.
 */
export function tally(
  questions: readonly Quizzed[],
  answers: ReadonlyMap<string, string>,
): StudyScore {
  const missed: Subject[] = [];
  let right = 0;
  for (const question of questions) {
    const given = answers.get(question.subject.id);
    if (given === undefined) continue;
    if (given === question.subject.id) right += 1;
    else missed.push(question.subject);
  }
  return { right, asked: answers.size, missed };
}
