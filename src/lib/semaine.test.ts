// Essais de « Ta semaine avec ton solde ». `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { proposerSemaine, type PlatPropose } from "./semaine.ts";

const plat = (id: string, prix: number, note: number | null, p: Partial<PlatPropose> = {}): PlatPropose => ({
  id, nom: id, prix, note, allergenes: [], porc: false, vegetarien: false, portions: null, epuise: false, reservees: 0, ...p,
});
const sansProfil = { allergenes: [], regimes: [] };

test("avec assez de solde, chaque jour reçoit le plat le mieux noté", () => {
  const r = proposerSemaine([
    { jour: "2026-11-23", plats: [plat("garba", 1000, 4.2), plat("kedjenou", 2000, 4.8)] },
    { jour: "2026-11-24", plats: [plat("alloco", 1000, null), plat("riz", 1500, 3.9)] },
  ], 10000, sansProfil);
  assert.deepEqual(r.propositions.map((p) => p.plat?.id), ["kedjenou", "riz"]);
  assert.equal(r.total, 3500);
  assert.equal(r.reste, 6500);
});

test("un solde juste couvre d'abord le plus de jours, puis monte vers le mieux noté avec ce qui reste", () => {
  const jours = [
    { jour: "2026-11-23", plats: [plat("garba", 1000, 4), plat("kedjenou", 2500, 5)] },
    { jour: "2026-11-24", plats: [plat("alloco", 1000, 3), plat("poisson", 1500, 4.5)] },
    { jour: "2026-11-25", plats: [plat("riz", 1000, 4)] },
  ];
  const r = proposerSemaine(jours, 3500, sansProfil);
  assert.deepEqual(r.propositions.map((p) => p.plat?.id), ["garba", "poisson", "riz"], "trois jours couverts plutôt qu'un kedjenou");
  assert.equal(r.total, 3500);
  assert.equal(r.reste, 0);
});

test("pas assez pour tous les jours : les derniers disent « solde »", () => {
  const r = proposerSemaine([
    { jour: "2026-11-23", plats: [plat("garba", 1000, 4)] },
    { jour: "2026-11-24", plats: [plat("alloco", 1000, 3)] },
  ], 1500, sansProfil);
  assert.deepEqual(r.propositions.map((p) => [p.plat?.id ?? null, p.raison]), [["garba", null], [null, "solde"]]);
});

test("le profil alimentaire et les plats complets écartent un plat ; sans rien qui convienne, le jour dit « rien »", () => {
  const r = proposerSemaine([
    { jour: "2026-11-23", plats: [plat("arachide", 1000, 5, { allergenes: ["arachide"] }), plat("garba", 1500, 3)] },
    { jour: "2026-11-24", plats: [plat("complet", 1000, 5, { portions: 10, reservees: 10 })] },
  ], 10000, { allergenes: ["arachide"], regimes: [] });
  assert.equal(r.propositions[0].plat?.id, "garba");
  assert.equal(r.propositions[1].raison, "rien");
});
