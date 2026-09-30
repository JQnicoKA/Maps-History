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

/** What we promise when something is reported, and must be able to keep. */
export const ANSWER_WITHIN = "24 heures";

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
export const TERMS_VERSION = "2026-09-29";
