#!/usr/bin/env bash
#
# Téléverse build/glyphs/ vers R2, sous un préfixe daté.
#
# Un script plutôt qu'un bloc à coller, pour la raison qu'explique
# `docs/construire-les-tuiles.md` : la forme à options tient sur dix lignes
# prolongées par des barres obliques, et ces lignes ne survivent pas au
# collage. Ici, une seule commande.
#
# La clé secrète est saisie **sans écho** et n'entre ni dans l'historique du
# shell, ni dans la liste des processus, ni dans ce dépôt.
#
#     bash scripts/upload-glyphs.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

PREFIX="${GLYPHS_PREFIX:-glyphs/2026-10}"
PUBLIC_BASE="https://pub-fd69708b34254e3cabc8112d91c58b0a.r2.dev"

if [ ! -d build/glyphs ]; then
  echo "build/glyphs est absent. Lancez d'abord : npm run glyphs" >&2
  exit 1
fi

FILES=$(find build/glyphs -name '*.pbf' | wc -l | tr -d ' ')
echo "À téléverser : $FILES fichiers, sous le préfixe $PREFIX"
echo

# --- ce qu'il faut demander à Cloudflare --------------------------------
read -r -p "Identifiant de compte Cloudflare (Account ID) : " R2_ACCOUNT
read -r -p "Nom exact du bucket                          : " R2_BUCKET
read -r -p "Access Key ID du jeton R2                    : " R2_KEY
read -rs -p "Secret Access Key (saisie masquée)           : " R2_SECRET
echo
read -r -p "Le bucket est-il en juridiction UE ? [o/N]    : " EU
echo

HOST="https://$R2_ACCOUNT.r2.cloudflarestorage.com"
case "$EU" in
  o|O|y|Y) HOST="https://$R2_ACCOUNT.eu.r2.cloudflarestorage.com" ;;
esac

export RCLONE_S3_PROVIDER=Cloudflare
export RCLONE_S3_ENDPOINT="$HOST"
export RCLONE_S3_ACCESS_KEY_ID="$R2_KEY"
export RCLONE_S3_SECRET_ACCESS_KEY="$R2_SECRET"
export RCLONE_S3_NO_CHECK_BUCKET=true
# Un an, et c'est tenable parce que le préfixe est daté — voir la note.
export RCLONE_HEADER_UPLOAD="Cache-Control: public, max-age=31536000, immutable"

DEST=":s3:$R2_BUCKET/$PREFIX"
echo "Destination : $DEST"
echo "Point d'entrée : $HOST"
echo
read -r -p "Lancer ? [o/N] : " GO
case "$GO" in o|O|y|Y) ;; *) echo "Annulé."; exit 0 ;; esac

# `--no-update-modtime` : R2 refuse le `CopyObject` par lequel rclone voudrait
# corriger la date d'un fichier déjà présent, et ces refus noient le vrai
# message dans cent lignes d'erreurs sans rapport. La date d'un glyphe
# n'intéresse personne : le préfixe est daté, c'est lui qui versionne.
rclone copy build/glyphs "$DEST" -P --s3-no-check-bucket --no-update-modtime

echo
echo "=== Vérification, par l'adresse publique ==="
URL="$PUBLIC_BASE/$PREFIX/Noto%20Sans%20Bold,Noto%20Sans%20Regular/0-255.pbf"
CODE=$(curl -sS -o /dev/null -w "%{http_code} %{size_download}" --max-time 20 "$URL")
echo "$URL"
echo "  → $CODE  (attendu : 200 et quelques dizaines de milliers d'octets)"
echo
echo "Si c'est 200, posez ceci dans .env puis recompilez :"
echo "EXPO_PUBLIC_GLYPHS_URL=$PUBLIC_BASE/$PREFIX"
