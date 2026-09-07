import type {
  EventDraft,
  Folder,
  HistoricalDate,
  HistoricalEvent,
  Importance,
} from "./types";
import { decodeBase64 } from "../../lib/base64";
import { PHOTO_BUCKET, supabase } from "../../lib/supabase";

type EventRow = {
  id: string;
  title: string;
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
  event_photos: { storage_path: string; position: number }[];
};

const EVENT_COLUMNS = `
  id, title, description,
  start_year, start_month, start_day,
  end_year, end_month, end_day,
  longitude, latitude,
  event_folders ( folder_id, importance ),
  event_photos ( storage_path, position )
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
    photoUrls: [...row.event_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => publicUrl(photo.storage_path)),
  };
}

export async function fetchFolders(): Promise<Folder[]> {
  const { data, error } = await supabase()
    .from("folders")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFolder(name: string): Promise<Folder> {
  const { data, error } = await supabase()
    .from("folders")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  return data;
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

async function uploadPhotos(
  eventId: string,
  photos: EventDraft["photos"],
): Promise<void> {
  const storage = supabase().storage.from(PHOTO_BUCKET);

  const paths = await Promise.all(
    photos.map(async (photo, index) => {
      const extension = photo.mimeType.split("/")[1] ?? "jpg";
      const path = `${eventId}/${index}-${Date.now()}.${extension}`;
      const { error } = await storage.upload(path, decodeBase64(photo.base64), {
        contentType: photo.mimeType,
      });
      if (error) throw new Error(error.message);
      return path;
    }),
  );

  const { error } = await supabase()
    .from("event_photos")
    .insert(
      paths.map((path, position) => ({
        event_id: eventId,
        storage_path: path,
        position,
      })),
    );
  if (error) throw new Error(error.message);
}

export async function createEvent(draft: EventDraft): Promise<void> {
  const { data, error } = await supabase()
    .from("events")
    .insert({
      title: draft.title.trim(),
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

    if (draft.photos.length > 0) await uploadPhotos(eventId, draft.photos);
  } catch (cause) {
    // Rather than leave an event with no folders or half its photos, undo it —
    // the foreign keys cascade, so this cleans up whatever did land.
    await supabase().from("events").delete().eq("id", eventId);
    throw cause;
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase().from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
