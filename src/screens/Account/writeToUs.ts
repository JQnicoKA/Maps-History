import { supabase } from "../../lib/supabase";

/**
 * Porte un message à nos conservateurs.
 *
 * Rend `true` si le courriel est parti, `false` s'il a été **gardé sans
 * partir** — clé d'API absente, Resend en panne. Les deux sont des succès pour
 * le lecteur : son message est enregistré, et c'est tout ce qu'on lui a
 * demandé. Voir `supabase/functions/contact/index.ts`, qui explique pourquoi
 * le dépôt précède l'expédition.
 */
export async function writeToUs(said: string): Promise<boolean> {
  const { data, error } = await supabase().functions.invoke("contact", {
    body: { body: said },
  });

  if (error) throw new Error(await refusal(error));

  const answer = data as { garde?: boolean; expedie?: boolean };
  if (!answer.garde) throw new Error("Message non enregistré.");
  return answer.expedie === true;
}

/**
 * Ce que la fonction a répondu, repêché dans le corps de la réponse.
 *
 * `functions.invoke` ramène tout statut non-2xx à un `FunctionsHttpError` dont
 * le message ne dit que « non-2xx status code ». Or ce qui est écrit pour être
 * lu — « Vous nous avez déjà écrit cinq fois dans l'heure » — est dans le
 * corps, mis là par la porte SQL `write_to_us`. Sans ce repêchage, un refus
 * parfaitement explicable s'afficherait comme une panne.
 */
async function refusal(error: Error): Promise<string> {
  const response = (error as { context?: Response }).context;
  if (response) {
    try {
      const said = (await response.json()) as { erreur?: unknown };
      if (typeof said.erreur === "string" && said.erreur !== "") {
        return said.erreur;
      }
    } catch {
      // Un corps illisible ne dit rien de plus que le message d'origine.
    }
  }
  return error.message;
}
