// Essais des jours et de la clôture : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ajouterJours, cloturePassee, estUnJour, jourCourt, jourIso, jourLong, jourPasse, jourProche, joursAPartirDe, lundiDe } from "./jours.ts";

const t = (iso: string) => Date.parse(iso);

test("le jour d'un instant est sa date en temps universel (Abidjan est à l'heure GMT)", () => {
  assert.equal(jourIso(t("2026-11-21T00:00:00Z")), "2026-11-21");
  assert.equal(jourIso(t("2026-11-21T23:59:59Z")), "2026-11-21");
});

test("un jour s'écrit AAAA-MM-JJ et doit exister au calendrier", () => {
  assert.equal(estUnJour("2026-11-21"), true);
  assert.equal(estUnJour("2026-02-30"), false);
  assert.equal(estUnJour("21/11/2026"), false);
  assert.equal(estUnJour(""), false);
});

test("ajouter des jours passe les mois et les années", () => {
  assert.equal(ajouterJours("2026-11-30", 1), "2026-12-01");
  assert.equal(ajouterJours("2026-03-01", -1), "2026-02-28");
  assert.equal(ajouterJours("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(joursAPartirDe("2026-11-29", 3), ["2026-11-29", "2026-11-30", "2026-12-01"]);
});

test("le lundi de la semaine, depuis un samedi, un dimanche ou un lundi", () => {
  assert.equal(lundiDe("2026-11-21"), "2026-11-16");
  assert.equal(lundiDe("2026-11-22"), "2026-11-16");
  assert.equal(lundiDe("2026-11-16"), "2026-11-16");
});

test("la clôture tombe à 9 h le jour du repas", () => {
  assert.equal(cloturePassee("2026-11-21", t("2026-11-20T23:00:00Z")), false);
  assert.equal(cloturePassee("2026-11-21", t("2026-11-21T08:59:59Z")), false);
  assert.equal(cloturePassee("2026-11-21", t("2026-11-21T09:00:00Z")), true);
  assert.equal(cloturePassee("2026-11-21", t("2026-11-22T07:00:00Z")), true);
});

test("un jour est passé seulement le lendemain", () => {
  assert.equal(jourPasse("2026-11-21", t("2026-11-21T23:00:00Z")), false);
  assert.equal(jourPasse("2026-11-21", t("2026-11-22T00:00:00Z")), true);
});

test("les jours se lisent en français", () => {
  assert.equal(jourLong("2026-11-23"), "lundi 23 novembre");
  assert.equal(jourCourt("2026-11-23"), "lun. 23");
  const maintenant = t("2026-11-21T10:00:00Z");
  assert.equal(jourProche("2026-11-21", maintenant), "aujourd'hui");
  assert.equal(jourProche("2026-11-22", maintenant), "demain");
  assert.equal(jourProche("2026-11-20", maintenant), "hier");
  assert.equal(jourProche("2026-11-25", maintenant), "mercredi 25 novembre");
});
