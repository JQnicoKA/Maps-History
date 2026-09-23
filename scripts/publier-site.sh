#!/bin/bash
#
# Envoie le site public (docs/site) sur l'hébergement OVH, par SFTP.
#
#   ./scripts/publier-site.sh ftp.cluster129.hosting.ovh.net identifiant
#
# SFTP et non FTPS : le FTP d'OVH refuse la négociation TLS que `curl`
# demande (erreur 64), tandis que le port SSH répond. SFTP chiffre tout —
# commandes, fichiers et mot de passe — sans rien à négocier.
#
# Le mot de passe est demandé par SSH lui-même, sur le terminal : il
# n'apparaît ni dans l'historique, ni dans la liste des processus.
#
# Prérequis côté OVH : l'accès SSH doit être activé pour ce compte FTP.
# Espace client > Hébergements > onglet FTP-SSH > la ligne du compte >
# « ... » > Modifier > SSH : activé.
set -euo pipefail

serveur="${1:-}"
identifiant="${2:-}"
source_dir="docs/site"
destination="www"

if [[ -z "$serveur" || -z "$identifiant" ]]; then
  echo "usage : $0 <serveur> <identifiant>" >&2
  echo "   ex : $0 ftp.cluster129.hosting.ovh.net historm" >&2
  exit 1
fi

if [[ ! -d "$source_dir" ]]; then
  echo "introuvable : ${source_dir} (lancez le script depuis la racine du dépôt)" >&2
  exit 1
fi

# Les fichiers cachés comptent aussi : `.htaccess` est le plus important du lot.
shopt -s dotglob nullglob

# Une commande `put` par fichier plutôt qu'un envoi du dossier entier : ainsi
# le terminal nomme ce qui part, et un fichier oublié se voit.
#
# Chaque `put` est précédé d'un `-rm` — le tiret dit à sftp de continuer si la
# suppression échoue. Sans lui, un fichier déposé par OVH et non modifiable
# (sa page « Site en construction », par exemple) ferait échouer l'envoi en
# plein milieu.
commandes=""
for fichier in "$source_dir"/*; do
  [[ -f "$fichier" ]] || continue
  cible="${destination}/$(basename "$fichier")"
  echo "  ${fichier} -> ${cible}"
  commandes="${commandes}-rm ${cible}"$'\n'
  commandes="${commandes}put ${fichier} ${cible}"$'\n'
done

if [[ -z "$commandes" ]]; then
  echo "aucun fichier à envoyer dans ${source_dir}" >&2
  exit 1
fi

sftp "${identifiant}@${serveur}" <<SFTP
${commandes}bye
SFTP

echo
echo "Envoyé. Vérifiez :"
echo "  https://historynote.fr/"
echo "  https://historynote.fr/confidentialite.html"
