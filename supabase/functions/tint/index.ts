/**
 * La couleur dominante d'une photographie, calculée une fois pour toutes.
 *
 * React Native ne sait pas lire les pixels d'une image : il n'y a pas de
 * canvas, et les modules natifs qui le font — Palette côté Android,
 * UIImageColors côté iOS — demandent une reconstruction de l'application, un
 * calcul asynchrone par carte et un scintillement orange→couleur au premier
 * rendu. Ici, le calcul a lieu **une fois dans la vie de la photographie**, du
 * côté du réseau où personne ne l'attend, et le téléphone ne lit plus qu'une
 * colonne.
 *
 * Deux portes, une seule différence :
 *
 * - `{ character: <id> }` — les portraits de cette personne, appelé juste
 *   après un enregistrement, de sorte que la couleur soit là quand la fiche
 *   est relue.
 * - `{}` — tout ce qui n'a jamais été regardé, plafonné. C'est le filet : il
 *   rattrape les photographies antérieures à cette fonction et celles dont le
 *   téléchargement a échoué un jour. Appelé une fois par démarrage.
 *
 * **Aucun privilège élevé**, comme la fonction `copy` : le jeton de l'appelant
 * et la clé publiable, donc la RLS exactement comme depuis le téléphone. Un
 * appelant ne peut peindre que ses propres portraits, et le `select` nu suffit
 * à le garantir — ce n'est pas cette fonction qui filtre, c'est Postgres.
 */
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import jpeg from "npm:jpeg-js@0.4.4";

const SEAU = "event-photos";

/**
 * Combien de photographies un appel traite au plus.
 *
 * Chacune coûte un téléchargement et un décodage en JavaScript pur — de
 * l'ordre de 300 ms pour les 1600 px que `shrink()` laisse passer. Douze tient
 * largement dans le temps imparti à une fonction, et le filet rappellera au
 * démarrage suivant s'il en reste.
 */
const PLAFOND = 12;

/**
 * Combien de pixels on regarde, quelle que soit la taille de l'image.
 *
 * Une couleur dominante est une statistique : douze mille échantillons
 * répartis sur toute la surface la donnent aussi bien que les deux millions de
 * pixels d'un portrait, pour un cent-soixantième du travail.
 */
const ECHANTILLONS = 12_000;

/** Vingt-quatre bacs de quinze degrés : assez fin pour séparer l'ocre du brun. */
const BACS = 24;

/**
 * Les bornes de ce qui compte comme une couleur.
 *
 * Trois rejets, et chacun écarte quelque chose de précis : les ombres et les
 * noirs (`CLARTE_MIN`), les blancs brûlés et le fond de studio
 * (`CLARTE_MAX`), les gris (`SATURATION_MIN`). Les seuils portent sur
 * `max + min` plutôt que sur la clarté, qui en est la moitié : une
 * multiplication de moins par pixel, douze mille fois.
 */
const CLARTE_MIN = Math.round(2 * 255 * 0.12);
const CLARTE_MAX = Math.round(2 * 255 * 0.92);
const SATURATION_MIN = 0.15;

/**
 * La part d'échantillons colorés en dessous de laquelle on dit « pas de
 * couleur ».
 *
 * Un portrait au daguerréotype, un scan en noir et blanc, une gravure : il n'y
 * a rien à prendre, et inventer une teinte serait mentir. Cinq pour cent est
 * bas exprès — un visage sur fond blanc n'occupe qu'un sixième du cadre, et
 * doit suffire.
 */
const PART_MIN = 0.05;

const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json" },
  });

/** `#rrggbb`, minuscules — la forme que la contrainte SQL exige. */
const enHexa = (r: number, v: number, b: number) =>
  "#" +
  [r, v, b]
    .map((canal) => Math.max(0, Math.min(255, canal)).toString(16).padStart(2, "0"))
    .join("");

