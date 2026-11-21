// Essais des restes pesés : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bilanRestes, enKilos, lireKilos, parRepas, peutPeser, poidsLisible, restesValables } from "./restes.ts";

const t = (iso: string) => Date.parse(iso);
/** toLocaleString met des espaces insécables : on compare sans aucune espace. */
const serre = (s: string) => s.replace(/\s/g, "");

test("on tape des kilos comme sur la balance, la base garde des grammes", () => {
  assert.equal(lireKilos("1,3"), 1300);
  assert.equal(lireKilos("1.3"), 1300);
  assert.equal(lireKilos(" 0,45 "), 450);
  assert.equal(lireKilos("2"), 2000);
  assert.equal(lireKilos("0"), 0);
  assert.equal(lireKilos("0,125"), 125);
  for (const faux of ["", "abc", "-1", "1,2,3", "1,2345", "1000", "1e3"]) assert.equal(lireKilos(faux), null, faux);
});

test("le champ se remplit en kilos, l'écran lit des grammes ou des kilos", () => {
  assert.equal(enKilos(1300), "1,3");
  assert.equal(enKilos(450), "0,45");
  assert.equal(enKilos(12000), "12");
  assert.equal(serre(poidsLisible(450)), "450g");
  assert.equal(serre(poidsLisible(1300)), "1,3kg");
  assert.equal(serre(poidsLisible(12000)), "12kg");
});

test("des restes valables : rien, ou de 0 à 200 kg en grammes entiers", () => {
  assert.ok(restesValables(null));
  assert.ok(restesValables(0));
  assert.ok(restesValables(200_000));
  assert.ok(!restesValables(200_001));
  assert.ok(!restesValables(-1));
  assert.ok(!restesValables(1.5));
});

test("on pèse aujourd'hui ou un jour passé, jamais un jour à venir", () => {
  const midi = t("2026-11-20T12:30:00Z");
  assert.ok(peutPeser("2026-11-20", midi));
  assert.ok(peutPeser("2026-11-19", midi));
  assert.ok(!peutPeser("2026-11-21", midi));
});

test("les restes par repas servi, sans repas servi il n'y a rien à dire", () => {
  assert.equal(parRepas(1300, 20), 65);
  assert.equal(parRepas(1000, 3), 333);
  assert.equal(parRepas(500, 0), null);
});

test("le bilan ne compte que les plats pesés et servis, et trouve le plus laissé", () => {
  const b = bilanRestes([
    { platId: "garba", nom: "Garba", restes: 2000, servis: 10 },
    { platId: "garba", nom: "Garba", restes: 1000, servis: 20 },
    { platId: "attieke", nom: "Attiéké poisson", restes: 3000, servis: 12 },
    { platId: "alloco", nom: "Alloco", restes: null, servis: 15 },
    { platId: "placali", nom: "Placali", restes: 800, servis: 0 },
  ]);
  assert.equal(b.pesees, 3);
  assert.equal(b.grammes, 6000);
  assert.equal(b.servis, 42);
  assert.equal(b.parRepas, 143);
  assert.deepEqual(b.plusLaisse, { nom: "Attiéké poisson", parRepas: 250 });
});

test("sans pesée, le bilan est vide ; des restes à zéro n'élisent personne", () => {
  assert.deepEqual(bilanRestes([]), { pesees: 0, grammes: 0, servis: 0, parRepas: null, plusLaisse: null });
  const zero = bilanRestes([{ platId: "a", nom: "Alloco", restes: 0, servis: 8 }]);
  assert.equal(zero.parRepas, 0);
  assert.equal(zero.plusLaisse, null);
});
