/**
 * Ce qu'une fonction de bord a répondu, repêché dans le corps de la réponse.
 *
 * `functions.invoke` ramène tout statut non-2xx à un `FunctionsHttpError` dont
 * le message ne dit que « non-2xx status code ». Or ce qui est écrit pour être
 * lu — « Vous nous avez déjà écrit cinq fois dans l'heure », « trois
 * signalements dans l'heure » — est dans le corps, mis là par la porte SQL et
 * rendu tel quel par la fonction sous la clé `erreur`. Sans ce repêchage, un
 * refus parfaitement explicable s'afficherait comme une panne.
 *
 * Servait d'abord à `writeToUs` seul ; le signalement a la même forme de
 * réponse et le même besoin.
 */
export async function refusal(error: Error): Promise<string> {
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
