/**
 * Porter à nos conservateurs ce qu'un lecteur nous écrit.
 *
 * Trois temps, dans cet ordre, et l'ordre est tout :
 *
 *   1. **Déposer le message** par `write_to_us`, qui lit l'adresse dans
 *      `auth.users`, borne la cadence et borne la longueur.
 *   2. **Expédier** le courriel par l'API de Resend.
 *   3. **Noter** ce qu'il est devenu, par `message_was_sent`.
 *
 * Déposer d'abord, expédier ensuite : un courriel qui échoue ne coûte alors
 * que le courriel. Dans l'autre ordre, une clé d'API révoquée ou une panne de
 * Resend ferait disparaître le message sans que personne sache qu'il a existé.
 *
 * **Aucun privilège élevé**, comme dans `copy` : la fonction agit avec le
 * jeton de l'appelant et ne peut faire que ce que les deux portes SQL
 * autorisent. `service_role` n'apparaît pas.
 *
 * Trois secrets, posés avec `supabase secrets set` :
 *
 *   - `RESEND_API_KEY` — https://resend.com > API Keys.
 *   - `CONTACT_TO` — l'adresse qui reçoit.
 *   - `CONTACT_FROM` — l'expéditeur, **facultatif** : à défaut, l'adresse de
 *     contact publiée par l'application. À ne poser que pour expédier depuis
 *     une autre adresse.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * L'expéditeur par défaut : l'adresse que l'application publie déjà.
 *
 * C'est `CONTACT` de `src/config/contact.ts`, recopié ici parce que les deux
 * côtés du réseau ne partagent pas de module — la bibliothèque l'affiche quand
 * on signale une entrée, et c'est de là que nous répondons.
 *
 * **Le repli fut `onboarding@resend.dev`, et c'était un piège.** Ce domaine
 * d'essai de Resend n'exige aucune vérification, d'où son attrait ; mais il
 * n'autorise l'envoi qu'à l'adresse du titulaire du compte, et Resend refuse
 * tout le reste par un 403 qui parle de vérifier un domaine. On croit donc
 * qu'il manque une vérification alors qu'il manque un expéditeur : un domaine
 * vérifié ne sert à rien si le `from` ne l'emploie pas.
 *
 * Un défaut qui dégrade en silence est pire qu'un défaut qui manque.
 */
const REPLI_EXPEDITEUR = "HistoryNote <contact@historynote.fr>";

const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json" },
  });

/** Le corps du message, échappé : il part dans du HTML. */
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

  let said = "";
  try {
    const recu = await requete.json();
    said = typeof recu?.body === "string" ? recu.body : "";
  } catch {
    return repondre({ erreur: "Corps illisible." }, 400);
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: jeton } } },
  );

  // 1. Le dépôt. C'est lui qui refuse un message trop court, trop long, ou le
  //    sixième de l'heure — et son message d'erreur est écrit pour être lu par
  //    le lecteur, donc on le rend tel quel.
  const { data, error } = await client.rpc("write_to_us", { body: said });
  const garde = Array.isArray(data) ? data[0] : data;
  if (error || !garde) {
    return repondre({ erreur: error?.message ?? "Message non enregistré." }, 400);
  }

  // 2. L'expédition.
  const cle = Deno.env.get("RESEND_API_KEY");
  const vers = Deno.env.get("CONTACT_TO");
  const de = Deno.env.get("CONTACT_FROM") ?? REPLI_EXPEDITEUR;

  if (!cle || !vers) {
    /* Le message est gardé, et c'est ce qui compte. Le lecteur n'a pas à
       savoir qu'il manque une clé : de son point de vue son message est bien
       arrivé quelque part, et il l'est. */
    await client.rpc("message_was_sent", {
      which: garde.id,
      why: "RESEND_API_KEY ou CONTACT_TO absent",
    });
    return repondre({ garde: true, expedie: false });
  }

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
        /* Répondre doit marcher d'un seul geste depuis la boîte qui reçoit :
           sans cela il faut recopier l'adresse à la main à chaque message. */
        reply_to: garde.email,
        subject: `HistoryNote — message de ${garde.email}`,
        html:
          `<p><strong>${echapper(garde.email)}</strong> écrit :</p>` +
          `<blockquote style="white-space:pre-wrap">${echapper(garde.said)}</blockquote>` +
          `<p style="color:#777;font-size:12px">Reçu le ${garde.at} · message ${garde.id}</p>`,
      }),
    });
    if (envoi.ok) {
      expedie = true;
    } else {
      pourquoi = `Resend ${envoi.status} : ${(await envoi.text()).slice(0, 300)}`;
    }
  } catch (cause) {
    pourquoi = cause instanceof Error ? cause.message : String(cause);
  }

  // 3. La comptabilité.
  await client.rpc("message_was_sent", {
    which: garde.id,
    why: pourquoi,
  });

  /* Toujours un succès pour le lecteur dès que le message est gardé : il a
     fait ce qu'on lui demandait, et une panne de notre côté n'est pas une
     raison de lui faire retaper son texte. L'échec se lit dans la table. */
  return repondre({ garde: true, expedie });
});
