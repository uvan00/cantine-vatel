// Essais des avatars dessinés : seules leurs adresses s'écrivent sur un compte. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AVATARS, avatarPermis } from "./avatars.ts";

test("seize avatars, tous différents, rangés dans public/avatars", () => {
  assert.equal(AVATARS.length, 16);
  assert.equal(new Set(AVATARS).size, 16);
  assert.equal(AVATARS[0], "/avatars/01.webp");
  assert.equal(AVATARS[15], "/avatars/16.webp");
});

test("seule l'adresse d'un avatar dessiné passe : pas d'autre fichier, pas d'adresse extérieure", () => {
  assert.equal(avatarPermis("/avatars/07.webp"), true);
  // Le 17 est le visage de la responsable de démonstration : il ne se choisit pas.
  assert.equal(avatarPermis("/avatars/17.webp"), false);
  assert.equal(avatarPermis("/avatars/../plats/attieke.jpg"), false);
  assert.equal(avatarPermis("https://exemple.com/avatars/01.webp"), false);
  assert.equal(avatarPermis("/avatars/7.webp"), false);
  assert.equal(avatarPermis(""), false);
});
