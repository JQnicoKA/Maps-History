import * as api from "./api";
import type { Kind } from "./types";
import { supabase } from "../../lib/supabase";

/**
 * Un exemplaire que la bibliothèque a corrigé depuis qu'on l'a pris.
 *
 * Rien n'est appliqué sans un geste du lecteur : la carte de quelqu'un ne
 * doit pas bouger pendant la nuit. Voir `stale()` côté base, qui ne fait que
 * répondre à la question.
 */
export type Stale = {
  kind: Kind;
  id: string;
  title: string;
  /**
   * Vrai si le lecteur a modifié son exemplaire depuis sa prise.
   *
   * Décide du ton de l'avertissement, et rien d'autre : sans modification il
   * n'y a rien à perdre, et effrayer quelqu'un pour une reprise sans perte
   * est le meilleur moyen de lui faire refuser toutes les suivantes.
   */
  touched: boolean;
  /**
   * L'entrée de la bibliothèque qui a pris de l'avance.
   *
   * Pour aller la **voir** avant de décider : on ne reprend plus à l'aveugle
   * une version dont on ne sait rien, et dont la reprise peut écraser son
   * propre travail. C'est la fiche du catalogue qui porte le geste, une fois
   * qu'on a lu ce qu'elle contient.
   */
  entry: string;
};

/** Tout ce qui, chez ce lecteur, a pris du retard. Souvent vide. */
export async function fetchStale(): Promise<Stale[]> {
  const { data, error } = await supabase().rpc("stale");
  if (error) throw new Error(error.message);
  return (data ?? []) as Stale[];
}

/**
 * Reprend l'entrée de la bibliothèque dans l'exemplaire qu'on détient.
 *
 * Deux temps, comme la copie : la base réécrit la ligne, puis les fichiers
 * suivent. Les photographies reprises désignent le dossier de stockage de la
 * bibliothèque, et un exemplaire qui s'y réfère se viderait le jour où elle
 * les remplace — d'où `mend`, le filet qui rapatrie dans le dossier du
 * lecteur tout ce qui pointe encore ailleurs. C'est le même filet qui
 * rattrape les copies dont un fichier n'a pas suivi, et il n'avait pas
 * besoin d'être écrit deux fois.
 *
 * `mend` est silencieux : s'il échoue, l'exemplaire montre encore les images
 * de la bibliothèque, ce qui marche, et il repassera au prochain démarrage.
 */
export async function refreshFromLibrary(
  kind: Kind,
  id: string,
): Promise<void> {
  const { error } = await supabase().rpc("refresh_from_library", {
    about: kind,
    which: id,
  });
  if (error) throw new Error(error.message);
  await api.mend();
}
