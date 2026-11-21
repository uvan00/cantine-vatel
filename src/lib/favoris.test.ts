// Essais des favoris et du badge « Nouveau ». `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estNouveau, favoriAuMenu } from "./favoris.ts";

test("un plat est « Nouveau » pendant 14 jours", () => {
  const maintenant = Date.parse("2026-11-21T12:00:00Z");
  assert.equal(estNouveau("2026-11-15T12:00:00Z", maintenant), true);
  assert.equal(estNouveau("2026-11-07T11:00:00Z", maintenant), false);
});

test("le premier jour où un favori revient au menu", () => {
  const jours = [
    { jour: "2026-11-25", plats: [{ platId: "garba", nom: "Garba" }] },
    { jour: "2026-11-23", plats: [{ platId: "riz", nom: "Riz gras" }] },
    { jour: "2026-11-24", plats: [{ platId: "garba", nom: "Garba" }, { platId: "alloco", nom: "Alloco" }] },
  ];
  assert.deepEqual(favoriAuMenu(jours, new Set(["garba"])), { jour: "2026-11-24", nom: "Garba" });
  assert.equal(favoriAuMenu(jours, new Set(["attieke"])), null);
});
