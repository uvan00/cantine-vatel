// Essais des chiffres du tableau de bord de la cantine : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chiffresDuService, classer, nonRetires, noteLisible, notesParPlat, partDeBarre, periode, pourcent, rechargesConfirmees, repasParJour,
  repasParPlat, septDerniersJours,
} from "./statistiques.ts";

const t = (iso: string) => Date.parse(iso);

test("réservés, servis, à servir : un repas annulé ne compte nulle part", () => {
  const repas = [{ etat: "servie" }, { etat: "servie" }, { etat: "reservee" }, { etat: "annulee" }];
  assert.deepEqual(chiffresDuService(repas), { reserves: 3, servis: 2, aServir: 1 });
  assert.deepEqual(chiffresDuService([]), { reserves: 0, servis: 0, aServir: 0 });
});

test("les repas par jour suivent l'ordre des jours, avec zéro pour un jour sans repas", () => {
  const repas = [
    { jour: "2026-11-16", etat: "servie" },
    { jour: "2026-11-16", etat: "reservee" },
    { jour: "2026-11-16", etat: "annulee" },
    { jour: "2026-11-18", etat: "reservee" },
    { jour: "2026-11-30", etat: "reservee" },
  ];
  assert.deepEqual(repasParJour(["2026-11-16", "2026-11-17", "2026-11-18"], repas), [2, 0, 1]);
  assert.deepEqual(repasParJour([], repas), []);
});

test("les plats se classent du plus réservé au moins réservé, puis par ordre alphabétique", () => {
  const repas = [
    { etat: "servie", platId: "p1", nom: "Garba" },
    { etat: "reservee", platId: "p2", nom: "Attiéké poisson" },
    { etat: "servie", platId: "p2", nom: "Attiéké poisson" },
    { etat: "annulee", platId: "p1", nom: "Garba" },
    { etat: "servie", platId: "p3", nom: "Alloco et œufs" },
  ];
  const classement = classer(repasParPlat(repas));
  assert.deepEqual(classement.map((l) => [l.nom, l.repas]), [["Attiéké poisson", 2], ["Alloco et œufs", 1], ["Garba", 1]]);
  assert.deepEqual(classer(repasParPlat(repas), 1).map((l) => l.platId), ["p2"]);
  // Un plat au menu sans aucune réservation reste dans la liste, en dernier.
  assert.deepEqual(classer([{ nom: "Placali", repas: 0 }, { nom: "Garba", repas: 4 }]).map((l) => l.nom), ["Garba", "Placali"]);
  assert.deepEqual(classer([]), []);
});

test("les sept derniers jours sont les sept jours terminés avant aujourd'hui", () => {
  assert.deepEqual(septDerniersJours("2026-11-19"), { debut: "2026-11-12", fin: "2026-11-18" });
  assert.deepEqual(septDerniersJours("2026-03-03"), { debut: "2026-02-24", fin: "2026-03-02" });
});

test("non retiré : encore réservé alors que le jour est passé, et aujourd'hui ne compte pas encore", () => {
  const maintenant = t("2026-11-19T13:00:00Z");
  const repas = [
    { jour: "2026-11-17", etat: "servie" },
    { jour: "2026-11-17", etat: "reservee" },
    { jour: "2026-11-18", etat: "servie" },
    { jour: "2026-11-18", etat: "annulee" },
    { jour: "2026-11-19", etat: "reservee" },
    { jour: "2026-11-20", etat: "reservee" },
  ];
  assert.deepEqual(nonRetires(repas, maintenant), { nombre: 1, total: 3 });
  assert.deepEqual(nonRetires([], maintenant), { nombre: 0, total: 0 });
});

test("une part s'arrondit à l'entier, et ne se calcule pas sur rien", () => {
  assert.equal(pourcent(11, 134), 8);
  assert.equal(pourcent(0, 20), 0);
  assert.equal(pourcent(20, 20), 100);
  assert.equal(pourcent(0, 0), null);
});

test("les recharges confirmées s'additionnent entre deux jours compris, à l'heure d'Abidjan", () => {
  const recharges = [
    { montant: 5000, confirmeeLe: "2026-11-12T00:00:00Z" },
    { montant: 2000, confirmeeLe: new Date("2026-11-18T23:59:59Z") },
    { montant: 10_000, confirmeeLe: "2026-11-19T08:30:00Z" },
    { montant: 500, confirmeeLe: "2026-11-11T23:59:59Z" },
  ];
  assert.equal(rechargesConfirmees(recharges, "2026-11-12", "2026-11-18"), 7000);
  assert.equal(rechargesConfirmees(recharges, "2026-11-19", "2026-11-19"), 10_000);
  assert.equal(rechargesConfirmees([], "2026-11-12", "2026-11-18"), 0);
});

test("la note d'un plat : sa moyenne au dixième et son nombre d'avis", () => {
  const notes = notesParPlat([{ platId: "p1", note: 5 }, { platId: "p1", note: 4 }, { platId: "p1", note: 4 }, { platId: "p2", note: 3 }]);
  assert.deepEqual(notes.get("p1"), { moyenne: 4.3, avis: 3 });
  assert.deepEqual(notes.get("p2"), { moyenne: 3, avis: 1 });
  assert.equal(notes.get("p3"), undefined);
  assert.equal(noteLisible(4.3), "4,3 sur 5");
  assert.equal(noteLisible(4), "4,0 sur 5");
});

test("une barre se mesure à la plus haute, et zéro reste zéro", () => {
  assert.equal(partDeBarre(29, 29), 1);
  assert.equal(partDeBarre(0, 29), 0);
  assert.equal(partDeBarre(10, 40), 0.25);
  assert.equal(partDeBarre(0, 0), 0);
});

test("une période se dit en mots, le mois une seule fois quand il ne change pas", () => {
  assert.equal(periode("2026-11-16", "2026-11-22"), "du lundi 16 au dimanche 22 novembre");
  assert.equal(periode("2026-11-30", "2026-12-06"), "du lundi 30 novembre au dimanche 6 décembre");
  assert.equal(periode("2026-11-16", "2026-11-22", false), "du 16 au 22 novembre");
  assert.equal(periode("2026-11-30", "2026-12-06", false), "du 30 novembre au 6 décembre");
});
