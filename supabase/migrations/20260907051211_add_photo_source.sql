-- Where the picture came from: a URL, or a free-text reference
-- ("Bibliothèque nationale, ms. fr. 2813"). Optional.
alter table public.event_photos add column source text;;