/**
 * La couleur dominante d'une image décodée, ou null s'il n'y en a pas.
 *
 * **Ce n'est pas une moyenne.** La moyenne d'une photographie est toujours la
 * même boue grise : le bleu du ciel et l'ocre du sol s'annulent. On fait donc
 * ce que fait Palette — un histogramme de teintes, pondéré par la saturation
 * pour qu'un pixel franc pèse plus qu'un pixel délavé, puis la moyenne des
 * seuls pixels du bac gagnant.
 *
 * Le bac gagnant est choisi avec ses deux voisins (`score`), pour deux
 * raisons : la teinte est circulaire, et un rouge réparti entre 358° et 2°
 * perdrait contre un bleu moins présent mais tombant tout entier dans un seul
 * bac ; et une couleur réelle s'étale toujours sur plusieurs degrés.
 */
function dominante(
  pixels: Uint8Array,
  largeur: number,
  hauteur: number,
): string | null {
  // Un pas sur les deux axes : la grille couvre toute l'image, là où lire les
  // N premiers pixels ne donnerait que la couleur du bord supérieur.
  const pas = Math.max(1, Math.floor(Math.sqrt((largeur * hauteur) / ECHANTILLONS)));

  const poids = new Float64Array(BACS);
  const sommeR = new Float64Array(BACS);
  const sommeV = new Float64Array(BACS);
  const sommeB = new Float64Array(BACS);
  const comptes = new Float64Array(BACS);
  let regardes = 0;
  let retenus = 0;

  for (let y = 0; y < hauteur; y += pas) {
    for (let x = 0; x < largeur; x += pas) {
      // Quatre octets par pixel : jpeg-js rend du RGBA, alpha toujours opaque.
      const i = (y * largeur + x) * 4;
      const r = pixels[i] ?? 0;
      const v = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      regardes += 1;

      const haut = r > v ? (r > b ? r : b) : v > b ? v : b;
      const bas = r < v ? (r < b ? r : b) : v < b ? v : b;
      const clarte = haut + bas;
      if (clarte < CLARTE_MIN || clarte > CLARTE_MAX) continue;

      const ecart = haut - bas;
      // La saturation HSL : l'écart rapporté à la place qu'il pouvait prendre
      // à cette clarté — moitié moindre aux extrêmes qu'au milieu.
      const saturation = ecart / (clarte <= 255 ? clarte : 510 - clarte);
      if (saturation < SATURATION_MIN) continue;
      retenus += 1;

      let teinte: number;
      if (haut === r) teinte = (v - b) / ecart;
      else if (haut === v) teinte = (b - r) / ecart + 2;
      else teinte = (r - v) / ecart + 4;
      // `+ 360` avant le modulo : la première branche rend un nombre négatif
      // pour tout ce qui tire vers le magenta.
      teinte = (teinte * 60 + 360) % 360;

      const bac = Math.min(BACS - 1, Math.floor((teinte * BACS) / 360));
      poids[bac] += saturation;
      sommeR[bac] += r;
      sommeV[bac] += v;
      sommeB[bac] += b;
      comptes[bac] += 1;
    }
  }

  if (retenus < regardes * PART_MIN) return null;

  let gagnant = 0;
  let meilleur = -1;
  for (let bac = 0; bac < BACS; bac += 1) {
    const avant = poids[(bac + BACS - 1) % BACS] ?? 0;
    const apres = poids[(bac + 1) % BACS] ?? 0;
    const score = (poids[bac] ?? 0) + (avant + apres) / 2;
    if (score > meilleur) {
      meilleur = score;
      gagnant = bac;
    }
  }

  let r = 0;
  let v = 0;
  let b = 0;
  let n = 0;
  for (const bac of [(gagnant + BACS - 1) % BACS, gagnant, (gagnant + 1) % BACS]) {
    r += sommeR[bac] ?? 0;
    v += sommeV[bac] ?? 0;
    b += sommeB[bac] ?? 0;
    n += comptes[bac] ?? 0;
  }
  if (n === 0) return null;

  return enHexa(Math.round(r / n), Math.round(v / n), Math.round(b / n));
}

