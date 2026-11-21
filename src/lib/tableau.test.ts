import { strict as assert } from "node:assert";
import { test } from "node:test";
import { caisses, moisCompare } from "./tableau.ts";

test("le mois commencé se compare aux mêmes jours du mois d'avant", () => {
  assert.deepEqual(moisCompare("2026-11-21"), {
    mois: { type: "dates", debut: "2026-11-01", fin: "2026-11-21" },
    avant: { type: "dates", debut: "2026-10-01", fin: "2026-10-21" },
  });
  // Le 31 mars se compare à tout février, pas au-delà.
  assert.deepEqual(moisCompare("2026-03-31").avant, { type: "dates", debut: "2026-02-01", fin: "2026-02-28" });
  // En janvier, le mois d'avant est décembre de l'année d'avant.
  assert.deepEqual(moisCompare("2027-01-15").avant, { type: "dates", debut: "2026-12-01", fin: "2026-12-15" });
  // Le premier du mois : un jour contre un jour.
  assert.deepEqual(moisCompare("2026-11-01"), {
    mois: { type: "dates", debut: "2026-11-01", fin: "2026-11-01" },
    avant: { type: "dates", debut: "2026-10-01", fin: "2026-10-01" },
  });
});

test("la caisse de chacun : ses espèces et ses repas servis, le reste à part", () => {
  const membres = [{ id: "fatou", nom: "Fatou" }, { id: "aminata", nom: "Aminata" }];
  const recharges = [
    { confirmeePar: "fatou", montant: 2000, moyen: "especes" },
    { confirmeePar: "fatou", montant: 1500, moyen: "especes" },
    { confirmeePar: "aminata", montant: 5000, moyen: "especes" },
    // Confirmée à la main mais pas en espèces : pas dans la caisse.
    { confirmeePar: "fatou", montant: 9000, moyen: "pispi" },
    { confirmeePar: "cartflox", montant: 3000, moyen: "cartflox" },
    { confirmeePar: "cartflox", montant: 1000, moyen: "cartflox" },
  ];
  const r = caisses(membres, recharges, ["fatou", "fatou", "aminata", "borne", "borne", "borne", null]);
  assert.deepEqual(r.membres, [
    { id: "fatou", nom: "Fatou", especes: { nombre: 2, montant: 3500 }, servis: 2 },
    { id: "aminata", nom: "Aminata", especes: { nombre: 1, montant: 5000 }, servis: 1 },
  ]);
  assert.equal(r.borne, 3);
  assert.equal(r.sansNom, 1);
  assert.deepEqual(r.mobileMoney, { nombre: 2, montant: 4000 });
});

test("une journée sans rien : des zéros, pas d'erreur", () => {
  const r = caisses([{ id: "fatou" }], [], []);
  assert.deepEqual(r.membres, [{ id: "fatou", especes: { nombre: 0, montant: 0 }, servis: 0 }]);
  assert.equal(r.borne, 0);
  assert.equal(r.sansNom, 0);
  assert.deepEqual(r.mobileMoney, { nombre: 0, montant: 0 });
});
