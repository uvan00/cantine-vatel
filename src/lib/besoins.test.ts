// Essais des besoins de la cuisine. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { besoinsDuJour, besoinsParRayon, detailDuBesoin, imageIngredient, phraseAllergie, planDuPlat, quantiteLisible, rayonDe, refusFiche, restesParPlat } from "./besoins.ts";

/** toLocaleString met des espaces insécables : on compare sans aucune espace. */
const serre = (s: string) => s.replace(/\s/g, "");

test("les besoins du jour : la quantité par portion multipliée par les réservations, additionnée sur les plats", () => {
  const r = besoinsDuJour([
    { platId: "kedjenou", nom: "Kedjenou", reservations: 30, lignes: [{ ingredientId: "riz", nom: "Riz", unite: "g", quantite: 120 }, { ingredientId: "poulet", nom: "Poulet", unite: "g", quantite: 200 }] },
    { platId: "riz-gras", nom: "Riz gras", reservations: 10, lignes: [{ ingredientId: "riz", nom: "Riz", unite: "g", quantite: 150 }] },
    { platId: "alloco", nom: "Alloco", reservations: 0, lignes: [{ ingredientId: "banane", nom: "Banane plantain", unite: "piece", quantite: 1 }] },
  ]);
  assert.deepEqual(r.besoins.map((b) => [b.nom, b.total]), [["Poulet", 6000], ["Riz", 5100]]);
  assert.deepEqual(r.besoins.find((b) => b.nom === "Riz")?.plats, ["Kedjenou", "Riz gras"]);
  assert.deepEqual(r.sansFiche, []);
});

test("un plat réservé sans fiche recette est signalé, un plat sans réservation ne compte pas", () => {
  const r = besoinsDuJour([
    { platId: "garba", nom: "Garba", reservations: 12, lignes: [] },
    { platId: "attieke", nom: "Attiéké", reservations: 0, lignes: [] },
  ]);
  assert.deepEqual(r.besoins, []);
  assert.deepEqual(r.sansFiche, ["Garba"]);
});

test("les quantités se lisent en kilos, en litres ou en pièces", () => {
  assert.equal(serre(quantiteLisible(12500, "g")), "12,5kg");
  assert.equal(serre(quantiteLisible(850, "g")), "850g");
  assert.equal(serre(quantiteLisible(3200, "ml")), "3,2l");
  assert.equal(serre(quantiteLisible(45, "piece")), "45pièces");
  assert.equal(serre(quantiteLisible(1, "piece")), "1pièce");
});

test("une fiche recette : des noms, des unités connues, des quantités entières, sans doublon", () => {
  assert.equal(refusFiche([{ nom: "Riz", unite: "g", quantite: 120 }]), null);
  assert.match(refusFiche([{ nom: " ", unite: "g", quantite: 120 }]) ?? "", /nom/);
  assert.match(refusFiche([{ nom: "Riz", unite: "kg", quantite: 120 }]) ?? "", /unité/);
  assert.match(refusFiche([{ nom: "Riz", unite: "g", quantite: 0 }]) ?? "", /quantité/);
  assert.match(refusFiche([{ nom: "Riz", unite: "g", quantite: 1 }, { nom: "riz", unite: "g", quantite: 2 }]) ?? "", /déjà/);
});

test("chaque besoin garde la part de chaque plat, et son détail se lit plat par plat", () => {
  const r = besoinsDuJour([
    { platId: "riz-arachide", nom: "Riz sauce arachide", reservations: 9, lignes: [{ ingredientId: "riz", nom: "Riz", unite: "g", quantite: 120 }] },
    { platId: "kedjenou", nom: "Kedjenou", reservations: 11, lignes: [{ ingredientId: "riz", nom: "Riz", unite: "g", quantite: 120 }, { ingredientId: "poulet", nom: "Poulet", unite: "g", quantite: 250 }] },
  ]);
  const riz = r.besoins.find((b) => b.nom === "Riz")!;
  assert.deepEqual(riz.parPlat, [{ nom: "Riz sauce arachide", total: 1080 }, { nom: "Kedjenou", total: 1320 }]);
  assert.equal(serre(detailDuBesoin(riz)), serre("Riz sauce arachide 1,08 kg, Kedjenou 1,32 kg"));
  // Un seul plat : son nom suffit.
  assert.equal(detailDuBesoin(r.besoins.find((b) => b.nom === "Poulet")!), "Kedjenou");
});

