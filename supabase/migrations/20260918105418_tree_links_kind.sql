alter table public.tree_links
  add column kind text not null default 'descent';

alter table public.tree_links
  add constraint tree_links_kind_check check (kind in ('descent', 'couple'));

comment on column public.tree_links.kind is
  'descent: parent_id is the parent of child_id, one generation below. couple: the two are spouses on the same row, and parent_id is only the one that was touched first.';;
