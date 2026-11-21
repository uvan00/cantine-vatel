#!/bin/bash
# Pose la clé d'IA de la cantine (Anthropic) dans le fichier .env.local du projet, sans jamais l'afficher. Elle allume la
# suggestion de la semaine, sur le rapport de la cantine (bonus 5 du cahier).
#
#   ./scripts/cle-ia.sh
#
# Le script te demande la clé : elle commence par sk-ant-. Colle-la, rien ne s'affiche, puis Entrée. Tu la crées dans la
# console d'Anthropic (platform.claude.com, rubrique API Keys). Chaque suggestion rédigée se paie sur ce compte, à l'usage.
# .env.local n'est lisible que par toi et n'entre jamais dans git. Ne colle jamais une clé dans un chat.
set -u
projet="$(cd "$(dirname "$0")/.." && pwd)"
cible="$projet/.env.local"

read -r -s -p "Colle la clé d'IA (rien ne s'affiche), puis Entrée : " cle
echo
cle="$(printf '%s' "$cle" | tr -d '[:space:]')"
if ! printf '%s' "$cle" | grep -Eq '^sk-ant-[A-Za-z0-9_-]{20,}$'; then
  echo "Une clé d'IA commence par sk-ant-. Rien n'a été écrit."
  exit 1
fi

umask 077
touch "$cible"
chmod 600 "$cible"
# Les autres lignes de .env.local sont gardées ; seule la ligne de la clé d'IA est remplacée.
reste="$(grep -v -E '^ANTHROPIC_API_KEY=' "$cible" || true)"
{
  [ -n "$reste" ] && printf '%s\n' "$reste"
  printf 'ANTHROPIC_API_KEY=%s\n' "$cle"
} > "$cible.tmp" && mv "$cible.tmp" "$cible"
chmod 600 "$cible"

echo "Clé d'IA enregistrée dans .env.local. Relance le serveur (npm run dev) pour qu'il la lise."
