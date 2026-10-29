import { refusal } from "../../lib/refusal";
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
