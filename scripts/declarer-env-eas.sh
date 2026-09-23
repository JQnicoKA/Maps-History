#!/bin/bash
#
# Déclare auprès d'EAS les variables du `.env` local, pour que les builds dans
# le nuage disposent des mêmes clés que les builds sur cette machine.
#
#   ./scripts/declarer-env-eas.sh
#
# Les valeurs sont lues dans `.env` et passées directement à `eas` : aucune
# n'est affichée, aucune n'est écrite ailleurs.
#
# La visibilité n'est pas la même pour toutes, et ce n'est pas un détail :
#
#   EXPO_PUBLIC_*     → plaintext. Elles sont inscrites dans le bundle de
#                       l'application et lisibles par quiconque le décompresse.
#                       Les marquer secrètes serait se mentir à soi-même.
#   tout le reste     → secret. Le jeton Sentry n'est utile qu'à la machine qui
#                       construit, et ne doit ressortir de nulle part — pas même
#                       du tableau de bord EAS.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "introuvable : .env" >&2
  exit 1
fi

# Les builds `production` servent l'App Store, les `preview` servent à faire
# essayer l'app : les deux ont besoin des mêmes clés.
environnements="production preview"

while IFS= read -r ligne; do
  [[ "$ligne" =~ ^[[:space:]]*# ]] && continue
  [[ "$ligne" != *=* ]] && continue

  nom="${ligne%%=*}"
  nom="${nom// /}"
  valeur="${ligne#*=}"
  valeur="${valeur%\"}"
  valeur="${valeur#\"}"
  [[ -z "$valeur" ]] && continue

  if [[ "$nom" == EXPO_PUBLIC_* ]]; then
    visibilite="plaintext"
  else
    visibilite="secret"
  fi

  for environnement in $environnements; do
    echo "  ${nom} -> ${environnement} (${visibilite})"
    eas env:create "$environnement" \
      --name "$nom" \
      --value "$valeur" \
      --visibility "$visibilite" \
      --scope project \
      --force \
      --non-interactive >/dev/null
  done
done < .env

echo
echo "Déclarées. Pour les relire :  eas env:list production"
