import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bilan, periodeEntre, depensesDe, encaissements, enCsv, periodeDe, periodeLisible, periodePrecedente, periodeSuivante, refusDepense, soldes, ventes,
  type RepasCompta,
} from "./comptabilite.ts";

test("les périodes : le jour, la semaine du lundi au dimanche, le mois entier", () => {
  assert.deepEqual(periodeDe("jour", "2026-11-21"), { type: "jour", debut: "2026-11-21", fin: "2026-11-21" });
  assert.deepEqual(periodeDe("semaine", "2026-11-21"), { type: "semaine", debut: "2026-11-16", fin: "2026-11-22" });
  assert.deepEqual(periodeDe("mois", "2026-11-21"), { type: "mois", debut: "2026-11-01", fin: "2026-11-30" });
  assert.deepEqual(periodeDe("mois", "2028-02-10"), { type: "mois", debut: "2028-02-01", fin: "2028-02-29" });
  assert.equal(periodePrecedente(periodeDe("mois", "2026-01-15")).debut, "2025-12-01");
  assert.equal(periodeSuivante(periodeDe("semaine", "2026-11-21")).debut, "2026-11-23");
  assert.equal(periodeLisible(periodeDe("mois", "2026-11-21")), "novembre 2026");
  assert.equal(periodeLisible(periodeDe("semaine", "2026-11-21")), "du 16 au 22 novembre");
});

test("l'argent entré : les recharges confirmées dans la période, par moyen et par jour", () => {
  const e = encaissements([
    { montant: 5000, moyen: "cartflox", confirmeeLe: "2026-11-17T10:00:00Z" },
    { montant: 2000, moyen: "especes", confirmeeLe: "2026-11-17T11:00:00Z" },
    { montant: 3000, moyen: "cartflox", confirmeeLe: "2026-11-20T09:00:00Z" },
    { montant: 9999, moyen: "cartflox", confirmeeLe: "2026-11-23T09:00:00Z" },
  ], periodeDe("semaine", "2026-11-18"));
  assert.equal(e.total, 10000);
  assert.equal(e.nombre, 3);
  assert.deepEqual(e.parMoyen.map((m) => [m.id, m.nombre, m.montant]), [["cartflox", 2, 8000], ["especes", 1, 2000]]);
  assert.equal(e.parJour.length, 7);
  assert.equal(e.parJour.find((j) => j.jour === "2026-11-17")?.montant, 7000);
});

test("les repas vendus : servis et non retirés sont gagnés, les repas à venir pas encore, les annulés jamais", () => {
  const repas: RepasCompta[] = [
    { jour: "2026-11-16", prix: 1000, etat: "servie", plat: "Garba" },
    { jour: "2026-11-16", prix: 1500, etat: "reservee", plat: "Attiéké poisson" },
    { jour: "2026-11-21", prix: 2000, etat: "reservee", plat: "Poulet braisé" },
    { jour: "2026-11-22", prix: 1000, etat: "reservee", plat: "Garba" },
    { jour: "2026-11-17", prix: 1000, etat: "annulee", plat: "Garba" },
    { jour: "2026-11-18", prix: 1000, etat: "servie", plat: "Garba" },
  ];
  const v = ventes(repas, periodeDe("semaine", "2026-11-21"), "2026-11-21");
  assert.equal(v.gagne, 3500);
  assert.deepEqual(v.servis, { nombre: 2, montant: 2000 });
  assert.deepEqual(v.nonRetires, { nombre: 1, montant: 1500 });
  assert.deepEqual(v.aVenir, { nombre: 2, montant: 3000 });
  assert.deepEqual(v.annules, { nombre: 1, montant: 1000 });
  assert.deepEqual(v.parPlat.map((p) => [p.plat, p.nombre, p.montant]), [["Garba", 2, 2000], ["Attiéké poisson", 1, 1500]]);
});

test("une dépense se note avec une date passée, une catégorie, un libellé et un montant entier", () => {
  const ok = { jour: "2026-11-21", categorie: "ingredients", libelle: "Riz, 25 kg", montant: 18500, fournisseur: "", moyen: "especes" };
  assert.equal(refusDepense(ok, "2026-11-21"), null);
  assert.match(refusDepense({ ...ok, jour: "2026-11-22" }, "2026-11-21") ?? "", /pas avant/);
  assert.match(refusDepense({ ...ok, categorie: "loisirs" }, "2026-11-21") ?? "", /catégorie/);
  assert.match(refusDepense({ ...ok, libelle: " " }, "2026-11-21") ?? "", /Ce qui a été payé/);
  assert.match(refusDepense({ ...ok, montant: 12.5 }, "2026-11-21") ?? "", /montant entier/);
  assert.match(refusDepense({ ...ok, montant: 0 }, "2026-11-21") ?? "", /montant entier/);
  assert.match(refusDepense({ ...ok, moyen: "cheque" }, "2026-11-21") ?? "", /moyen de paiement/);
});

