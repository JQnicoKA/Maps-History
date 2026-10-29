-- Le refus ne change pas, sa raison si. Une copie ne devient pas une entrée —
-- ce serait le doublon que tout ceci évite — mais elle n'est plus « sans rien
-- à offrir » : retouchée, elle peut servir à corriger celle dont elle vient.
do $$
declare
  corps text;
begin
  select pg_get_functiondef(p.oid) into corps
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'judge';

  corps := replace(
    corps,
    'C''''est une copie : la bibliothèque tient déjà l''''entrée dont elle vient.',
    'C''''est une copie : elle peut inspirer une correction de l''''entrée dont elle vient, mais pas en devenir une seconde.'
  );

  if corps not like '%pas en devenir une seconde%' then
    raise exception 'Le message visé n''a pas été trouvé dans judge().';
  end if;

  execute corps;
end $$;;
