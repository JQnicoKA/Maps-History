import type {
  Character,
  CharacterDraft,
  EventDraft,
  Folder,
  PickedPhoto,
  HistoricalDate,
  HistoricalEvent,
  StoredPhoto,
  EventType,
  Importance,
} from "./types";
import { decodeBase64 } from "../../lib/base64";
import { PHOTO_BUCKET, supabase } from "../../lib/supabase";

type EventRow = {
  id: string;
  title: string;
  type: EventType;
  description: string | null;
  start_year: number;
  start_month: number | null;
  start_day: number | null;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  longitude: number;
  latitude: number;
  event_folders: { folder_id: string; importance: Importance }[];
  event_characters: { character_id: string }[];
  event_photos: {
    id: string;
    storage_path: string;
    position: number;
    source: string | null;
  }[];
};

const EVENT_COLUMNS = `
  id, title, type, description,
  start_year, start_month, start_day,
  end_year, end_month, end_day,
  longitude, latitude,
  event_folders ( folder_id, importance ),
  event_characters ( character_id ),
  event_photos ( id, storage_path, position, source )
`;

function toDate(
  year: number,
  month: number | null,
  day: number | null,
): HistoricalDate {
  return {
    year,
    ...(month === null ? {} : { month }),
    ...(day === null ? {} : { day }),
  };
}

function publicUrl(path: string): string {
  return supabase().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function toEvent(row: EventRow): HistoricalEvent {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    description: row.description,
    start: toDate(row.start_year, row.start_month, row.start_day),
    end:
      row.end_year === null
        ? null
        : toDate(row.end_year, row.end_month, row.end_day),
    longitude: row.longitude,
    latitude: row.latitude,
    folders: row.event_folders.map((link) => ({
      folderId: link.folder_id,
      importance: link.importance,
    })),
    characters: row.event_characters.map((link) => link.character_id),
    photos: [...row.event_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        path: photo.storage_path,
        url: publicUrl(photo.storage_path),
        source: photo.source,
      })),
  };
}

type FolderRow = { id: string; name: string; photo_path: string | null };

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    photo:
      row.photo_path === null
        ? null
        : { path: row.photo_path, url: publicUrl(row.photo_path) },
  };
}

const FOLDER_COLUMNS = "id, name, photo_path";

export async function fetchFolders(): Promise<Folder[]> {
  const { data, error } = await supabase()
    .from("folders")
    .select(FOLDER_COLUMNS)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as FolderRow[]).map(toFolder);
}

