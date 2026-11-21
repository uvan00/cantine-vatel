// Essais des jetons, des codes et des règles de recharge : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTENTES_MAX, RECHARGE_MAX, RECHARGE_MIN, montantValable, peutAnnulerRecharge, peutConfirmer, peutDemander } from "./recharge.ts";
import { lireCle, nettoyerCode, nouveauCode, nouveauCodeFamille, nouveauJeton, nouvelleReference } from "./ticket.ts";

test("un jeton fait 32 caractères hexadécimaux et ne se répète pas", () => {
  const jetons = new Set(Array.from({ length: 200 }, nouveauJeton));
  assert.equal(jetons.size, 200);
  for (const j of jetons) assert.match(j, /^[0-9a-f]{32}$/);
});

test("un code court fait 6 caractères, sans les signes qu'on confond", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(nouveauCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    assert.match(nouveauCodeFamille(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  }
  assert.match(nouvelleReference(), /^R-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
});

test("le comptoir lit l'adresse d'un ticket, un jeton seul ou un code tapé", () => {
  const jeton = "0123456789abcdef0123456789abcdef";
  assert.deepEqual(lireCle(`https://cantine.exemple.ci/ticket/${jeton}`), { jeton });
  assert.deepEqual(lireCle(`http://localhost:3700/ticket/${jeton}?vu=1`), { jeton });
  assert.deepEqual(lireCle(jeton.toUpperCase()), { jeton });
  assert.deepEqual(lireCle(" k7m 2qp "), { code: "K7M2QP" });
  assert.equal(nettoyerCode("k7m-2qp"), "K7M2QP");
  assert.equal(lireCle("bonjour"), null);
  assert.equal(lireCle(""), null);
  assert.equal(lireCle("https://exemple.ci/autre/chose"), null);
});

test("une recharge va de 500 à 100 000 francs, en entier", () => {
  assert.equal(montantValable(RECHARGE_MIN), true);
  assert.equal(montantValable(RECHARGE_MAX), true);
  assert.equal(montantValable(RECHARGE_MIN - 1), false);
  assert.equal(montantValable(RECHARGE_MAX + 1), false);
  assert.equal(montantValable(2500.5), false);
  assert.equal(montantValable(Number.NaN), false);
});

test("seule une demande en attente se confirme ou s'annule", () => {
  assert.equal(peutConfirmer({ etat: "en_attente" }), true);
  assert.equal(peutConfirmer({ etat: "confirmee" }), false);
  assert.equal(peutAnnulerRecharge({ etat: "en_attente" }), true);
  assert.equal(peutAnnulerRecharge({ etat: "annulee" }), false);
});

test("pas plus de trois demandes de recharge en attente par personne", () => {
  assert.equal(peutDemander(0), true);
  assert.equal(peutDemander(ATTENTES_MAX - 1), true);
  assert.equal(peutDemander(ATTENTES_MAX), false);
});


test("le QR de la carte de cantine se lit à part du ticket", () => {
  const j = "0123456789abcdef0123456789abcdef";
  assert.deepEqual(lireCle(`https://cantine.exemple/carte/${j}`), { carte: j });
  assert.deepEqual(lireCle(`https://cantine.exemple/ticket/${j}`), { jeton: j });
  assert.deepEqual(lireCle(j), { jeton: j });
  assert.deepEqual(lireCle("abc 123"), { code: "ABC123" });
});
