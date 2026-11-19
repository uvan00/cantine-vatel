// Essais des règles de réservation, d'annulation et du scan au comptoir : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estComplet, etatAffiche, peutAnnuler, peutReserver, portionsRestantes, scanner, type DemandeReservation } from "./reservation.ts";

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
