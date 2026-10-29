/**
 * Porter un signalement à nos conservateurs.
 *
 * **Jumelle de `contact`**, et délibérément : mêmes trois temps, même ordre,
 * mêmes raisons.
 *
 *   1. **Déposer** par `report_it`, qui écrit la ligne, lit l'adresse du
 *      signaleur dans `auth.users` et va chercher le nom de ce qui est
 *      signalé dans sa propre table. Le client ne fournit ni l'un ni l'autre :
 *      il pourrait faire accuser n'importe quoi au nom de n'importe qui.
 *   2. **Expédier** par l'API de Resend.
 *   3. **Noter** par `report_was_sent`.
 *
 * Le signalement ne faisait auparavant que le premier temps. La ligne
 * attendait qu'on pense à consulter la table, alors que l'application promet
 * de regarder sous 24 heures.
 *
 * **Aucun privilège élevé**, comme `copy` et `contact` : le jeton de
 * l'appelant, et rien que ce que les deux portes SQL autorisent.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const REPLI_EXPEDITEUR = "HistoryNote <contact@historynote.fr>";

/** Les motifs, dits en toutes lettres — ceux de `REASONS` côté application. */
const MOTIFS: Record<string, string> = {
  offensive: "Contenu choquant ou haineux",
  wrong: "Faux ou trompeur",
  spam: "Indésirable ou publicitaire",
  stolen: "Copié sans autorisation",
  other: "Autre",
};

/** Ce qu'un genre s'appelle dans une phrase française. */
const GENRES: Record<string, string> = {
  event: "un événement",
  character: "un personnage",
  tree: "un arbre",
};

const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json" },
  });

const echapper = (said: string) =>
  said
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

Deno.serve(async (requete) => {
  if (requete.method !== "POST") return repondre({ erreur: "POST" }, 405);

  const jeton = requete.headers.get("Authorization");
  if (!jeton) return repondre({ erreur: "Jeton manquant." }, 401);

  let recu: { kind?: string; id?: string; reason?: string; said?: string };
  try {
    recu = await requete.json();
  } catch {
    return repondre({ erreur: "Corps illisible." }, 400);
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: jeton } } },
  );

  // 1. Le dépôt.
  const { data, error } = await client.rpc("report_it", {
    kind: recu.kind,
    source_id: recu.id,
    reason: recu.reason,
    said: recu.said?.trim() === "" ? null : recu.said,
  });
  if (error) return repondre({ erreur: error.message }, 400);

  const garde = Array.isArray(data) ? data[0] : data;
  if (!garde) {
    /* Aucune ligne rendue : ce lecteur avait déjà signalé cette entrée. Le
       `on conflict do nothing` a fait son office, et il n'y a pas lieu d'en
       avertir une seconde fois. Un succès, du point de vue du lecteur : ce
       qu'il voulait dire est déjà dit. */
    return repondre({ garde: true, expedie: false, deja: true });
  }

  // 2. L'expédition.
  const cle = Deno.env.get("RESEND_API_KEY");
  const vers = Deno.env.get("CONTACT_TO");
  const de = Deno.env.get("CONTACT_FROM") ?? REPLI_EXPEDITEUR;

  if (!cle || !vers) {
    await client.rpc("report_was_sent", {
      which: garde.id,
      why: "RESEND_API_KEY ou CONTACT_TO absent",
    });
    return repondre({ garde: true, expedie: false });
  }

  const genre = GENRES[garde.genre] ?? garde.genre;
  const motif = MOTIFS[garde.motif] ?? garde.motif;
  const titre = garde.titre ?? "(entrée introuvable)";

  let expedie = false;
  let pourquoi: string | null = null;
  try {
    const envoi = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: de,
        to: [vers],
        reply_to: garde.par,
        /* Le motif dans l'objet : la plupart se traitent sans ouvrir, et
           « choquant ou haineux » ne se lit pas au même rythme que
           « indésirable ». */
        subject: `HistoryNote — signalement : ${motif}`,
        html:
          `<p><strong>${echapper(garde.par ?? "?")}</strong> signale ` +
          `${genre} : <strong>${echapper(titre)}</strong></p>` +
          `<p>Motif : <strong>${echapper(motif)}</strong></p>` +
          (garde.commentaire
            ? `<blockquote style="white-space:pre-wrap">${echapper(garde.commentaire)}</blockquote>`
            : "<p style=\"color:#777\">Sans commentaire.</p>") +
          `<p style="color:#777;font-size:12px">` +
          `Reçu le ${garde.at}<br>` +
          /* L'identifiant de la cible, pour retrouver la ligne sans chercher :
             c'est lui qu'il faut inscrire dans `withheld` pour retirer
             l'entrée du catalogue. */
          `${garde.genre} ${garde.cible}<br>` +
          `signalement ${garde.id}</p>`,
      }),
    });
    if (envoi.ok) expedie = true;
    else pourquoi = `Resend ${envoi.status} : ${(await envoi.text()).slice(0, 300)}`;
  } catch (cause) {
    pourquoi = cause instanceof Error ? cause.message : String(cause);
  }

  // 3. La comptabilité.
  await client.rpc("report_was_sent", { which: garde.id, why: pourquoi });

  return repondre({ garde: true, expedie });
});
