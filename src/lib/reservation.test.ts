// Essais des règles de réservation, d'annulation et du scan au comptoir : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estComplet, etatAffiche, peutAnnuler, peutDemanderHorsDelai, peutReserver, portionsRestantes, scanner, type DemandeHorsDelai, type DemandeReservation } from "./reservation.ts";

const t = (iso: string) => Date.parse(iso);
/** fcfa() met des espaces insécables : on compare sans aucune espace. */
const serre = (s: string) => s.replace(/\s/g, "");

const demande = (d: Partial<DemandeReservation> = {}): DemandeReservation => ({
  maintenant: t("2026-11-20T15:00:00Z"),
  jour: "2026-11-21",
  dejaReserve: false,
  epuise: false,
  portions: null,
  reservees: 0,
  incompatibilites: [],
  solde: 5000,
  prix: 1500,
  ...d,
});

test("une réservation passe quand tout est vrai", () => {
  assert.deepEqual(peutReserver(demande()), { ok: true });
  assert.deepEqual(peutReserver(demande({ solde: 1500 })), { ok: true });
  assert.deepEqual(peutReserver(demande({ portions: 40, reservees: 39 })), { ok: true });
});

test("après 9 h le jour du repas, c'est clos", () => {
  const v = peutReserver(demande({ maintenant: t("2026-11-21T09:00:00Z") }));
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.refus, "cloture");
  assert.deepEqual(peutReserver(demande({ maintenant: t("2026-11-21T08:59:00Z") })), { ok: true });
});

test("un repas par jour", () => {
  const v = peutReserver(demande({ dejaReserve: true }));
  assert.equal(!v.ok && v.refus, "deja");
});

test("un plat épuisé ou sans portion libre est complet", () => {
  assert.equal(estComplet({ epuise: true, portions: null, reservees: 0 }), true);
  assert.equal(estComplet({ epuise: false, portions: 40, reservees: 40 }), true);
  assert.equal(estComplet({ epuise: false, portions: 40, reservees: 39 }), false);
  assert.equal(estComplet({ epuise: false, portions: null, reservees: 900 }), false);
  assert.equal(portionsRestantes({ portions: 40, reservees: 38 }), 2);
  assert.equal(portionsRestantes({ portions: null, reservees: 38 }), null);
  const v = peutReserver(demande({ portions: 40, reservees: 40 }));
  assert.equal(!v.ok && v.refus, "complet");
});

test("le profil alimentaire bloque, avec sa raison", () => {
  const v = peutReserver(demande({ incompatibilites: ["contient de l'arachide"] }));
  assert.equal(!v.ok && v.refus, "profil");
  assert.equal(!v.ok && v.phrase, "Ce plat contient de l'arachide, pas pour toi");
});

test("le solde doit couvrir le prix, et la phrase dit ce qu'il manque", () => {
  const v = peutReserver(demande({ solde: 1000 }));
  assert.equal(!v.ok && v.refus, "solde");
  assert.equal(!v.ok && serre(v.phrase), "Iltemanque500FCFApourceplat");
});

test("les refus se disent dans l'ordre : clôture, déjà réservé, complet, profil, solde", () => {
  const tout = demande({ maintenant: t("2026-11-21T10:00:00Z"), dejaReserve: true, epuise: true, incompatibilites: ["contient du porc"], solde: 0 });
  const ordre = ["cloture", "deja", "complet", "profil", "solde"];
  const d: DemandeReservation = { ...tout };
  const vus: string[] = [];
  for (const corrige of [{ maintenant: t("2026-11-20T10:00:00Z") }, { dejaReserve: false }, { epuise: false }, { incompatibilites: [] as string[] }, { solde: 5000 }]) {
    const v = peutReserver(d);
    if (!v.ok) vus.push(v.refus);
    Object.assign(d, corrige);
  }
  assert.deepEqual(vus, ordre);
  assert.deepEqual(peutReserver(d), { ok: true });
});

