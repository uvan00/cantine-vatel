// Essais de la demande hors délai : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { peutDemanderHorsDelai, type DemandeHorsDelai } from "./reservation.ts";

// Samedi 21 novembre 2026 à 10 h, heure d'Abidjan (GMT) : la clôture de 9 h est passée.
const MAINTENANT = Date.UTC(2026, 10, 21, 10, 0);
const demande = (plus: Partial<DemandeHorsDelai> = {}): DemandeHorsDelai => ({
  maintenant: MAINTENANT, jour: "2026-11-21", heureCloture: 9, dejaReserve: false, demandeEnCours: false, epuise: false,
  portions: null, reservees: 0, incompatibilites: [], solde: 5000, prix: 1500, ...plus,
});

test("après la clôture, le convive sans repas peut demander un plat qui reste", () => {
  assert.deepEqual(peutDemanderHorsDelai(demande()), { ok: true });
});

test("une demande qui dépasserait le plafond de la semaine est refusée tout de suite", () => {
  const v = peutDemanderHorsDelai(demande({ plafond: { max: 5000, depense: 4000 } }));
  assert.equal(v.ok, false);
  assert.match(v.ok ? "" : v.phrase, /plafond de la semaine/);
  assert.deepEqual(peutDemanderHorsDelai(demande({ plafond: { max: 5000, depense: 3500 } })), { ok: true });
  assert.deepEqual(peutDemanderHorsDelai(demande({ plafond: { max: null, depense: 99_000 } })), { ok: true });
});
