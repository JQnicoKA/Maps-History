/**
 * Prendre copie d'une contribution, en un seul appel.
 *
 * Une copie se fait en deux temps : la porte SQL `copy_*` insère les lignes —
 * événement, photos, liaisons — en pointant **les fichiers de l'auteur**, puis
 * il faut dupliquer ces fichiers dans le dossier du copieur et réaimer les
 * lignes dessus. Postgres ne peut pas faire le second temps : le schéma
 * `storage` n'expose que des métadonnées, et ni `pg_net` ni `http` ne sont
 * installés.
 *
 * Ce second temps vivait donc dans l'application, et c'était fragile pour deux
 * raisons : un échec de duplication était avalé en silence, laissant la ligne
 * sur le fichier de l'auteur ; et un téléphone mis en arrière-plan entre les
 * deux temps laissait la copie à moitié faite, sans que rien ne réessaie
 * jamais. Mesuré le 2 octobre 2026 : une ligne sur soixante-quinze était dans
 * cet état.
 *
 * Ici, les deux temps sont du même côté du réseau. Le téléphone fait un appel
 * et reçoit une réponse : soit la copie a eu lieu entièrement, soit elle dit
 * ce qui manque.
 *
 * **Aucun privilège élevé.** La fonction agit avec le jeton de l'appelant, et
 * ne fait que ce que l'appelant pourrait faire lui-même : lire un fichier d'un
 * seau public, écrire dans son propre dossier. `service_role` n'apparaît pas,
 * et c'est délibéré — le modèle de sécurité de ce projet est fait de portes
 * étroites vérifiées par Postgres, pas de clés qui ouvrent tout.
 */
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SEAU = "event-photos";

type Genre = "event" | "character" | "folder" | "tree" | "territory";

/** Quelle porte SQL pour quel genre — même table que côté application. */
const PORTE: Record<Genre, string> = {
  event: "copy_event",
  character: "copy_character",
  folder: "copy_folder",
  tree: "copy_tree",
  territory: "copy_territory",
};

/** Où les photos d'un genre se rangent, et par quelle colonne on les trouve. */
const PHOTOS: Partial<
  Record<Genre, { table: string; cle: string; dossier: string }>
> = {
  event: { table: "event_photos", cle: "event_id", dossier: "events" },
  character: {
    table: "character_photos",
    cle: "character_id",
    dossier: "characters",
  },
};

const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json" },
  });

/** L'extension d'un chemin, `jpg` à défaut. */
const extension = (chemin: string) => chemin.split(".").pop() ?? "jpg";

/**
 * Déplace un fichier vers le dossier de l'appelant et réaime la ligne dessus.
 *
 * Rend `null` si tout s'est bien passé, le motif de l'échec sinon. Rien n'est
 * avalé : c'est tout l'objet de cette réécriture.
 */
async function emporter(
  client: SupabaseClient,
  moi: string,
  chemin: string,
  vers: string,
  reaimer: (nouveau: string) => Promise<{ error: unknown }>,
): Promise<string | null> {
  // Déjà chez l'appelant : rien à faire, et le dire n'est pas une erreur.
  if (chemin.startsWith(`${moi}/`)) return null;

  const { error: refus } = await client.storage.from(SEAU).copy(chemin, vers);
  if (refus) return `copie de ${chemin} refusée : ${refus.message}`;

  const { error: echec } = await reaimer(vers);
  if (echec) {
    // La ligne n'a pas suivi : le fichier dupliqué ne sert à personne, on le
    // retire plutôt que de laisser un orphelin derrière nous.
    await client.storage.from(SEAU).remove([vers]);
    return `ligne non réaimée vers ${vers}`;
  }
  return null;
}

/** Les photos d'un événement ou d'un personnage fraîchement copié. */
async function emporterLesPhotos(
  client: SupabaseClient,
  moi: string,
  genre: Genre,
  fait: string,
): Promise<string[]> {
  const ou = PHOTOS[genre];
  if (!ou) return [];

  const { data, error } = await client
    .from(ou.table)
    .select("id, storage_path, position")
    .eq(ou.cle, fait);
  if (error) return [`photos illisibles : ${error.message}`];

  const soucis: string[] = [];
  for (const photo of (data ?? []) as {
    id: string;
    storage_path: string;
    position: number;
  }[]) {
    const vers = `${moi}/${ou.dossier}/${fait}/${photo.position}-${Date.now()}.${extension(photo.storage_path)}`;
    const souci = await emporter(
      client,
      moi,
      photo.storage_path,
      vers,
      (nouveau) =>
        client
          .from(ou.table)
          .update({ storage_path: nouveau })
          .eq("id", photo.id),
    );
    if (souci) soucis.push(souci);
  }
  return soucis;
}

