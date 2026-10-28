import type {
  Cursor,
  Kind,
  Reason,
  Search,
  SharedThing,
  SharedThingDetail,
} from "./types";
import { bounds } from "./period";
import { lifespan } from "../events/lifespan";
import type { Importance, TreeBond } from "../events/types";
import { supabase } from "../../lib/supabase";

const BUCKET = "event-photos";

const publicUrl = (path: string): string =>
  supabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** How many rows a page of the catalogue holds. */
export const PAGE = 24;

/**
 * Which doors each kind knocks on.
 *
 * The three kinds live in three tables with three sets of columns, so the
 * database needs a function each; the application does not. Naming them here
 * is the whole of the difference between them as far as the panel is
 * concerned — and it is what stops the same six hundred lines being written
 * three times.
 */
const DOORS: Record<
  Kind,
  { search: string; whole: string; copy: string; alike: string | null }
> = {
  event: {
    search: "search_events",
    whole: "shared_event",
    copy: "copy_event",
    alike: "events_like",
  },
  character: {
    search: "search_characters",
    whole: "shared_character",
    copy: "copy_character",
    alike: "characters_like",
  },
  tree: {
    search: "search_trees",
    whole: "shared_tree",
    copy: "copy_tree",
    alike: null,
  },
};

/**
 * Lesquels des trois genres se rangent dans des classeurs.
 *
 * Les arbres n'en ont pas, et pas seulement par oubli : la colonne `folders`
 * n'existe que sur `events` et `characters`. Un arbre n'est pas un fait qu'on
 * classe par sujet, c'est une lignée — ce qui le situe est le nom qu'elle
 * porte. Le panneau n'ouvre donc pas de carte de classeurs sur l'onglet des
 * arbres, et surtout ne la demande pas à la base, qui n'aurait rien à rendre.
 */
export const FILES: Record<Kind, boolean> = {
  event: true,
  character: true,
  tree: false,
};

/**
 * Un classeur de la bibliothèque : son nom, son poids, sa dernière venue.
 *
 * Les deux nombres servent au tri de la carte — les plus utilisés, les plus
 * récents — et ils arrivent de la base parce qu'ils ne se comptent pas ici :
 * la collection les tire de ses propres événements, qu'elle a tous en
 * mémoire, et la bibliothèque n'en tient qu'une page.
 */
export type LibraryFolder = {
  name: string;
  uses: number;
  /** Quand on s'en est servi pour la dernière fois, ou null. */
  lastAt: string | null;
};

/** Which photo bucket a kind's pictures live in — one, so far. */
type Row = {
  id: string;
  title: string;
  kind: string;
  note: string | null;
  start_year: number | null;
  start_month: number | null;
  start_day: number | null;
  start_approx: boolean;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  end_approx: boolean;
  longitude: number | null;
  latitude: number | null;
  cover_path: string | null;
  stars: number;
  mine: boolean;
  copied: boolean;
  reported: boolean;
  rank: number;
  shape?: unknown;
};

const toDate = (
  year: number | null,
  month: number | null,
  day: number | null,
  approximate: boolean,
) =>
  year === null
    ? null
    : {
        year,
        ...(month === null ? {} : { month }),
        ...(day === null ? {} : { day }),
        ...(approximate ? { approximate: true } : {}),
      };

function toThing(row: Row): SharedThing {
  return {
    id: row.id,
    title: row.title,
    badge: row.kind,
    note: row.note,
    start: toDate(
      row.start_year,
      row.start_month,
      row.start_day,
      row.start_approx,
    ),
    end: toDate(row.end_year, row.end_month, row.end_day, row.end_approx),
    longitude: row.longitude,
    latitude: row.latitude,
    cover: row.cover_path === null ? null : publicUrl(row.cover_path),
    stars: row.stars,
    mine: row.mine,
    copied: row.copied,
    reported: row.reported,
    rank: row.rank,
    ...(row.shape === undefined || row.shape === null
      ? {}
      : { shape: row.shape }),
  };
}

/**
 * One page of the catalogue.
 *
 * Everything the search decides happens behind the door, which is a way
 * through row-level security rather than a hole in it — see `search_events`
 * for the reasoning. Nothing here may be trusted to filter: this only asks.
 */
