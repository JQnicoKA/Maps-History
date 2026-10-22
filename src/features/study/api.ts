import type { StudyPart } from "./parts";
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
 * Les territoires rangés par le lecteur n'en sont pas : ce qu'on a retiré de sa
 * carte n'a pas à revenir en question.
 */
export async function fetchTerritoriesToStudy(
  part: StudyPart | null,
): Promise<StudyTerritory[]> {
  const { data, error } = await supabase().rpc("territories_to_study", {
    part,
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
