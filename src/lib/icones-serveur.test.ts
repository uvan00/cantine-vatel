// Garde-fou : une page ou un composant SERVEUR ne passe jamais une icône (une fonction) à un composant du kit, qui est
// un composant client. React refuse de faire passer une fonction du serveur au client : la page plante (erreur 500,
// « Functions cannot be passed directly to Client Components »). Les pages serveur passent par
// src/components/kit-client.tsx, qui reçoit le NOM de l'icône. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersTsx(chemin);
    return chemin.endsWith(".tsx") ? [chemin] : [];
  });
}

/** Vrai pour un fichier client : sa directive « use client » ouvre le fichier, avant tout import. */
const estClient = (source: string) => /^\s*(\/\/[^\n]*\n\s*)*["']use client["']/.test(source);

test("aucun composant serveur ne passe une icône à un composant du kit", () => {
  const fautifs = ["src/app", "src/components"].flatMap(fichiersTsx).filter((chemin) => {
    const source = readFileSync(chemin, "utf8");
    return !estClient(source) && /\bIcon=\{/.test(source);
  });
  assert.deepEqual(fautifs, [], `Ces fichiers serveur passent une icône à un composant client : ${fautifs.join(", ")}`);
});
