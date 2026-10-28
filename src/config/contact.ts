/**
 * Where a reader writes when something is wrong.
 *
 * Published in the app because it has to be: an application carrying what
 * its readers write owes them a way to reach whoever keeps it, and the App
 * Store asks for exactly that alongside reporting and blocking.
 *
 * **This has to be an inbox somebody reads.** The domain already sends mail
 * through Resend; receiving is a separate setting, and an address that
 * bounces is worse than none.
 */
export const CONTACT = "contact@historynote.fr";

/**
 * Deux délais, et c'était un seul.
 *
 * `ANSWER_WITHIN` valait « 24 heures » et servait aux deux : le temps de
 * **regarder** un signalement, et le temps de **répondre** à un message. Ce
 * sont deux promesses différentes, et les confondre imposait la plus
 * ambitieuse à l'autre — vingt-quatre heures pour écrire une vraie réponse, un
 * dimanche, par une personne seule, n'est pas une promesse mais un souhait. Et
 * une promesse écrite dans l'application est une promesse : ce qu'on y promet,
 * il faut pouvoir le tenir le mauvais jour, pas le bon.
 */

/**
 * Le temps de jeter un œil à un signalement.
 *
 * Plus court que le délai de réponse, et il doit l'être : ce qu'on signale est
 * le plus souvent un contenu qu'on ne veut pas voir rester, et le lecteur qui
 * le signale attend qu'il disparaisse, pas qu'on lui écrive. Regarder n'est
 * pas répondre — c'est ce que les deux constantes séparent.
 */
export const LOOKED_AT_WITHIN = "72 heures";

/**
 * Quand une réponse écrite arrive — **une tournure, et non une durée.**
 *
 * C'est ce qui lui vaut son nom : `ANSWER_WITHIN` a porté « 24 heures » puis
 * « 1 semaine », et les phrases disaient « répondons **sous** X ». Une
 * constante qui ne contient plus de nombre ne peut pas se glisser derrière
 * « sous », donc les phrases l'accueillent telle quelle et le nom annonce
 * qu'elle est déjà dite — comme les `said` du reste de l'application.
 *
 * Aucun texte n'impose de délai à une réponse de courtoisie, et une borne
 * qu'on tiendrait mal vaut moins qu'une absence de borne.
 *
 * **Ce raisonnement ne vaut que pour la courtoisie.** Les demandes qui
 * relèvent du RGPD gardent leur délai chiffré sur les pages du site — un mois,
 * prolongeable de deux —, et le règlement veut les deux moitiés de la phrase :
 * « dans les meilleurs délais **et en tout état de cause** dans un délai d'un
 * mois ». Le chiffre y est le repère à partir duquel une personne sait qu'elle
 * peut saisir la CNIL ; un droit dont on ne peut pas constater la violation
 * n'est pas un droit.
 */
export const ANSWER_SAID = "dans les plus brefs délais";

/** Where the two documents live, and the version of the terms in force. */
export const TERMS_URL = "https://historynote.fr/conditions.html";
export const PRIVACY_URL = "https://historynote.fr/confidentialite.html";

/**
 * The date the terms in force were written.
 *
 * Kept beside the acceptance so that terms revised later can be told apart
 * from terms accepted before them. Change it whenever the page changes in a
 * way a reader should be told about.
 */
/*
 * Reprise le 14 octobre 2026 : ce que la case de partage accorde a changé de
 * nature — elle n'ouvre plus l'élément aux autres lecteurs, elle autorise la
 * bibliothèque à s'en inspirer — et les entrées ne portent plus de signature.
 * Un lecteur qui a accepté la version précédente a accepté autre chose.
 */
export const TERMS_VERSION = "2026-10-14";