test("on annule jusqu'à la clôture, jamais un repas servi ou déjà annulé", () => {
  const avant = t("2026-11-21T08:00:00Z");
  const apres = t("2026-11-21T09:30:00Z");
  assert.deepEqual(peutAnnuler({ etat: "reservee", jour: "2026-11-21" }, avant), { ok: true });
  assert.equal(peutAnnuler({ etat: "reservee", jour: "2026-11-21" }, apres).ok, false);
  assert.equal(peutAnnuler({ etat: "servie", jour: "2026-11-21" }, avant).ok, false);
  assert.equal(peutAnnuler({ etat: "annulee", jour: "2026-11-21" }, avant).ok, false);
});

test("non retiré : réservé alors que son jour est passé", () => {
  const maintenant = t("2026-11-22T07:00:00Z");
  assert.equal(etatAffiche({ etat: "reservee", jour: "2026-11-21" }, maintenant), "non_retiree");
  assert.equal(etatAffiche({ etat: "reservee", jour: "2026-11-22" }, maintenant), "reservee");
  assert.equal(etatAffiche({ etat: "servie", jour: "2026-11-21" }, maintenant), "servie");
  assert.equal(etatAffiche({ etat: "annulee", jour: "2026-11-21" }, maintenant), "annulee");
});

test("le scan au comptoir a cinq réponses", () => {
  const midi = t("2026-11-21T12:20:00Z");
  assert.deepEqual(scanner(null, midi), { genre: "inconnu", phrase: "Ticket inconnu" });
  assert.deepEqual(scanner({ etat: "annulee", jour: "2026-11-21", serviLe: null }, midi), { genre: "annule", phrase: "Ticket annulé" });
  assert.deepEqual(scanner({ etat: "servie", jour: "2026-11-21", serviLe: "2026-11-21T12:14:00Z" }, midi), { genre: "deja_servi", phrase: "Déjà servi à 12 h 14" });
  assert.deepEqual(scanner({ etat: "reservee", jour: "2026-11-22", serviLe: null }, midi), { genre: "autre_jour", phrase: "Ce ticket est pour demain" });
  assert.deepEqual(scanner({ etat: "reservee", jour: "2026-11-20", serviLe: null }, midi), { genre: "autre_jour", phrase: "Ce ticket était pour hier" });
  assert.deepEqual(scanner({ etat: "reservee", jour: "2026-11-21", serviLe: null }, midi), { genre: "servi", phrase: "Servi" });
});

test("la cantine qui réserve pour un convive respecte la clôture, comme lui (cahier des charges, 4.1)", () => {
  assert.deepEqual(peutReserver(demande({ maintenant: t("2026-11-21T08:59:00Z"), parLaCantine: true })), { ok: true });
  const apres = peutReserver(demande({ maintenant: t("2026-11-21T12:00:00Z"), parLaCantine: true }));
  assert.equal(apres.ok, false);
  if (!apres.ok) assert.equal(apres.refus, "cloture");
});

test("seule une demande hors délai acceptée passe après la clôture, le jour même, jamais un jour passé", () => {
  const midi = t("2026-11-21T12:00:00Z");
  assert.deepEqual(peutReserver(demande({ maintenant: midi, parLaCantine: true, horsDelai: true })), { ok: true });
  const passe = peutReserver(demande({ maintenant: t("2026-11-22T08:00:00Z"), parLaCantine: true, horsDelai: true }));
  assert.equal(passe.ok, false);
  if (!passe.ok) assert.equal(passe.refus, "cloture");
});

