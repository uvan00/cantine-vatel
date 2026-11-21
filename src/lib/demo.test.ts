// Essais du mode démonstration : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rolesDemo } from "./demo.ts";

test("sur un serveur en ligne, aucun bouton n'ouvre un compte de la cantine", () => {
  assert.deepEqual(rolesDemo(true), ["convive", "parent"]);
});

test("sur un ordinateur de développement, les quatre comptes de démonstration s'essaient en un clic", () => {
  assert.deepEqual(rolesDemo(false), ["convive", "parent", "responsable", "admin"]);
});
