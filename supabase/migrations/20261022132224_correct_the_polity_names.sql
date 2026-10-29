-- Les corrections de nom, appliquées.
--
-- Chacune est enregistrée dans `polity_corrections` avec sa raison : le
-- dictionnaire `polity_french` dit comment on est passé de l'anglais au
-- français, il ne dit pas ce qu'on a corrigé ensuite.
--
-- Le retour en arrière complet passe désormais par `polities_english_names`,
-- qui restitue par identifiant et se moque de ces renommages ; le chemin par
-- le dictionnaire, lui, ne retrouvera plus les noms corrigés.
do $$
declare
  correction record;
  combien integer;
begin
  for correction in
    select * from (values
      -- §4 — titres faux
      ('Comté de Brabant','Duché de Brabant','Le Brabant est un duché depuis 1183'),
      ('Comté de Béarn','Vicomté de Béarn','Le Béarn était une vicomté'),
      ('Dynastie du Qatar','Dynastie Al Thani','La dynastie régnante porte un nom'),
      ('Dynastie bahranide','Dynasties du Bahreïn','« Bahranide » est un nom inventé'),
      ('République des Ahis','Confrérie des Ahis','« République » est une facilité d''historien'),

      -- §5 — coquilles
      ('Principauté de Regensberg','Principauté de Ratisbonne','Regensburg, non Regensberg'),
      ('Principauté de Schwarzbourg-Sonderhausen','Principauté de Schwarzbourg-Sondershausen','Sondershausen'),
      ('Royaume de Pajana','Royaume de Pajang','Pajang, royaume javanais ; l''ancre le confirme'),
      ('Han','Han (Royaumes combattants)','Distingué de « Hán » autrement que par un accent'),
      ('Hán','Han de Zheng Chang','Distingué de « Han » autrement que par un accent'),

      -- §8 — doublons et fusions
      ('République fédérative d''Allemagne','République fédérale d''Allemagne','Même pays, et « fédérative » est fautif'),
      ('Royaume de Monaco','Principauté de Monaco','Monaco n''a jamais été un royaume'),
      ('Monarchistes mexicains','Second Empire mexicain','Le même État, nommé deux fois'),
      ('Parti Baas arabe socialiste','Syrie baasiste','Le même État, nommé deux fois'),
      ('Norvège-Danemark','Union de Magnus le Bon','Nommée à l''envers de Danemark-Norvège'),

      -- §1 — une personne pour un territoire
      ('Li Zicheng','Dynastie Shun','L''État qu''il a fondé porte un nom'),
      ('Wihtgar','Royaume de l''île de Wight','Un chef du VIe siècle donné à 168 ans d''histoire'),
      ('Sœurs Trưng','Royaume des sœurs Trưng','Deux personnes pour un royaume'),
      ('Perdiccas','Satrapies de Perdiccas','Le régent, non l''État'),
      ('Polyperchon','Satrapies de Polyperchon','Le régent, non l''État'),
      ('Laomédon','Satrapie de Syrie','Le satrape, non la satrapie'),
      ('Cao Cao','Domaine de Cao Cao','Le seigneur de guerre, non son domaine'),
      ('Gao Kaidao','Yan de Gao Kaidao','Le chef, non l''État de Yan'),
      ('Ânkhouennefer','Révolte thébaine','Le pharaon rebelle, non la révolte'),

      -- §2 — un événement pour un territoire
      ('Révolte de Nalyvaïko','Cosaques de Nalyvaïko','Une révolte, non un État'),
      ('Révolte des Panthay','Sultanat de Dali','La révolte a fondé un État réel'),
      ('Restauration de Kenmu','Japon de la restauration de Kenmu','Un épisode, non un pays'),
      ('Bataillon sacré de Thèbes','Hégémonie thébaine','Un corps d''infanterie pour un territoire'),
      ('Occupation de Halytch-Volhynie','Halytch-Volhynie','« Occupation » sans dire par qui'),

      -- §3 — un parti, une armée ou un peuple
      ('Communistes chinois','République soviétique du Jiangxi','Le territoire tenu portait un nom'),
      ('Parti communiste chinois','Zones soviétiques chinoises','Un parti, non un territoire'),
      ('Coalition anti-Kuomintang','Coalition des plaines centrales','Le nom de la guerre qu''elle a menée'),
      ('Kuomintang','Chine nationaliste','Un parti, non un État'),
      ('Khmers rouges','Kampuchéa démocratique','L''État portait un nom'),
      ('Taliban','Émirat islamique d''Afghanistan','L''État portait un nom'),
      ('France libre','Afrique-Équatoriale française libre','Un mouvement ; la carte montre l''AEF ralliée'),
      ('Partisans yougoslaves','Yougoslavie des partisans','Un mouvement, non un territoire'),
      ('Nationalistes espagnols','Zone nationaliste','Un camp de guerre civile'),
      ('Maderistes','Zone maderiste','Un camp de la révolution mexicaine'),
      ('Communistes cubains','Zone rebelle cubaine','Un camp'),
      ('Nationalistes cubains','Cuba insurgée','Un camp de la guerre d''indépendance'),
      ('Huguenots','Places de sûreté protestantes','Un groupe confessionnel ; les places avaient un statut'),
      ('Polonais','Royaume de Pologne insurgé','Un peuple ; il s''agit de l''insurrection de Novembre'),
      ('Tibétains','Tibet de la fragmentation','Un peuple, pour une période qui a un nom'),
      ('Mexicains','Insurgés mexicains','Un peuple, pour un camp'),
      ('Magnats danois','Danemark des magnats','Une noblesse, non un État'),
      ('Sikhs','Soulèvement sikh','Un peuple, pour un soulèvement')
    ) as t(avant, apres, pourquoi)
  loop
    combien := public.rename_polity(correction.avant, correction.apres);
    if combien > 0 then
      insert into public.polity_corrections (avant, apres, pourquoi, tranches)
      values (correction.avant, correction.apres, correction.pourquoi, combien);
    end if;
  end loop;
end $$;

select count(*) as corrections, sum(tranches) as tranches_touchees
from public.polity_corrections;;
