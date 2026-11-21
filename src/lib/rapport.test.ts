import { test } from "node:test";
import assert from "node:assert/strict";
import { champCsv, lundiDuRapport, rapportDeLaSemaine, rapportEnCsv } from "./rapport.ts";

// Une semaine d'essai : du lundi 16 au dimanche 22 novembre 2026, lue le jeudi 19 à midi (lundi, mardi et mercredi sont
// finis ; jeudi est en cours).
const LUNDI = "2026-11-16";
const JEUDI_MIDI = Date.UTC(2026, 10, 19, 12);
const repas = (jour: string, etat: string, prix: number, platId = "garba", nom = "Garba") => ({ jour, etat, prix, platId, nom });

const donnees = {
  repas: [
    repas("2026-11-16", "servie", 1000),
    repas("2026-11-16", "servie", 1500, "kedjenou", "Kedjenou"),
    repas("2026-11-16", "annulee", 1000),
    repas("2026-11-17", "servie", 1500, "kedjenou", "Kedjenou"),
    repas("2026-11-17", "reservee", 1500, "kedjenou", "Kedjenou"),
    repas("2026-11-19", "reservee", 1000),
    repas("2026-11-23", "servie", 1000),
  ],
  recharges: [
    { montant: 5000, moyen: "cartflox", confirmeeLe: "2026-11-18T10:00:00Z" },
    { montant: 2000, moyen: "especes", confirmeeLe: "2026-11-22T23:00:00Z" },
    { montant: 3000, moyen: "pispi", confirmeeLe: "2026-11-23T08:00:00Z" },
  ],
  notes: [{ platId: "kedjenou", note: 4 }, { platId: "kedjenou", note: 5 }],
  pesees: [{ jour: "2026-11-16", platId: "garba", nom: "Garba", restes: 1200, servis: 2 }],
};

test("le rapport compte jour par jour : réservés sans les annulés, servis, non retirés des jours finis, payé", () => {
  const r = rapportDeLaSemaine(LUNDI, donnees, JEUDI_MIDI);
  assert.equal(r.jours.length, 7);
  assert.deepEqual(r.jours[0], { jour: "2026-11-16", reserves: 2, servis: 2, nonRetires: 0, annules: 1, paye: 2500, restes: 1200 });
  assert.deepEqual(r.jours[1], { jour: "2026-11-17", reserves: 2, servis: 1, nonRetires: 1, annules: 0, paye: 3000, restes: null });
  // Jeudi est en cours : son repas réservé n'est pas encore « non retiré ».
  assert.deepEqual(r.jours[3], { jour: "2026-11-19", reserves: 1, servis: 0, nonRetires: 0, annules: 0, paye: 1000, restes: null });
  assert.deepEqual(r.total, { reserves: 5, servis: 3, nonRetires: 1, annules: 1, paye: 6500, restes: 1200 });
  // Un repas non retiré parmi les quatre des jours finis.
  assert.equal(r.partNonRetires, 25);
});

test("le rapport ne prend que sa semaine : repas, recharges et pesées d'ailleurs restent dehors", () => {
  const r = rapportDeLaSemaine(LUNDI, donnees, JEUDI_MIDI);
  assert.equal(r.dimanche, "2026-11-22");
  assert.deepEqual(r.recharges, {
    lignes: [{ moyen: "cartflox", nombre: 1, montant: 5000 }, { moyen: "pispi", nombre: 0, montant: 0 }, { moyen: "especes", nombre: 1, montant: 2000 }],
    nombre: 2,
    montant: 7000,
  });
});

test("les plats du plus réservé au moins réservé, avec leurs servis et leur note de la semaine", () => {
  const r = rapportDeLaSemaine(LUNDI, donnees, JEUDI_MIDI);
  assert.deepEqual(r.plats, [
    { platId: "kedjenou", nom: "Kedjenou", repas: 3, servis: 2, nonRetires: 1, note: 4.5, avis: 2 },
    // Le garba de jeudi est réservé pour aujourd'hui : il n'est pas encore « non retiré ».
    { platId: "garba", nom: "Garba", repas: 2, servis: 1, nonRetires: 0, note: null, avis: 0 },
  ]);
  assert.deepEqual(r.notes, { moyenne: 4.5, avis: 2 });
  assert.equal(r.restes.grammes, 1200);
  assert.equal(r.restes.parRepas, 600);
});

