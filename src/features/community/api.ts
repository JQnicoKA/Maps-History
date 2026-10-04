import type {
  Blocked,
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
 * The five kinds live in five tables with five sets of columns, so the
 * database needs a function each; the application does not. Naming them here
 * is the whole of the difference between them as far as the panel is
 * concerned — and it is what stops the same six hundred lines being written
 * five times.
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
  folder: {
    search: "search_folders",
    whole: "shared_folder",
    copy: "copy_folder",
    // None: a classeur has no date of its own, and the year is what makes a
    // duplicate warning worth showing — see `events_like`. Prevention for
    // classeurs is the search slot in the list, not a warning while typing.
    alike: null,
  },
  tree: {
    search: "search_trees",
    whole: "shared_tree",
    copy: "copy_tree",
    alike: null,
  },
  territory: {
    search: "search_territories",
    whole: "shared_territory",
    copy: "copy_territory",
    alike: "territories_like",
  },
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
  author: string;
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
    author: row.author,
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
    sort: wanted.sort,
    page_size: PAGE,
    after_rank: after?.rank ?? null,
    after_id: after?.id ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toThing);
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
    held?: Row[];
    shape?: unknown;
    members?: {
      id: string;
      character_id: string;
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

/**
 * Says that something should not be in the community.
 *
 * Nothing is told to its author, and nobody but the reporter can see that
 * they reported it — a report is addressed to whoever keeps the community,
 * not to the person reported. Enough of them and the thing leaves everybody's
 * catalogue on its own; see `withhold_when_reported`.
 */
export async function report(
  kind: Kind,
  id: string,
  reason: Reason,
  said: string,
): Promise<void> {
  const { error } = await supabase().rpc("report_it", {
    kind,
    source_id: id,
    reason,
    said: said.trim() === "" ? null : said.trim(),
  });
  if (error) throw new Error(error.message);
}

/**
 * Stops seeing somebody, and stops them seeing you.
 *
 * Asked for by pointing at the work rather than at the person: the catalogue
 * hands out pseudonyms and no identifiers, and it should stay that way.
 */
export async function blockAuthorOf(kind: Kind, id: string): Promise<void> {
  const { error } = await supabase().rpc("block_author", {
    kind,
    source_id: id,
  });
  if (error) throw new Error(error.message);
}

export async function blockedPeople(): Promise<Blocked[]> {
  const { data, error } = await supabase().rpc("blocked_people");
  if (error) throw new Error(error.message);
  return (data ?? []) as Blocked[];
}

export async function unblock(id: string): Promise<void> {
  const { error } = await supabase().from("blocks").delete().eq("blocked", id);
  if (error) throw new Error(error.message);
}