test("chaque ingrédient trouve son rayon, l'épicerie avant les légumes, un mot entier seulement", () => {
  assert.equal(rayonDe("Bœuf"), "Viandes et poissons");
  assert.equal(rayonDe("Poisson"), "Viandes et poissons");
  assert.equal(rayonDe("Poulet"), "Viandes et poissons");
  for (const f of ["Riz", "Attiéké", "Igname", "Banane plantain", "Pâtes"]) assert.equal(rayonDe(f), "Féculents", f);
  for (const l of ["Tomate", "Oignons", "Gombo"]) assert.equal(rayonDe(l), "Légumes", l);
  assert.equal(rayonDe("Huile"), "Épicerie");
  assert.equal(rayonDe("Pâte d'arachide"), "Épicerie");
  assert.equal(rayonDe("Concentré de tomate"), "Épicerie");
  assert.equal(rayonDe("Œuf"), "Œufs et laitiers");
  assert.equal(rayonDe("Chorizo"), "Autres");
});

test("la liste de sortie se range par rayon, dans l'ordre de la réserve, sans rayon vide", () => {
  const { besoins } = besoinsDuJour([{ platId: "x", nom: "X", reservations: 2, lignes: [
    { ingredientId: "huile", nom: "Huile", unite: "ml", quantite: 10 },
    { ingredientId: "riz", nom: "Riz", unite: "g", quantite: 100 },
    { ingredientId: "boeuf", nom: "Bœuf", unite: "g", quantite: 120 },
  ] }]);
  assert.deepEqual(besoinsParRayon(besoins).map((g) => [g.rayon, g.besoins.map((b) => b.nom)]), [
    ["Viandes et poissons", ["Bœuf"]], ["Féculents", ["Riz"]], ["Épicerie", ["Huile"]],
  ]);
});

test("le plan de production multiplie la fiche par les portions réservées", () => {
  const plan = planDuPlat({ platId: "k", nom: "Kedjenou", reservations: 7, lignes: [{ ingredientId: "poulet", nom: "Poulet", unite: "g", quantite: 250 }] });
  assert.equal(plan.portions, 7);
  assert.deepEqual(plan.lignes, [{ ingredientId: "poulet", nom: "Poulet", unite: "g", parPortion: 250, total: 1750 }]);
  assert.deepEqual(planDuPlat({ platId: "g", nom: "Garba", reservations: 0, lignes: [] }), { portions: 0, lignes: [] });
});

test("l'image d'un ingrédient se trouve d'après son nom, au singulier comme au pluriel", () => {
  assert.equal(imageIngredient("Pâte d'arachide"), "/ingredients/pate-d-arachide.webp");
  assert.equal(imageIngredient("Œuf"), "/ingredients/oeuf.webp");
  assert.equal(imageIngredient("Tomates"), "/ingredients/tomate.webp");
  assert.equal(imageIngredient("Gombo"), null);
});

test("l'alerte allergies se dit au singulier et au pluriel", () => {
  assert.equal(phraseAllergie({ allergene: "arachide", plats: ["Riz sauce arachide"], convives: 2 }, "demain"),
    "dans Riz sauce arachide. 2 convives allergiques mangent demain : leurs plats à l'écart");
  assert.equal(phraseAllergie({ allergene: "poisson", plats: ["Attiéké poisson", "Placali"], convives: 1 }, "aujourd'hui"),
    "dans Attiéké poisson et Placali. 1 convive allergique mange aujourd'hui : son plat à l'écart");
});

test("les restes moyens d'un plat additionnent ses pesées ; sans pesée ni repas servi, il n'y est pas", () => {
  const r = restesParPlat([
    { platId: "riz", nom: "Riz", restes: 900, servis: 6 },
    { platId: "riz", nom: "Riz", restes: 300, servis: 4 },
    { platId: "garba", nom: "Garba", restes: null, servis: 10 },
    { platId: "alloco", nom: "Alloco", restes: 200, servis: 0 },
  ]);
  assert.deepEqual([...r.entries()], [["riz", 120]]);
});
