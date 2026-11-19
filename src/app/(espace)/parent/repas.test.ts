// Essais de ce que le parent lit des repas de son enfant : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unRepasParJour } from "./repas.ts";

const r = (id: string, jour: string, etat: string, convive = "awa") => ({ id, jour, etat, convive });
const parJour = (x: { jour: string }) => x.jour;
const ids = (liste: { id: string }[]) => liste.map((x) => x.id);

test("un repas par jour, dans l'ordre reçu", () => {
  const repas = unRepasParJour([r("c", "2026-11-20", "reservee"), r("b", "2026-11-19", "servie"), r("a", "2026-11-18", "reservee")], parJour);
  assert.deepEqual(ids(repas), ["c", "b", "a"]);
  assert.deepEqual(unRepasParJour([], parJour), []);
});

test("le repas qui tient passe devant les réservations annulées du même jour", () => {
  // Réservé, annulé, puis réservé encore : on lit le repas réservé, qu'il soit le plus récent ou non.
  assert.deepEqual(ids(unRepasParJour([r("3", "2026-11-20", "reservee"), r("2", "2026-11-20", "annulee"), r("1", "2026-11-20", "annulee")], parJour)), ["3"]);
  assert.deepEqual(ids(unRepasParJour([r("3", "2026-11-20", "annulee"), r("2", "2026-11-20", "servie"), r("1", "2026-11-20", "annulee")], parJour)), ["2"]);
});

test("sans repas qui tient, on garde la réservation annulée la plus récente, une seule fois", () => {
  const repas = unRepasParJour([r("5", "2026-11-20", "annulee"), r("4", "2026-11-20", "annulee"), r("3", "2026-11-20", "annulee"), r("2", "2026-11-19", "servie")], parJour);
  assert.deepEqual(ids(repas), ["5", "2"]);
});

test("la clé sépare deux enfants le même jour", () => {
  const liste = [r("2", "2026-11-20", "annulee", "ismael"), r("1", "2026-11-20", "reservee", "awa")];
  assert.deepEqual(ids(unRepasParJour(liste, (x) => `${x.convive} ${x.jour}`)), ["2", "1"]);
  assert.deepEqual(ids(unRepasParJour(liste, parJour)), ["1"]);
});