test("un repas réservé sans payer n'entre dans « payé » qu'une fois encaissé au comptoir", () => {
  const r = rapportDeLaSemaine(LUNDI, {
    repas: [
      { ...repas("2026-11-16", "servie", 1000), paiement: "solde" },
      { ...repas("2026-11-16", "servie", 1500), paiement: "especes" },
      { ...repas("2026-11-16", "servie", 2000), paiement: "mobile_money" },
      { ...repas("2026-11-17", "reservee", 1500), paiement: "a_payer" },
      { ...repas("2026-11-19", "reservee", 1000), paiement: "a_payer" },
    ],
    recharges: [], notes: [], pesees: [],
  }, JEUDI_MIDI);
  // Le 16 : payé sur le solde, en espèces et par Mobile Money. Le 17 : jamais venu, jamais payé. Le 19 : pas encore payé.
  assert.equal(r.jours[0].paye, 4500);
  assert.deepEqual([r.jours[1].reserves, r.jours[1].nonRetires, r.jours[1].paye], [1, 1, 0]);
  assert.deepEqual([r.jours[3].reserves, r.jours[3].paye], [1, 0]);
  assert.equal(r.total.paye, 4500);
});

test("une semaine sans rien : des zéros, et rien d'inventé", () => {
  const r = rapportDeLaSemaine(LUNDI, { repas: [], recharges: [], notes: [], pesees: [] }, JEUDI_MIDI);
  assert.deepEqual(r.total, { reserves: 0, servis: 0, nonRetires: 0, annules: 0, paye: 0, restes: null });
  assert.equal(r.partNonRetires, null);
  assert.deepEqual(r.plats, []);
  assert.deepEqual(r.notes, { moyenne: null, avis: 0 });
});

test("un champ de CSV se protège quand il contient le séparateur, un guillemet ou un retour à la ligne", () => {
  assert.equal(champCsv("Garba"), "Garba");
  assert.equal(champCsv(1500), "1500");
  assert.equal(champCsv(null), "");
  assert.equal(champCsv("Riz; sauce"), '"Riz; sauce"');
  assert.equal(champCsv('Le "vrai" garba'), '"Le ""vrai"" garba"');
});

test("le CSV : marque UTF-8, point-virgule, les tableaux de la page et leurs totaux", () => {
  const csv = rapportEnCsv(rapportDeLaSemaine(LUNDI, donnees, JEUDI_MIDI), "Cantine de Vatel");
  assert.ok(csv.startsWith("\uFEFFRapport de la semaine;Cantine de Vatel;du lundi 16 au dimanche 22 novembre 2026\r\n"));
  const lignes = csv.slice(1).split("\r\n");
  assert.ok(lignes.includes("Date;Jour;Réservés;Servis;Non retirés;Annulés;Payé (F CFA);Restes pesés (g)"));
  assert.ok(lignes.includes("2026-11-16;lundi;2;2;0;1;2500;1200"));
  assert.ok(lignes.includes("2026-11-17;mardi;2;1;1;0;3000;"));
  assert.ok(lignes.includes("Total;;5;3;1;1;6500;1200"));
  assert.ok(lignes.includes("Plat;Repas;Servis;Non retirés;Note moyenne;Avis"));
  assert.ok(lignes.includes("Kedjenou;3;2;1;4,5;2"));
  assert.ok(lignes.includes("Mobile Money (Cartflox);1;5000"));
  assert.ok(lignes.includes("Total;2;7000"));
  assert.ok(csv.endsWith("\r\n"));
});

test("la semaine du rapport : le lundi du jour demandé, la semaine en cours sinon, jamais une semaine à venir", () => {
  assert.equal(lundiDuRapport("2026-11-18", "2026-11-21"), "2026-11-16");
  assert.equal(lundiDuRapport("2026-11-09", "2026-11-21"), "2026-11-09");
  assert.equal(lundiDuRapport(undefined, "2026-11-21"), "2026-11-16");
  assert.equal(lundiDuRapport("n'importe quoi", "2026-11-21"), "2026-11-16");
  assert.equal(lundiDuRapport(["2026-11-09"], "2026-11-21"), "2026-11-16");
  assert.equal(lundiDuRapport("2026-12-02", "2026-11-21"), "2026-11-16");
});