export async function search(
  kind: Kind,
  wanted: Search,
  after: Cursor,
): Promise<SharedThing[]> {
  const { data, error } = await supabase().rpc(DOORS[kind].search, {
    words: wanted.words.trim() === "" ? null : wanted.words.trim(),
    // A date and a width become the two bounds the door expects, on the same
    // continuous axis the database indexes.
    ...bounds(wanted.at, wanted.span),
    near_lon: wanted.near?.longitude ?? null,
    near_lat: wanted.near?.latitude ?? null,
    within_m: wanted.near ? wanted.withinMetres : null,
    /**
     * Les classeurs retenus — et **la clé absente** pour qui n'en a pas.
     *
     * Non pas `filed: null`, ce qui serait l'air de rien : PostgREST choisit
     * la fonction d'après l'ensemble des clés envoyées, et `search_trees`
     * n'a pas ce paramètre. Une clé de trop ne vaut donc pas un argument
     * ignoré, elle vaut « aucune fonction de ce nom ne prend ces
     * arguments » — soit l'onglet des arbres en panne.
     *
     * Null plutôt qu'un tableau vide pour les deux autres. La porte traite
     * les deux pareil — voir `search_events` —, mais dire « rien » quand il
     * n'y a rien à dire évite d'envoyer un tableau vide par-dessus le réseau
     * à chaque frappe.
     */
    ...(FILES[kind]
      ? { filed: wanted.folders.length === 0 ? null : wanted.folders }
      : {}),
    sort: wanted.sort,
    page_size: PAGE,
    after_rank: after?.rank ?? null,
    after_id: after?.id ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toThing);
}

/**
 * Tous les classeurs sous lesquels la bibliothèque range ce genre.
 *
 * Demandée une fois à l'ouverture du panneau et non à chaque frappe : ce sont
 * les sujets dont la bibliothèque parle, et ils ne changent pas parce qu'on
 * tape un mot. Le tamis du champ de la carte travaille donc sur cette liste,
 * en mémoire.
 *
 * Les gardes sont celles de `search_events`, posées dans la fonction : on ne
 * relève que les classeurs de ce qui est visible. Un nom de classeur dit de
 * quoi quelqu'un parle, donc il ne doit pas échapper à un blocage.
 */
export async function folders(kind: Kind): Promise<LibraryFolder[]> {
  if (!FILES[kind]) return [];
  const { data, error } = await supabase().rpc("library_folders", { kind });
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as { name: string; uses: number; last_at: string | null }[]
  ).map((row) => ({
    name: row.name,
    uses: row.uses,
    lastAt: row.last_at,
  }));
}

