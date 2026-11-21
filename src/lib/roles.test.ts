import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CANTINE, RESERVE_A_L_ADMIN, accueilDe, estCantine, lireRole, peutOuvrir } from "./roles.ts";

test("le responsable ouvre le comptoir", () => {
  for (const p of ["/admin", "/admin/scanner", "/admin/commandes", "/admin/commandes?jour=demain", "/admin/recharges", "/admin/non-retires", "/admin/plus", "/borne", "/feuille/aujourdhui"]) {
    assert.equal(peutOuvrir("responsable", p), true, p);
  }
});

test("le responsable n'ouvre ni l'argent de la cantine, ni les menus, ni les réglages", () => {
  for (const p of RESERVE_A_L_ADMIN) {
    assert.equal(peutOuvrir("responsable", p), false, p);
    assert.equal(peutOuvrir("responsable", `${p}/autre`), false, `${p}/autre`);
    assert.equal(peutOuvrir("responsable", `${p}?p=mois`), false, `${p}?p=mois`);
  }
  // Une adresse qui commence pareil sans être la page n'est pas confondue avec elle.
  assert.equal(peutOuvrir("responsable", "/admin/menusx"), true);
});

test("l'admin ouvre tout ; le convive et le parent, rien de la cantine", () => {
  for (const p of ["/admin", ...RESERVE_A_L_ADMIN, "/borne"]) assert.equal(peutOuvrir("admin", p), true, p);
  for (const role of ["convive", "parent"] as const) assert.equal(peutOuvrir(role, "/admin/scanner"), false, role);
});

test("un rôle inconnu ne donne que les droits d'un convive", () => {
  assert.equal(lireRole("responsable"), "responsable");
  assert.equal(lireRole("admin"), "admin");
  assert.equal(lireRole("chef"), "convive");
  assert.equal(lireRole(null), "convive");
  assert.equal(lireRole(undefined), "convive");
});

test("les deux rôles de la cantine arrivent sur le tableau de bord", () => {
  assert.deepEqual(CANTINE, ["admin", "responsable"]);
  assert.equal(estCantine("responsable"), true);
  assert.equal(estCantine("parent"), false);
  assert.equal(accueilDe("admin"), "/admin");
  assert.equal(accueilDe("responsable"), "/admin");
  assert.equal(accueilDe("parent"), "/parent");
  assert.equal(accueilDe("convive"), "/menu");
});
