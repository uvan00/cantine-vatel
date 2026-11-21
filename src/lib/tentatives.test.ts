// Essais du compteur de tentatives : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_ADRESSE, LIMITE_CODE, LIMITE_EMAIL, clesConnexion, connexionBloquee, creerCompteur, noterConnexion } from "./tentatives.ts";

const T0 = Date.UTC(2026, 10, 21, 12, 0);
const enTetes = (valeur: string | null) => ({ get: (nom: string) => (nom === "x-forwarded-for" ? valeur : null) });

test("après 8 mots de passe faux en 10 minutes, la connexion de cet e-mail est fermée", () => {
  const c = creerCompteur();
  const cles = clesConnexion(" Cantine@Cantine.test ", enTetes("10.0.0.7, 10.0.0.1"));
  assert.deepEqual(cles.map(([cle]) => cle), ["email:cantine@cantine.test", "adresse:10.0.0.7"]);
  for (let i = 0; i < LIMITE_EMAIL.essais - 1; i++) noterConnexion(cles, false, T0 + i * 1000, c);
  assert.equal(connexionBloquee(cles, T0 + 8000, c), false);
  noterConnexion(cles, false, T0 + 8000, c);
  assert.equal(connexionBloquee(cles, T0 + 9000, c), true);
});

test("la fenêtre passée, la porte se rouvre", () => {
  const c = creerCompteur();
  const cles = clesConnexion("awa@cantine.test", enTetes(null));
  for (let i = 0; i < LIMITE_EMAIL.essais; i++) noterConnexion(cles, false, T0, c);
  assert.equal(connexionBloquee(cles, T0 + LIMITE_EMAIL.fenetreMs - 1, c), true);
  assert.equal(connexionBloquee(cles, T0 + LIMITE_EMAIL.fenetreMs, c), false);
});

test("une connexion réussie efface les essais de cet e-mail, pas ceux de l'adresse", () => {
  const c = creerCompteur();
  const cles = clesConnexion("awa@cantine.test", enTetes("10.0.0.7"));
  for (let i = 0; i < 5; i++) noterConnexion(cles, false, T0, c);
  noterConnexion(cles, true, T0, c);
  for (let i = 0; i < LIMITE_EMAIL.essais - 1; i++) noterConnexion(cles, false, T0 + 1, c);
  assert.equal(c.bloque(cles[0][0], LIMITE_EMAIL, T0 + 2), false);
  assert.equal(c.bloque(cles[1][0], LIMITE_ADRESSE, T0 + 2), false);
});

test("une même adresse qui essaie beaucoup d'e-mails finit fermée, pour tous", () => {
  const c = creerCompteur();
  for (let i = 0; i < LIMITE_ADRESSE.essais; i++) noterConnexion(clesConnexion(`eleve${i}@cantine.test`, enTetes("10.0.0.9")), false, T0, c);
  assert.equal(connexionBloquee(clesConnexion("autre@cantine.test", enTetes("10.0.0.9")), T0 + 1, c), true);
  assert.equal(connexionBloquee(clesConnexion("autre@cantine.test", enTetes("10.0.0.10")), T0 + 1, c), false);
});

test("5 codes famille faux ferment « relier un enfant » pour ce parent", () => {
  const c = creerCompteur();
  for (let i = 0; i < LIMITE_CODE.essais; i++) c.rate("code:parent-1", LIMITE_CODE, T0);
  assert.equal(c.bloque("code:parent-1", LIMITE_CODE, T0 + 1), true);
  assert.equal(c.bloque("code:parent-2", LIMITE_CODE, T0 + 1), false);
});