/**
 * Ce qu'on a appris d'un fichier : une couleur, nulle s'il n'y en avait pas,
 * ou un souci s'il n'a pas pu être lu.
 *
 * La distinction compte, et c'est tout l'objet de `tinted_at` : une
 * photographie sans couleur est **réglée** et ne sera plus jamais regardée,
 * alors qu'un téléchargement qui échoue doit repasser au démarrage suivant.
 * Les confondre, c'est soit redécoder éternellement les portraits en noir et
 * blanc, soit renoncer pour de bon sur une panne de réseau d'une seconde.
 */
type Lecture = { couleur: string | null } | { souci: string };

async function lire(
  client: SupabaseClient,
  chemin: string,
): Promise<Lecture> {
  const { data, error } = await client.storage.from(SEAU).download(chemin);
  if (error || !data) {
    return { souci: `${chemin} illisible : ${error?.message ?? "vide"}` };
  }

  const octets = new Uint8Array(await data.arrayBuffer());
  // `shrink()` rend du JPEG pour tout ce qu'il arrive à préparer ; ce qui
  // passe à côté arrive tel que le téléphone l'a donné, HEIC compris, et
  // aucun décodeur ici ne saura le lire. C'est réglé, pas en panne.
  if (octets[0] !== 0xff || octets[1] !== 0xd8) return { couleur: null };

  try {
    const image = jpeg.decode(octets, {
      // Sans quoi jpeg-js alloue un `Buffer`, qui n'est pas global sous Deno.
      useTArray: true,
      formatAsRGBA: true,
      maxMemoryUsageInMB: 256,
    });
    return {
      couleur: dominante(
        image.data as unknown as Uint8Array,
        image.width,
        image.height,
      ),
    };
  } catch (cause) {
    // Un JPEG tronqué ou exotique : on ne le relira pas indéfiniment.
    console.warn(`${chemin} indécodable`, cause);
    return { couleur: null };
  }
}

Deno.serve(async (requete) => {
  if (requete.method !== "POST") {
    return repondre({ error: "POST seulement" }, 405);
  }

  const jeton = requete.headers.get("Authorization");
  if (!jeton) return repondre({ error: "non authentifié" }, 401);

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

  const corps = (await requete.json().catch(() => ({}))) as {
    character?: string;
  };

  // La RLS ne rend que les portraits de l'appelant : il n'y a rien à filtrer
  // de plus ici, et `position` d'abord pour que la première photographie —
  // la seule que l'arbre regarde — soit peinte en premier.
  let demande = client
    .from("character_photos")
    .select("id, storage_path")
    .is("tinted_at", null)
    .order("position")
    .limit(PLAFOND);
  if (typeof corps.character === "string") {
    demande = demande.eq("character_id", corps.character);
  }

  const { data, error } = await demande;
  if (error) return repondre({ error: error.message }, 400);

  const soucis: string[] = [];
  let peintes = 0;

  for (const photo of (data ?? []) as { id: string; storage_path: string }[]) {
    const lu = await lire(client, photo.storage_path);
    if ("souci" in lu) {
      soucis.push(lu.souci);
      continue;
    }
    const { error: echec } = await client
      .from("character_photos")
      .update({ tint: lu.couleur, tinted_at: new Date().toISOString() })
      .eq("id", photo.id);
    if (echec) soucis.push(`${photo.id} non écrite : ${echec.message}`);
    else peintes += 1;
  }

  // Ce qui reste, pour que l'appelant sache si le filet a du travail devant
  // lui — et pour qu'un test le voie sans interroger la base.
  const { count } = await client
    .from("character_photos")
    .select("id", { count: "exact", head: true })
    .is("tinted_at", null);

  return repondre({
    painted: peintes,
    remaining: count ?? 0,
    ...(soucis.length ? { soucis } : {}),
  });
});
