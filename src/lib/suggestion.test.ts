import { test } from "node:test";
import assert from "node:assert/strict";
import { rapportDeLaSemaine } from "./rapport.ts";
import { CONSIGNE, donneesPourLIA, lireSuggestions } from "./suggestion.ts";

const RAPPORT = rapportDeLaSemaine("2026-11-16", {
  repas: [
    { jour: "2026-11-16", etat: "servie", prix: 1000, platId: "garba", nom: "Garba" },
    { jour: "2026-11-20", etat: "reservee", prix: 1500, platId: "kedjenou", nom: "Kedjenou" },
  ],
  recharges: [{ montant: 5000, moyen: "cartflox", confirmeeLe: "2026-11-18T10:00:00Z" }],
  notes: [{ platId: "garba", note: 4 }],
  pesees: [],
}, Date.UTC(2026, 10, 21, 12));

test("ce qui part vers l'IA : les jours par leur nom, les plats par leur nom, les chiffres du rapport", () => {
  const d = donneesPourLIA(RAPPORT);
  assert.equal(d.jours[0].jour, "lundi");
  assert.equal(d.jours[4].jour, "vendredi");
  assert.equal(d.jours[4].nonRetires, 1);
  assert.deepEqual(d.plats.map((p) => p.nom), ["Garba", "Kedjenou"]);
  // Le kedjenou de vendredi n'a pas été retiré : l'IA reçoit le chiffre, elle ne le déduit pas.
  assert.equal(d.plats.find((p) => p.nom === "Kedjenou")?.nonRetires, 1);
  assert.equal(d.total.payeEnFrancsCfa, 2500);
  assert.equal(d.recharges.montantEnFrancsCfa, 5000);
  assert.equal(d.partDesNonRetiresSurLesJoursFinis, "50 %");
});

test("une réponse de la bonne forme, sans chiffre, est gardée ; au plus quatre suggestions", () => {
  const cinq = Array.from({ length: 5 }, (_, i) => ({ titre: `Idée ${"abcde"[i]}`, texte: "Refais le garba, il plaît." }));
  const r = lireSuggestions(JSON.stringify({ suggestions: cinq }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.suggestions.length, 4);
});

test("une suggestion qui cite un chiffre n'est pas montrée", () => {
  const r = lireSuggestions(JSON.stringify({ suggestions: [{ titre: "Vendredi", texte: "Il y a eu 27 repas non retirés." }] }));
  assert.deepEqual(r, { ok: false, raison: "chiffre" });
});

test("une réponse illisible ou de travers n'est pas montrée", () => {
  assert.deepEqual(lireSuggestions("pas du JSON"), { ok: false, raison: "illisible" });
  assert.deepEqual(lireSuggestions(JSON.stringify({ suggestions: [] })), { ok: false, raison: "forme" });
  assert.deepEqual(lireSuggestions(JSON.stringify({ idees: ["garba"] })), { ok: false, raison: "forme" });
});

test("les tirets et le point médian bannis de l'écran deviennent une virgule", () => {
  const r = lireSuggestions(JSON.stringify({ suggestions: [{ titre: "Vendredi \u2014 rappel", texte: "Préviens la veille \u00b7 ça marche." }] }));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.suggestions[0], { titre: "Vendredi, rappel", texte: "Préviens la veille, ça marche." });
});

test("la consigne interdit les nombres et ne contient elle-même ni tiret long, ni tiret moyen, ni point médian", () => {
  assert.match(CONSIGNE, /aucun nombre/);
  assert.doesNotMatch(CONSIGNE, /[\u2014\u2013\u00b7]/);
});

test("une quantité écrite en mots est refusée comme un chiffre", () => {
  const reponse = (texte: string) => JSON.stringify({ suggestions: [{ titre: "Le service", texte }] });
  for (const texte of ["Presque tous les repas réservés ont été servis", "La moitié des convives a noté son repas", "Le garba s'est vendu deux fois plus", "La plupart des repas partent avant midi"]) {
    assert.deepEqual(lireSuggestions(reponse(texte)), { ok: false, raison: "chiffre" }, texte);
  }
  const sans = lireSuggestions(reponse("Le garba plaît : remets-le au menu un jour de marché"));
  assert.equal(sans.ok, true);
});
