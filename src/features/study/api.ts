import { PARTS, type StudyPart } from "./parts";
import type { StudyWindow } from "./subjects";
import { supabase } from "../../lib/supabase";

/**
 * Un territoire du fond de carte, sans sa forme.
 *
 * Ce qu'il faut pour poser une question — un nom à retrouver et les années à
 * écrire sous la planche — et pas un octet de plus. La forme ne se demande
 * qu'une fois la question tirée, par `fetchTerritoriesByIds`, qui la rend avec
 * son lavis et son ancre.
 */
export type StudyTerritory = {
  id: string;
  name: string;
  from: number;
  to: number;
};

/**
 * Tous les territoires d'une partie du monde, de tout temps.
 *
 * **Toute la partie et non la seule fenêtre d'années étudiée**, et c'est
 * délibéré : l'Afrique entre 800 et 1200 ne compte que quatre noms, et des
 * leurres pris dans cette fenêtre reviendraient identiques à chaque question.
 * On rapporte donc la partie entière — sept cent quarante noms au plus, soit
 * quelques dizaines de kilo-octets — et c'est `gather` qui retient les années
 * pour les questions en gardant le reste pour les fausses réponses.
 *
 * Une ligne par nom : la table porte la même entité en autant de tranches que
 * son tracé a changé, et c'est la fonction qui choisit laquelle — voir la
 * migration. Sans ce dédoublonnage, la Francie occidentale serait onze
 * questions, et deux propositions pourraient porter le même nom.
 *
 * Quelle tranche ? Une qui touche la fenêtre étudiée quand il y en a une, la
 * plus vaste sinon. Choisie sans la fenêtre, ce serait la plus vaste de toute
 * l'histoire du nom : l'Allemagne d'avant 1991 pour une étude de l'an 2000,
 * écartée ensuite par `gather` comme hors des années — 13 questions sur 55.
 *
 * Les territoires rangés par le lecteur n'en sont pas : ce qu'on a retiré de sa
 * carte n'a pas à revenir en question.
 */
export async function fetchTerritoriesToStudy(
  parts: StudyPart[],
  window: StudyWindow,
): Promise<StudyTerritory[]> {
  const fetchPart = (part: StudyPart | null) => fetchSlices(part, window);

  // Les quatre ensemble sont le monde entier : la base le rend en un appel
  // quand on ne nomme aucune partie, ses quatre règles couvrant tout.
  if (parts.length === 0 || parts.length === PARTS.length) {
    return fetchPart(null);
  }

  /*
   * Une partie par appel, puis réunies : le découpage reste écrit dans la
   * base seulement. Un même nom peut-il revenir de deux parties ? Ses tranches
   * ont chacune leur ancre, donc oui en théorie — on n'en garde qu'un, sans
   * quoi deux propositions pourraient porter le même nom.
   */
  const found = await Promise.all(parts.map(fetchPart));
  const seen = new Set<string>();
  return found.flat().filter((territory) => {
    if (seen.has(territory.name)) return false;
    seen.add(territory.name);
    return true;
  });
}

async function fetchSlices(
  part: StudyPart | null,
  window: StudyWindow,
): Promise<StudyTerritory[]> {
  const { data, error } = await supabase().rpc("territories_to_study", {
    part,
    // Des années entières : la fenêtre peut tomber au milieu d'une année.
    from_year: window === null ? null : Math.floor(window.from),
    to_year: window === null ? null : Math.ceil(window.to),
  });
  if (error) throw new Error(error.message);

  const rows = data as {
    id: string;
    name: string;
    start_year: number;
    end_year: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    from: row.start_year,
    to: row.end_year,
  }));
}
