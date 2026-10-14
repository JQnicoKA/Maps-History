import { supabase } from "../../lib/supabase";

/**
 * Ce qu'une notification annonce, et donc ce qu'elle propose.
 *
 * - `admitted` — une proposition est entrée dans la bibliothèque. On offre de
 *   rattacher sa ligne, ce qui ouvre les mises à jour.
 * - `promoted` — une ville ou un territoire est passé dans le fond de carte.
 *   Rien à rattacher : tout le monde l'a déjà, et la ligne de son auteur a été
 *   supprimée parce qu'elle y ferait doublon.
 * - `stale` — la bibliothèque a corrigé une entrée dont on tient un
 *   exemplaire. On offre de la reprendre.
 */
export type NoticeSort = "admitted" | "promoted" | "stale";

/**
 * Plus large que `Kind` : une notification parle aussi des villes et des
 * territoires, qui n'ont pas de catalogue mais ont bel et bien un auteur à
 * prévenir.
 */
export type NoticeKind =
  | "event"
  | "character"
  | "folder"
  | "tree"
  | "place"
  | "territory";

export type Notice = {
  sort: NoticeSort;
  kind: NoticeKind;
  /**
   * La ligne du lecteur — celle sur laquelle on agit.
   *
   * Pour une promotion, c'est celle qui a été jugée, et elle n'existe plus :
   * elle ne sert alors qu'à identifier la notification pour la balayer.
   */
  sourceId: string;
  /** L'entrée de la bibliothèque, ou la ligne du fond de carte. */
  entryId: string;
  /** Le nom de l'entrée, tel que la bibliothèque le porte aujourd'hui. */
  title: string;
  /** `stale` seulement : le lecteur a modifié son exemplaire depuis sa prise. */
  touched: boolean;
  /** `admitted` seulement : sa ligne existe encore, il y a de quoi rattacher. */
  attachable: boolean;
  at: string;
};

type Row = {
  sort: NoticeSort;
  kind: NoticeKind;
  source_id: string;
  entry_id: string;
  title: string;
  touched: boolean;
  attachable: boolean;
  at: string;
};

/**
 * Tout ce que ce lecteur n'a pas encore lu.
 *
 * Calculé à chaque fois, et non pas stocké : les deux premiers genres se
 * lisent dans `review`, le troisième se déduit des dates. Une table de
 * notifications aurait voulu dire une ligne par détenteur à chaque correction,
 * et elle aurait menti le jour où quelqu'un se met à jour depuis le
 * formulaire, puisque rien n'irait l'effacer. Voir `my_notices()`.
 */
export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase().rpc("my_notices");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    sort: row.sort,
    kind: row.kind,
    sourceId: row.source_id,
    entryId: row.entry_id,
    title: row.title,
    touched: row.touched,
    attachable: row.attachable,
    at: row.at,
  }));
}

/**
 * Rattache sa ligne à l'entrée qu'elle a fait naître.
 *
 * Le geste de l'auteur, jamais celui du conservateur : admettre une
 * proposition laisse sa ligne indépendante, et c'est lui qui décide de la
 * lier. Ce qu'il y gagne, ce sont les corrections ; ce qu'il y perd, c'est sa
 * case « proposer », que la base referme — une copie ne se propose pas, et la
 * bibliothèque tient déjà son apport.
 */
export async function attach(
  kind: NoticeKind,
  sourceId: string,
): Promise<void> {
  const { error } = await supabase().rpc("attach", {
    about: kind,
    which: sourceId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Balaie une notification.
 *
 * Datée, et c'est tout l'intérêt : une correction postérieure au balayage
 * ramène la ligne « une nouvelle version existe ». Ce qu'on écarte, c'est
 * cette version-là, pas la question.
 */
export async function dismiss(
  sort: NoticeSort,
  kind: NoticeKind,
  sourceId: string,
): Promise<void> {
  const { error } = await supabase().rpc("dismiss", {
    sort,
    about: kind,
    which: sourceId,
  });
  if (error) throw new Error(error.message);
}

/** Le genre, dans la phrase qui l'annonce. */
export function nameOf(kind: NoticeKind): string {
  switch (kind) {
    case "event":
      return "événement";
    case "character":
      return "personnage";
    case "folder":
      return "classeur";
    case "tree":
      return "arbre";
    case "place":
      return "ville";
    case "territory":
      return "territoire";
  }
}
