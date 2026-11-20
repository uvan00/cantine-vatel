#!/bin/bash
# Pose tes clés Cartflox dans le fichier .env.local du projet, sans jamais les afficher.
#
#   ./scripts/cle-cartflox.sh
#
# Le script te demande la clé publique (af_test_pub_ ou af_live_pub_), puis la clé secrète (af_test_sec_ ou af_live_sec_).
# Colle chacune, rien ne s'affiche, puis Entrée. Les deux doivent être du même mode : test avec test, production avec
# production. Tu les trouves dans ton espace Cartflox, rubrique Développeurs.
# Pour essayer et pour la démo : les clés de TEST (aucun argent ne bouge). Les clés de production font payer pour de vrai.
# .env.local n'est lisible que par toi et n'entre jamais dans git. Ne colle jamais une clé dans un chat.
set -u
projet="$(cd "$(dirname "$0")/.." && pwd)"
cible="$projet/.env.local"

read -r -s -p "Colle ta clé PUBLIQUE Cartflox (rien ne s'affiche), puis Entrée : " publique
echo
read -r -s -p "Colle ta clé SECRÈTE Cartflox (rien ne s'affiche), puis Entrée : " secrete
echo
publique="$(printf '%s' "$publique" | tr -d '[:space:]')"
secrete="$(printf '%s' "$secrete" | tr -d '[:space:]')"

mode_pub="$(printf '%s' "$publique" | sed -nE 's/^af_(test|live)_pub_[A-Za-z0-9]{16,}$/\1/p')"
mode_sec="$(printf '%s' "$secrete" | sed -nE 's/^af_(test|live)_sec_[A-Za-z0-9]{16,}$/\1/p')"
if [ -z "$mode_pub" ]; then echo "La clé publique doit commencer par af_test_pub_ ou af_live_pub_. Rien n'a été écrit."; exit 1; fi
if [ -z "$mode_sec" ]; then echo "La clé secrète doit commencer par af_test_sec_ ou af_live_sec_. Rien n'a été écrit."; exit 1; fi
if [ "$mode_pub" != "$mode_sec" ]; then echo "Une clé de test et une clé de production ne vont pas ensemble. Rien n'a été écrit."; exit 1; fi

umask 077
touch "$cible"
chmod 600 "$cible"
# Les autres lignes de .env.local sont gardées ; seules les deux lignes des clés sont remplacées.
reste="$(grep -v -E '^CARTFLOX_CLE_(PUBLIQUE|SECRETE)=' "$cible" || true)"
{
  [ -n "$reste" ] && printf '%s\n' "$reste"
  printf 'CARTFLOX_CLE_PUBLIQUE=%s\n' "$publique"
  printf 'CARTFLOX_CLE_SECRETE=%s\n' "$secrete"
} > "$cible.tmp" && mv "$cible.tmp" "$cible"
chmod 600 "$cible"

if [ "$mode_pub" = "live" ]; then
  echo "Clés de PRODUCTION enregistrées dans .env.local : les paiements seront réels."
else
  echo "Clés de test enregistrées dans .env.local : aucun argent ne bouge."
fi
echo "Relance le serveur (npm run dev) pour qu'il les lise."