test("les dépenses par catégorie, et le bilan gagné moins dépensé", () => {
  const d = depensesDe([
    { jour: "2026-11-16", categorie: "ingredients", montant: 18500 },
    { jour: "2026-11-18", categorie: "gaz", montant: 12000 },
    { jour: "2026-11-19", categorie: "ingredients", montant: 6000 },
    { jour: "2026-11-30", categorie: "salaires", montant: 90000 },
  ], periodeDe("semaine", "2026-11-18"));
  assert.equal(d.total, 36500);
  assert.deepEqual(d.parCategorie.map((c) => [c.id, c.nombre, c.montant]), [["ingredients", 2, 24500], ["gaz", 1, 12000]]);
  assert.deepEqual(bilan(40000, 36500), { gagne: 40000, depense: 36500, resultat: 3500 });
  assert.equal(bilan(10000, 36500).resultat, -26500);
});

test("l'argent en dépôt : seuls les soldes positifs, du plus haut au plus bas", () => {
  const s = soldes([
    { id: "a", nom: "Awa Koné", groupe: "Bachelor 2", solde: 2000 },
    { id: "b", nom: "Ismaël Koné", groupe: "Bachelor 1", solde: 6000 },
    { id: "c", nom: "Kouassi Yao", groupe: "Accueil", solde: 0 },
  ]);
  assert.equal(s.total, 8000);
  assert.deepEqual(s.comptes.map((c) => c.id), ["b", "a"]);
  assert.equal(s.sansArgent, 1);
});

test("le CSV pour le comptable : marque UTF-8, point-virgule, champs protégés", () => {
  const csv = enCsv([["Date", "Libellé", "Montant"], ["2026-11-21", "Riz; 25 kg", 18500]]);
  assert.ok(csv.startsWith("\uFEFFDate;Libellé;Montant\r\n"));
  assert.match(csv, /2026-11-21;"Riz; 25 kg";18500\r\n$/);
});

test("les dates choisies à la main : dans le bon ordre, un an au plus, et la même durée avant ou après", () => {
  assert.deepEqual(periodeEntre("2026-11-21", "2026-11-01"), { type: "dates", debut: "2026-11-01", fin: "2026-11-21" });
  assert.equal(periodeEntre("2025-01-01", "2026-11-21").fin, "2026-01-01");
  const p = periodeEntre("2026-11-10", "2026-11-14");
  assert.deepEqual(periodePrecedente(p), { type: "dates", debut: "2026-11-05", fin: "2026-11-09" });
  assert.deepEqual(periodeSuivante(p), { type: "dates", debut: "2026-11-15", fin: "2026-11-19" });
  assert.equal(periodeLisible(p), "du 10 au 14 novembre");
  assert.equal(periodeLisible(periodeEntre("2026-11-21", "2026-11-21")), "samedi 21 novembre");
});

test("un repas réservé sans payer n'est gagné que servi ; jamais retiré, rien n'a été encaissé", () => {
  const p = periodeDe("semaine", "2026-11-21");
  const repas: RepasCompta[] = [
    { jour: "2026-11-19", prix: 1500, etat: "reservee", plat: "Garba", paiement: "solde" },      // payé, non retiré : gagné
    { jour: "2026-11-19", prix: 2000, etat: "reservee", plat: "Kedjenou", paiement: "a_payer" }, // jamais payé : perdu
    { jour: "2026-11-21", prix: 1000, etat: "servie", plat: "Alloco", paiement: "especes" },     // payé à la caisse : gagné
    { jour: "2026-11-22", prix: 1500, etat: "reservee", plat: "Riz", paiement: "a_payer" },      // à encaisser demain
    { jour: "2026-11-22", prix: 1500, etat: "reservee", plat: "Riz", paiement: "solde" },        // payé d'avance
  ];
  const v = ventes(repas, p, "2026-11-21");
  assert.equal(v.gagne, 2500);
  assert.deepEqual(v.nonRetires, { nombre: 1, montant: 1500 });
  assert.deepEqual(v.jamaisPayes, { nombre: 1, montant: 2000 });
  assert.deepEqual(v.aEncaisser, { nombre: 1, montant: 1500 });
  assert.deepEqual(v.aVenir, { nombre: 1, montant: 1500 });
});

test("l'argent entré compte aussi les repas payés à la caisse, à part des recharges", () => {
  const e = encaissements([
    { montant: 5000, moyen: "especes", confirmeeLe: "2026-11-21T08:00:00.000Z" },
    { montant: 1500, moyen: "repas_especes", confirmeeLe: "2026-11-21T12:10:00.000Z" },
    { montant: 2000, moyen: "repas_mobile_money", confirmeeLe: "2026-11-21T12:20:00.000Z" },
  ], periodeDe("jour", "2026-11-21"));
  assert.equal(e.total, 8500);
  assert.deepEqual(e.parMoyen.map((m) => [m.id, m.montant]), [["especes", 5000], ["repas_especes", 1500], ["repas_mobile_money", 2000]]);
});