/** One shared thing, whole, for the card that shows it before it is taken. */
export async function fetchWhole(
  kind: Kind,
  id: string,
): Promise<SharedThingDetail | null> {
  const { data, error } = await supabase().rpc(DOORS[kind].whole, {
    wanted: id,
  });
  if (error) throw new Error(error.message);
  if (data === null) return null;

  const whole = data as Row & {
    type: string;
    description: string | null;
    photos: { path: string; source: string | null }[];
    cast: string[];
    folders: { name: string; thing: Row | null }[];
    filing?: string[];
    held?: Row[];
    shape?: unknown;
    members?: {
      id: string;
      character_id: string | null;
      text: string | null;
      width: number;
      generation: number;
      position: number;
      importance: Importance;
    }[];
    links?: { from: string; to: string; kind: TreeBond }[];
    people?: {
      id: string;
      name: string;
      photo: string | null;
      tint: string | null;
      birth_year: number | null;
      birth_month: number | null;
      birth_day: number | null;
      birth_approx: boolean;
      death_year: number | null;
      death_month: number | null;
      death_day: number | null;
      death_approx: boolean;
    }[];
  };
  return {
    ...toThing({ ...whole, kind: whole.type, cover_path: null, rank: 0 }),
    cover: whole.photos[0] ? publicUrl(whole.photos[0].path) : null,
    description: whole.description,
    photos: whole.photos.map((photo) => ({
      url: publicUrl(photo.path),
      source: photo.source,
    })),
    cast: whole.cast,
    folders: whole.folders.map((filed) => ({
      name: filed.name,
      thing: filed.thing === null ? null : toThing(filed.thing),
    })),
    /* Facultatif à la lecture : un client plus vieux que la fonction verrait
       la clé manquer plutôt que de tomber. */
    filing: whole.filing ?? [],
    held: (whole.held ?? []).map(toThing),
    shape: whole.shape ?? null,
    // A genealogy arrives flat and is reassembled here, dates included: the
    // canvas wants a line to print, not two half-known dates to format.
    drawing:
      whole.members === undefined
        ? null
        : {
            members: whole.members.map((one) => ({
              id: one.id,
              characterId: one.character_id,
              text: one.text,
              width: one.width,
              generation: one.generation,
              position: one.position,
              importance: one.importance,
            })),
            links: whole.links ?? [],
            people: (whole.people ?? []).map((one) => ({
              id: one.id,
              name: one.name,
              photo: one.photo === null ? null : publicUrl(one.photo),
              // Somebody else's tree is drawn by the same `TreeFace` as one's
              // own, so it is painted from the same colours — without this the
              // catalogue would stay orange while the builder went colourful,
              // and the two drawings would have started to drift.
              tint: one.tint,
              dates: lifespan({
                birth: toDate(
                  one.birth_year,
                  one.birth_month,
                  one.birth_day,
                  one.birth_approx,
                ),
                death: toDate(
                  one.death_year,
                  one.death_month,
                  one.death_day,
                  one.death_approx,
                ),
              } as Parameters<typeof lifespan>[0]),
            })),
          },
  };
}

/**
 * Takes a copy, and makes its pictures the reader's own.
 *
 * The rows are written behind the door, in one transaction. The files cannot
 * be: storage is not reachable from SQL. So the copy arrives pointing at the
 * author's files, and this walks them over into the reader's own folder —
 * without which a copy would go blank the day its author left.
 *
 * Best effort, on purpose. A picture that refuses to be duplicated leaves the
 * row pointing where it pointed, which still works; failing the whole copy
 * over one image would be a worse answer than a borrowed photograph.
 */
/**
 * Prendre copie d'une contribution.
 *
 * Un seul appel, côté serveur. Cela tenait dans cette fonction, en deux temps
 * — la porte SQL puis la duplication des fichiers — et les deux temps étaient
 * séparés par le réseau : un téléphone mis en arrière-plan entre eux laissait
 * une copie dont les photos pointaient encore les fichiers de l'auteur, et
 * rien ne réessayait jamais. Mesuré : une ligne sur soixante-quinze.
 *
 * L'Edge Function `copy` fait les deux du même côté, avec notre propre jeton
 * et aucun privilège de plus. Voir `supabase/functions/copy/index.ts`.
 */
export async function copy(kind: Kind, id: string): Promise<string> {
  const { data, error } = await supabase().functions.invoke("copy", {
    body: { kind, id },
  });
  if (error) throw new Error(error.message);

  const said = data as { id?: string; error?: string; soucis?: string[] };
  if (said.error) throw new Error(said.error);
  if (!said.id) throw new Error("La copie n'a pas abouti.");

  // La copie existe, mais un fichier n'a pas suivi. On ne la défait pas pour
  // autant — et on ne se tait pas non plus, ce qui était le défaut d'avant.
  // `mend` repassera au prochain démarrage.
  if (said.soucis?.length) {
    console.warn("Copie incomplète, images à rapatrier :", said.soucis);
  }
  return said.id;
}

/**
 * Rapatrier les fichiers restés chez leur auteur.
 *
 * Le filet, appelé une fois au démarrage. Il reste nécessaire même avec une
 * copie désormais atomique : la couche de stockage peut toujours refuser une
 * duplication, et il existe des lignes antérieures à l'Edge Function.
 *
 * Silencieux par construction : s'il échoue, il n'y a rien à dire au lecteur
 * qui n'a rien demandé, et il repassera au démarrage suivant.
 */