/** La couverture d'un classeur, qui vit sur sa propre ligne. */
async function emporterLaCouverture(
  client: SupabaseClient,
  moi: string,
  fait: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("folders")
    .select("photo_path")
    .eq("id", fait)
    .maybeSingle();
  if (error) return [`classeur illisible : ${error.message}`];

  const chemin = (data as { photo_path: string | null } | null)?.photo_path;
  if (!chemin) return [];

  const vers = `${moi}/folders/${fait}/cover-${Date.now()}.${extension(chemin)}`;
  const souci = await emporter(client, moi, chemin, vers, (nouveau) =>
    client.from("folders").update({ photo_path: nouveau }).eq("id", fait),
  );
  return souci ? [souci] : [];
}

/**
 * Rapatrier ce qui serait resté en arrière.
 *
 * Le filet, et il reste nécessaire même avec la copie désormais atomique : la
 * couche de stockage peut toujours refuser une duplication, et il existe des
 * lignes antérieures à cette fonction. La RLS fait le tri — une requête nue
 * sur ces tables ne rend que les lignes de l'appelant — donc il suffit de
 * demander celles dont le chemin n'est pas sous son dossier.
 */
async function rapatrier(
  client: SupabaseClient,
  moi: string,
): Promise<{ reparees: number; soucis: string[] }> {
  let reparees = 0;
  const soucis: string[] = [];

  for (const ou of [PHOTOS.event!, PHOTOS.character!]) {
    const { data, error } = await client
      .from(ou.table)
      .select(`id, storage_path, position, ${ou.cle}`)
      .not("storage_path", "like", `${moi}/%`);
    if (error) {
      soucis.push(`${ou.table} illisible : ${error.message}`);
      continue;
    }
    for (const photo of (data ?? []) as Record<string, string | number>[]) {
      const chemin = photo.storage_path as string;
      const parent = photo[ou.cle] as string;
      const vers = `${moi}/${ou.dossier}/${parent}/${photo.position}-${Date.now()}.${extension(chemin)}`;
      const souci = await emporter(client, moi, chemin, vers, (nouveau) =>
        client
          .from(ou.table)
          .update({ storage_path: nouveau })
          .eq("id", photo.id as string),
      );
      if (souci) soucis.push(souci);
      else reparees += 1;
    }
  }

  const { data: classeurs, error: echec } = await client
    .from("folders")
    .select("id, photo_path")
    .not("photo_path", "is", null)
    .not("photo_path", "like", `${moi}/%`);
  if (echec) soucis.push(`classeurs illisibles : ${echec.message}`);
  for (const classeur of (classeurs ?? []) as {
    id: string;
    photo_path: string;
  }[]) {
    const vers = `${moi}/folders/${classeur.id}/cover-${Date.now()}.${extension(classeur.photo_path)}`;
    const souci = await emporter(client, moi, classeur.photo_path, vers, (n) =>
      client.from("folders").update({ photo_path: n }).eq("id", classeur.id),
    );
    if (souci) soucis.push(souci);
    else reparees += 1;
  }

  return { reparees, soucis };
}

Deno.serve(async (requete) => {
  if (requete.method !== "POST") {
    return repondre({ error: "POST seulement" }, 405);
  }

  const jeton = requete.headers.get("Authorization");
  if (!jeton) return repondre({ error: "non authentifié" }, 401);

  // Le jeton de l'appelant, et la clé publiable : la RLS s'applique
  // exactement comme depuis le téléphone.
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: jeton } },
      auth: { persistSession: false },
    },
  );

  const { data: qui, error: inconnu } = await client.auth.getUser();
  if (inconnu || !qui?.user) return repondre({ error: "non authentifié" }, 401);
  const moi = qui.user.id;

  const corps = (await requete.json().catch(() => ({}))) as {
    action?: string;
    kind?: Genre;
    id?: string;
  };

  if (corps.action === "mend") {
    const { reparees, soucis } = await rapatrier(client, moi);
    return repondre({ mended: reparees, ...(soucis.length ? { soucis } : {}) });
  }

  const genre = corps.kind;
  const voulu = corps.id;
  if (!genre || !PORTE[genre] || typeof voulu !== "string") {
    return repondre({ error: "kind ou id manquant" }, 400);
  }

  const { data, error } = await client.rpc(PORTE[genre], { wanted: voulu });
  if (error) return repondre({ error: error.message }, 400);
  const fait = data as string;

  const soucis =
    genre === "folder"
      ? await emporterLaCouverture(client, moi, fait)
      : await emporterLesPhotos(client, moi, genre, fait);

  // La copie existe ; si un fichier n'a pas suivi, on le dit sans la défaire.
  // Le filet `mend` repassera, et l'appelant sait que son image peut manquer.
  return repondre({ id: fait, ...(soucis.length ? { soucis } : {}) });
});