export async function createFolder(name: string): Promise<Folder> {
  const { data, error } = await supabase()
    .from("folders")
    .insert({ name: name.trim() })
    .select(FOLDER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toFolder(data as FolderRow);
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const { data, error } = await supabase()
    .from("folders")
    .update({ name: name.trim() })
    .eq("id", id)
    .select(FOLDER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toFolder(data as FolderRow);
}

/**
 * Removes a folder.
 *
 * `event_folders.folder_id` cascades, so the events keep their existence and
 * lose only this filing — which is what the reader is being asked to confirm.
 *
 * The row goes first and the picture after, best effort: an orphaned object
 * costs a few kilobytes, a row pointing at nothing costs a broken marker.
 */
export async function deleteFolder(folder: Folder): Promise<void> {
  const client = supabase();
  const { error } = await client.from("folders").delete().eq("id", folder.id);
  if (error) throw new Error(error.message);

  if (folder.photo) {
    await client.storage.from(PHOTO_BUCKET).remove([folder.photo.path]);
  }
}

/**
 * Sets or clears a folder's cover picture.
 *
 * The old object is deleted only once the row points at the new one: an
 * orphaned file costs a few kilobytes, a row pointing at nothing costs the
 * reader a broken marker.
 */
export async function setFolderPhoto(
  folder: Folder,
  picked: PickedPhoto | null,
): Promise<Folder> {
  const client = supabase();
  let path: string | null = null;

  if (picked) {
    const extension = picked.mimeType.split("/")[1] ?? "jpg";
    path = `folders/${folder.id}/${Date.now()}.${extension}`;
    const { error } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, decodeBase64(picked.base64), {
        contentType: picked.mimeType,
      });
    if (error) throw new Error(error.message);
  }

  const { data, error } = await client
    .from("folders")
    .update({ photo_path: path })
    .eq("id", folder.id)
    .select(FOLDER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  if (folder.photo) {
    await client.storage.from(PHOTO_BUCKET).remove([folder.photo.path]);
  }
  return toFolder(data as FolderRow);
}

export async function fetchEvents(): Promise<HistoricalEvent[]> {
  const { data, error } = await supabase()
    .from("events")
    .select(EVENT_COLUMNS)
    // Nulls first so a bare year sorts before any dated event of that year.
    .order("start_year")
    .order("start_month", { nullsFirst: true })
    .order("start_day", { nullsFirst: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map(toEvent);
}

/**
 * What a set of pictures belongs to. Events and characters keep theirs in the
 * same bucket and the same shape; only the table, the pointing column and the
 * path differ.
 */
type PhotoOwner = {
  table: "event_photos" | "character_photos";
  column: "event_id" | "character_id";
  id: string;
  /** Prepended to the storage path. Empty for events, which came first. */
  prefix: string;
};

async function uploadPhotos(
  owner: PhotoOwner,
  photos: PickedPhoto[],
  startAt = 0,
): Promise<void> {
  const storage = supabase().storage.from(PHOTO_BUCKET);

  const paths = await Promise.all(
    photos.map(async (photo, index) => {
      const extension = photo.mimeType.split("/")[1] ?? "jpg";
      const path = `${owner.prefix}${owner.id}/${startAt + index}-${Date.now()}.${extension}`;
      const { error } = await storage.upload(path, decodeBase64(photo.base64), {
        contentType: photo.mimeType,
      });
      if (error) throw new Error(error.message);
      return { path, source: photo.source.trim() || null };
    }),
  );

  const { error } = await supabase()
    .from(owner.table)
    .insert(
      paths.map((photo, position) => ({
        [owner.column]: owner.id,
        storage_path: photo.path,
        position: startAt + position,
        source: photo.source,
      })),
    );
  if (error) throw new Error(error.message);
}

/**
 * Brings a stored set of pictures in line with what the reader left in the
 * form: the ones dropped go from the table and the bucket, the ones staying
 * have their source written back, the new ones are uploaded after them.
 */
async function syncPhotos(
  owner: PhotoOwner,
  added: PickedPhoto[],
  kept: StoredPhoto[],
  dropped: StoredPhoto[],
): Promise<void> {
  const client = supabase();

  if (dropped.length > 0) {
    const { error } = await client
      .from(owner.table)
      .delete()
      .in("id", dropped.map((photo) => photo.id));
    if (error) throw new Error(error.message);

    // Best effort: an orphaned object costs storage, a failed save costs work.
    await client.storage
      .from(PHOTO_BUCKET)
      .remove(dropped.map((photo) => photo.path));
  }

  // Sources are editable on photos that are staying.
  for (const photo of kept) {
    const { error } = await client
      .from(owner.table)
      .update({ source: photo.source?.trim() || null })
      .eq("id", photo.id);
    if (error) throw new Error(error.message);
  }

  if (added.length > 0) await uploadPhotos(owner, added, kept.length);
}

const photosOf = (eventId: string): PhotoOwner => ({
  table: "event_photos",
  column: "event_id",
  id: eventId,
  prefix: "",
});

export async function createEvent(draft: EventDraft): Promise<void> {
  const { data, error } = await supabase()
    .from("events")
    .insert({
      title: draft.title.trim(),
      type: draft.type,
      description: draft.description.trim() || null,
      start_year: draft.start.year,
      start_month: draft.start.month ?? null,
      start_day: draft.start.day ?? null,
      end_year: draft.end?.year ?? null,
      end_month: draft.end?.month ?? null,
      end_day: draft.end?.day ?? null,
      longitude: draft.longitude,
      latitude: draft.latitude,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const eventId: string = data.id;

  try {
    if (draft.folders.length > 0) {
      const { error: linkError } = await supabase()
        .from("event_folders")
        .insert(
          draft.folders.map((link) => ({
            event_id: eventId,
            folder_id: link.folderId,
            importance: link.importance,
          })),
        );
      if (linkError) throw new Error(linkError.message);
    }

    if (draft.characters.length > 0) {
      const { error: castError } = await supabase()
        .from("event_characters")
        .insert(
          draft.characters.map((characterId) => ({
            event_id: eventId,
            character_id: characterId,
          })),
        );
      if (castError) throw new Error(castError.message);
    }

    if (draft.photos.length > 0) {
      await uploadPhotos(photosOf(eventId), draft.photos);
    }
  } catch (cause) {
    // Rather than leave an event with no folders or half its photos, undo it —
    // the foreign keys cascade, so this cleans up whatever did land.
    await supabase().from("events").delete().eq("id", eventId);
    throw cause;
  }
}

function toRow(draft: EventDraft) {
  return {
    title: draft.title.trim(),
    type: draft.type,
    description: draft.description.trim() || null,
    start_year: draft.start.year,
    start_month: draft.start.month ?? null,
    start_day: draft.start.day ?? null,
    end_year: draft.end?.year ?? null,
    end_month: draft.end?.month ?? null,
    end_day: draft.end?.day ?? null,
    longitude: draft.longitude,
    latitude: draft.latitude,
  };
}

/**
 * Saves an edit. Folder links are replaced wholesale rather than diffed — the
 * set is tiny and a replace cannot drift out of sync. Photos the reader dropped
 * are removed from both the table and the bucket.
 */
export async function updateEvent(
  id: string,
  draft: EventDraft,
  keptPhotos: StoredPhoto[],
  droppedPhotos: StoredPhoto[],
): Promise<void> {
  const client = supabase();

  const { error } = await client.from("events").update(toRow(draft)).eq("id", id);
  if (error) throw new Error(error.message);

  const { error: unlinkError } = await client
    .from("event_folders")
    .delete()
    .eq("event_id", id);
  if (unlinkError) throw new Error(unlinkError.message);

  if (draft.folders.length > 0) {
    const { error: linkError } = await client.from("event_folders").insert(
      draft.folders.map((link) => ({
        event_id: id,
        folder_id: link.folderId,
        importance: link.importance,
      })),
    );
    if (linkError) throw new Error(linkError.message);
  }

  const { error: uncastError } = await client
    .from("event_characters")
    .delete()
    .eq("event_id", id);
  if (uncastError) throw new Error(uncastError.message);

  if (draft.characters.length > 0) {
    const { error: castError } = await client.from("event_characters").insert(
      draft.characters.map((characterId) => ({
        event_id: id,
        character_id: characterId,
      })),
    );
    if (castError) throw new Error(castError.message);
  }

  await syncPhotos(photosOf(id), draft.photos, keptPhotos, droppedPhotos);
}

type CharacterRow = {
  id: string;
  name: string;
  bio: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  character_photos: {
    id: string;
    storage_path: string;
    position: number;
    source: string | null;
  }[];
};

const CHARACTER_COLUMNS = `
  id, name, bio,
  birth_year, birth_month, birth_day,
  death_year, death_month, death_day,
  character_photos ( id, storage_path, position, source )
`;

/** Null when the year is missing: a month without a year is not a date. */
function toOptionalDate(
  year: number | null,
  month: number | null,
  day: number | null,
): HistoricalDate | null {
  return year === null ? null : toDate(year, month, day);
}

function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    birth: toOptionalDate(row.birth_year, row.birth_month, row.birth_day),
    death: toOptionalDate(row.death_year, row.death_month, row.death_day),
    photos: [...row.character_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        path: photo.storage_path,
        url: publicUrl(photo.storage_path),
        source: photo.source,
      })),
  };
}

const portraitsOf = (characterId: string): PhotoOwner => ({
  table: "character_photos",
  column: "character_id",
  id: characterId,
  prefix: "characters/",
});

function characterRow(draft: CharacterDraft) {
  return {
    name: draft.name.trim(),
    bio: draft.bio.trim() || null,
    birth_year: draft.birth?.year ?? null,
    birth_month: draft.birth?.month ?? null,
    birth_day: draft.birth?.day ?? null,
    death_year: draft.death?.year ?? null,
    death_month: draft.death?.month ?? null,
    death_day: draft.death?.day ?? null,
  };
}

export async function fetchCharacters(): Promise<Character[]> {
  const { data, error } = await supabase()
    .from("characters")
    .select(CHARACTER_COLUMNS)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as CharacterRow[]).map(toCharacter);
}

export async function createCharacter(
  draft: CharacterDraft,
): Promise<Character> {
  const { data, error } = await supabase()
    .from("characters")
    .insert(characterRow(draft))
    .select(CHARACTER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  const created = toCharacter(data as CharacterRow);
  if (draft.photos.length === 0) return created;

  try {
    await uploadPhotos(portraitsOf(created.id), draft.photos);
  } catch (cause) {
    // Same rule as an event: rather than leave someone with half a face, undo
    // the whole thing. The photo rows cascade with the row.
    await supabase().from("characters").delete().eq("id", created.id);
    throw cause;
  }
  return { ...created, photos: [] };
}

export async function updateCharacter(
  id: string,
  draft: CharacterDraft,
  keptPhotos: StoredPhoto[],
  droppedPhotos: StoredPhoto[],
): Promise<void> {
  const { error } = await supabase()
    .from("characters")
    .update(characterRow(draft))
    .eq("id", id);
  if (error) throw new Error(error.message);

  await syncPhotos(portraitsOf(id), draft.photos, keptPhotos, droppedPhotos);
}

/**
 * Removes a character.
 *
 * `event_characters.character_id` cascades, so the events survive and lose only
 * this person from their cast — which is what the reader confirms. The row goes
 * first and the pictures after, best effort.
 */
export async function deleteCharacter(character: Character): Promise<void> {
  const client = supabase();
  const { error } = await client
    .from("characters")
    .delete()
    .eq("id", character.id);
  if (error) throw new Error(error.message);

  if (character.photos.length > 0) {
    await client.storage
      .from(PHOTO_BUCKET)
      .remove(character.photos.map((photo) => photo.path));
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase().from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
