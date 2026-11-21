// Essais des messages de la cantine. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pourQui, refusMessage } from "./messages.ts";

test("un message part avec un titre, un texte et ses destinataires", () => {
  assert.equal(refusMessage({ titre: "Menu de fête", texte: "Vendredi, garba pour tout le monde", cible: "tous" }), null);
  assert.match(refusMessage({ titre: " ", texte: "x", cible: "tous" }) ?? "", /titre/);
  assert.match(refusMessage({ titre: "x", texte: "", cible: "tous" }) ?? "", /Écris/);
  assert.match(refusMessage({ titre: "x".repeat(81), texte: "x", cible: "tous" }) ?? "", /80/);
  assert.match(refusMessage({ titre: "x", texte: "x", cible: "voisins" }) ?? "", /qui/);
});

test("chaque message arrive à ceux qu'il vise, jamais à la cantine elle-même", () => {
  const eleve = { role: "convive" as const, reserveCetteSemaine: false };
  const parent = { role: "parent" as const, reserveCetteSemaine: true };
  assert.equal(pourQui("tous", eleve), true);
  assert.equal(pourQui("convives", eleve), true);
  assert.equal(pourQui("parents", eleve), false);
  assert.equal(pourQui("parents", parent), true);
  assert.equal(pourQui("semaine", eleve), false);
  assert.equal(pourQui("semaine", parent), true);
  assert.equal(pourQui("tous", { role: "admin", reserveCetteSemaine: true }), false);
});