test("quand la cantine réserve, les règles restent les mêmes et la phrase parle du convive", () => {
  const cantine = (d: Partial<DemandeReservation>) => peutReserver(demande({ parLaCantine: true, ...d }));
  const deja = cantine({ dejaReserve: true });
  assert.ok(!deja.ok && deja.phrase === "Un repas par jour, ce convive a déjà réservé");
  const profil = cantine({ incompatibilites: ["contient de l'arachide"] });
  assert.ok(!profil.ok && profil.phrase === "Ce plat contient de l'arachide, pas pour ce convive");
  const solde = cantine({ solde: 1000 });
  assert.ok(!solde.ok && serre(solde.phrase) === "Illuimanque500FCFApourceplat");
  const complet = cantine({ portions: 10, reservees: 10 });
  assert.ok(!complet.ok && complet.refus === "complet");
});

test("l'heure de clôture réglée par la cantine remplace 9 h, dans la règle comme dans la phrase", () => {
  const a930 = t("2026-11-21T09:30:00Z");
  assert.deepEqual(peutReserver(demande({ maintenant: a930, heureCloture: 10 })), { ok: true });
  const v = peutReserver(demande({ maintenant: t("2026-11-21T10:00:00Z"), heureCloture: 10 }));
  assert.equal(!v.ok && v.phrase, "Trop tard pour ce jour, les réservations ferment à 10 h");
  assert.deepEqual(peutAnnuler({ etat: "reservee", jour: "2026-11-21" }, a930, 10), { ok: true });
  assert.equal(peutAnnuler({ etat: "reservee", jour: "2026-11-21" }, a930).ok, false, "sans réglage, 9 h");
});

const horsDelai = (d: Partial<DemandeHorsDelai> = {}): DemandeHorsDelai => ({
  maintenant: t("2026-11-21T10:30:00Z"),
  jour: "2026-11-21",
  dejaReserve: false,
  demandeEnCours: false,
  epuise: false,
  portions: 40,
  reservees: 30,
  incompatibilites: [],
  solde: 5000,
  prix: 1500,
  ...d,
});

test("la demande hors délai : aujourd'hui seulement, une fois la clôture passée", () => {
  assert.deepEqual(peutDemanderHorsDelai(horsDelai()), { ok: true });
  assert.match((peutDemanderHorsDelai(horsDelai({ maintenant: t("2026-11-21T08:00:00Z") })) as { phrase: string }).phrase, /réserve directement/);
  assert.match((peutDemanderHorsDelai(horsDelai({ jour: "2026-11-22" })) as { phrase: string }).phrase, /aujourd'hui/);
  assert.deepEqual(peutDemanderHorsDelai(horsDelai({ maintenant: t("2026-11-21T09:30:00Z"), heureCloture: 9 })), { ok: true });
});

test("la demande hors délai garde les règles : un repas par jour, une demande à la fois, portions, profil, solde", () => {
  assert.equal(peutDemanderHorsDelai(horsDelai({ dejaReserve: true })).ok, false);
  assert.match((peutDemanderHorsDelai(horsDelai({ demandeEnCours: true })) as { phrase: string }).phrase, /partie/);
  assert.equal(peutDemanderHorsDelai(horsDelai({ reservees: 40 })).ok, false);
  assert.equal(peutDemanderHorsDelai(horsDelai({ incompatibilites: ["arachide"] })).ok, false);
  assert.equal(serre((peutDemanderHorsDelai(horsDelai({ solde: 1000 })) as { phrase: string }).phrase), serre("Il te manque 500 F CFA pour ce plat"));
});

test("le plafond de la semaine bloque le repas qui le dépasserait", () => {
  assert.deepEqual(peutReserver(demande({ plafond: { max: 5000, depense: 3500 } })), { ok: true });
  const v = peutReserver(demande({ plafond: { max: 5000, depense: 4000 } }));
  assert.equal(!v.ok && v.refus, "plafond");
  assert.equal(serre(!v.ok ? v.phrase : ""), serre("Ce repas dépasserait ton plafond de la semaine, 5 000 F CFA"));
  assert.deepEqual(peutReserver(demande({ plafond: { max: null, depense: 99999 } })), { ok: true });
});
