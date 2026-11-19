// Essais de la recherche d'un convive par son nom : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chercher, rang, simplifier } from "./recherche.ts";

test("un nom se compare sans majuscules, sans accents et sans apostrophe", () => {
  assert.equal(simplifier("Aïcha N'Guessan"), "aicha nguessan");
  assert.equal(simplifier("  Stéphane   KONÉ "), "stephane kone");
  assert.equal(simplifier("Jean-Marc"), "jean marc");
});

test("chaque mot tapé doit se trouver dans le nom", () => {
  assert.equal(rang("Aïcha Koné", "aicha"), 0);
  assert.equal(rang("Fatou N'Guessan", "nguessan"), 0);
  assert.equal(rang("Fatou N'Guessan", "n'gue fa"), 0);
  assert.equal(rang("Moussa Bakayoko", "yoko"), 1);
  assert.equal(rang("Moussa Bakayoko", "kone"), null);
  assert.equal(rang("Moussa Bakayoko", "moussa kone"), null);
  assert.equal(rang("Moussa Bakayoko", "   "), null);
});

test("les noms qui commencent par ce qui est tapé passent devant, puis l'alphabet décide", () => {
  const liste = ["Moussa Bakayoko", "Yves Koné", "Awa Koné", "Koffi Yao", "Serge Aka"].map((nom) => ({ nom }));
  assert.deepEqual(chercher(liste, "ko", 8).map((c) => c.nom), ["Awa Koné", "Koffi Yao", "Yves Koné", "Moussa Bakayoko"]);
  assert.deepEqual(chercher(liste, "ko", 2).map((c) => c.nom), ["Awa Koné", "Koffi Yao"]);
  assert.deepEqual(chercher(liste, "", 8), []);
});
