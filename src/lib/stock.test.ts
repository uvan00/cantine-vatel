// Essais de la réserve, des achats et du coût d'un repas. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bonDeCommande, coutPortion, libelleLivraison, lireQuantite, margeDe, prevision, prixLisible, prixUnitaire, refusInventaire,
  refusLivraison, stockDe,
} from "./stock.ts";

/** toLocaleString met des espaces insécables : on compare sans aucune espace. */
const serre = (s: string) => s.replace(/\s/g, "");

test("le stock est la somme des mouvements : livraisons, sorties, écarts d'inventaire", () => {
  assert.equal(stockDe([{ quantite: 25_000 }, { quantite: -2_400 }, { quantite: -150 }]), 22_450);
  assert.equal(stockDe([]), 0);
});

test("le prix d'une unité vient des dernières livraisons payées, au plus cinq", () => {
  // 25 kg pour 15 000 F CFA, puis 10 kg pour 7 000 : 22 000 F CFA pour 35 000 g.
  assert.equal(prixUnitaire([{ quantite: 25_000, prix: 15_000 }, { quantite: 10_000, prix: 7_000 }, { quantite: 5_000, prix: null }]), 22_000 / 35_000);
  assert.equal(prixUnitaire([{ quantite: 5_000, prix: null }]), null);
  const six = Array.from({ length: 6 }, (_, i) => ({ quantite: 1_000, prix: i === 5 ? 99_000 : 600 }));
  assert.equal(prixUnitaire(six), 0.6, "la sixième, la plus ancienne, ne compte pas");
  assert.equal(serre(prixLisible(0.6, "g")), "600FCFAlekg");
  assert.equal(serre(prixLisible(1.4, "ml")), "1400FCFAlelitre");
  assert.equal(serre(prixLisible(125, "piece")), "125FCFAlapièce");
});

test("une quantité se tape en kilos, en litres ou en pièces, avec une virgule si besoin", () => {
  assert.equal(lireQuantite("25", "g"), 25_000);
  assert.equal(lireQuantite("1,5", "ml"), 1_500);
  assert.equal(lireQuantite(" 0.75 ", "g"), 750);
  assert.equal(lireQuantite("30", "piece"), 30);
  assert.equal(lireQuantite("0", "g"), null);
  assert.equal(lireQuantite("douze", "g"), null);
  assert.equal(lireQuantite("-3", "g"), null);
});

test("une livraison : une quantité, un prix entier ou rien, un jour déjà là", () => {
  assert.equal(refusLivraison({ quantite: 25_000, prix: 15_000, jour: "2026-11-21" }, "2026-11-21"), null);
  assert.equal(refusLivraison({ quantite: 25_000, prix: null, jour: "2026-11-20" }, "2026-11-21"), null);
  assert.match(refusLivraison({ quantite: 0, prix: null, jour: "2026-11-21" }, "2026-11-21") ?? "", /quantité/);
  assert.match(refusLivraison({ quantite: 10, prix: 0, jour: "2026-11-21" }, "2026-11-21") ?? "", /prix/);
  assert.match(refusLivraison({ quantite: 10, prix: null, jour: "2026-11-22" }, "2026-11-21") ?? "", /pas avant/);
  assert.equal(refusInventaire(0), null);
  assert.match(refusInventaire(-1) ?? "", /comptée/);
  assert.equal(serre(libelleLivraison("Riz", 25_000, "g")), serre("Livraison : Riz, 25 kg"));
});

test("le coût d'une portion additionne sa fiche ; un prix inconnu est nommé, le coût devient un minimum", () => {
  const prix = new Map<string, number | null>([["riz", 0.6], ["poulet", 3], ["huile", null]]);
  const plein = coutPortion([{ ingredientId: "riz", nom: "Riz", quantite: 150 }, { ingredientId: "poulet", nom: "Poulet", quantite: 250 }], prix);
  assert.deepEqual(plein, { cout: 840, complet: true, manquants: [] });
  const partiel = coutPortion([{ ingredientId: "riz", nom: "Riz", quantite: 150 }, { ingredientId: "huile", nom: "Huile", quantite: 20 }], prix);
  assert.deepEqual(partiel, { cout: 90, complet: false, manquants: ["Huile"] });
  assert.deepEqual(margeDe(1500, 840), { marge: 660, part: 56 });
});

test("le bon de commande : le besoin moins le stock, jamais négatif, avec son coût d'après le prix connu", () => {
  const r = bonDeCommande(
    [
      { ingredientId: "riz", nom: "Riz", unite: "g", total: 12_000 },
      { ingredientId: "huile", nom: "Huile", unite: "ml", total: 900 },
      { ingredientId: "oignon", nom: "Oignon", unite: "g", total: 2_000 },
    ],
    new Map([["riz", 4_000], ["huile", 5_000], ["oignon", -300]]),
    new Map<string, number | null>([["riz", 0.6], ["huile", 1.4], ["oignon", null]]),
  );
  assert.deepEqual(r.lignes.map((l) => [l.nom, l.aAcheter, l.coutEstime]), [["Riz", 8_000, 4_800], ["Huile", 0, 0], ["Oignon", 2_000, null]]);
  assert.equal(r.lignes[2].stock, 0, "un stock négatif compte pour zéro");
  assert.equal(r.total, 4_800);
  assert.deepEqual(r.sansPrix, ["Oignon"]);
});

test("un plat à venir demande ses portions prévues, jamais moins que ses réservations", () => {
  assert.equal(prevision({ reservations: 7, portions: 40 }), 40);
  assert.equal(prevision({ reservations: 12, portions: null }), 12);
  assert.equal(prevision({ reservations: 45, portions: 40 }), 45);
});
