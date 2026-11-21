// Essais des durées écrites en mots : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { depuis } from "./format.ts";

const T0 = Date.UTC(2026, 10, 21, 12, 0);
const ilYA = (minutes: number) => depuis(new Date(T0 - minutes * 60_000), T0);

test("une attente se lit en minutes, puis en heures, puis en jours", () => {
  assert.equal(ilYA(0), "à l'instant");
  assert.equal(ilYA(4), "il y a 4 min");
  assert.equal(ilYA(65), "il y a 1 h 05");
  assert.equal(ilYA(23 * 60 + 59), "il y a 23 h 59");
  assert.equal(ilYA(24 * 60), "il y a 1 jour");
  assert.equal(ilYA(34 * 60 + 4), "il y a 1 jour");
  assert.equal(ilYA(3 * 24 * 60 + 10), "il y a 3 jours");
});