export async function mend(): Promise<number> {
  try {
    const { data, error } = await supabase().functions.invoke("copy", {
      body: { action: "mend" },
    });
    if (error) return 0;
    return (data as { mended?: number }).mended ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Things that look like the one being written, asked once its year is known.
 *
 * The year is what makes this worth showing at all, and the thresholds differ
 * by kind for reasons that were measured rather than felt — see `events_like`
 * and `characters_like`, which carry the numbers.
 */
export async function alike(
  kind: Kind,
  title: string,
  year: number,
  approximate: boolean,
): Promise<SharedThing[]> {
  const door = DOORS[kind].alike;
  if (door === null) return [];
  const { data, error } = await supabase().rpc(door, {
    said: title.trim(),
    at_year: year,
    fuzzy: approximate,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toThing);
}

/** Une des miennes qui ressemble à ce que je m'apprête à copier. */
export type Mine = {
  id: string;
  title: string;
  year: number;
  approximate: boolean;
  /** Écrite de ma main, par opposition à prise ailleurs. */
  written: boolean;
};

/**
 * Ce que j'ai déjà qui ressemble à l'entrée que je m'apprête à prendre.
 *
 * **Le miroir d'`alike`**, et la même question posée dans l'autre sens :
 * celle-là cherche dans la bibliothèque ce qui ressemble à ce qu'on écrit,
 * celle-ci cherche dans sa propre collection ce qui ressemble à ce qu'on va
 * copier. Mêmes seuils, mesurés une fois pour les deux.
 *
 * Les arbres n'en ont pas, comme ils n'ont pas d'`alike` : un arbre n'a pas
 * de titre à comparer, seulement un nom et des gens dedans.
 */
export async function mineAlike(
  kind: Kind,
  title: string,
  year: number,
  approximate: boolean,
): Promise<Mine[]> {
  if (DOORS[kind].alike === null) return [];
  const { data, error } = await supabase().rpc(
    kind === "event" ? "my_events_like" : "my_characters_like",
    { said: title.trim(), at_year: year, fuzzy: approximate },
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as Mine[];
}

/**
 * Says that something should not be in the community.
 *
 * Adressé au conservateur, et à personne d'autre : lui seul publie, donc lui
 * seul peut s'être trompé. Le signalement n'est plus un rempart mais une
 * assurance contre cette erreur-là. Assez de voix et la chose quitte le
 * catalogue d'elle-même ; voir `withhold_when_reported`.
 */
export async function report(
  kind: Kind,
  id: string,
  reason: Reason,
  said: string,
): Promise<void> {
  /**
   * Par la fonction de bord, et non plus droit sur la porte SQL.
   *
   * `report_it` ne faisait qu'écrire une ligne, et elle y restait : rien ne
   * prévenait personne, alors que la feuille de signalement promet qu'on
   * regardera sous 72 heures. La fonction `report` dépose puis expédie un
   * avis, exactement comme `contact` — voir `supabase/functions/report`.
   *
   * L'échec d'expédition n'en est pas un ici : la ligne est écrite, et c'est
   * elle qui compte. Le lecteur a dit ce qu'il avait à dire.
   */
  const { data, error } = await supabase().functions.invoke("report", {
    body: { kind, id, reason, said: said.trim() },
  });
  if (error) throw new Error(error.message);

  const answer = data as { garde?: boolean; expedie?: boolean };
  if (!answer.garde) throw new Error("Signalement non enregistré.");
  if (!answer.expedie) {
    // Gardé sans être annoncé : le lecteur n'a rien à en faire, nous si.
    // La raison est dans `reports.failure`.
    console.warn("Signalement gardé sans avis — voir reports.failure.");
  }
}

/**
 * Le blocage a disparu avec les signatures.
 *
 * Il existait pour qu'un lecteur puisse dire « ne me montre plus jamais le
 * travail de cette personne ». La bibliothèque étant relue par une seule main
 * avant d'être publiée, il n'y a plus personne à bloquer : ce qu'il fallait
 * écarter l'a été en amont. La table `blocks` et ses deux fonctions SQL
 * partiront au dernier passage de ménage, quand la surface sera minimale.
 */
