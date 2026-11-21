// La réserve de démonstration (lot 2 des besoins, 21/11/2026, « Oui, pour la démo » du propriétaire) : des livraisons
// payées au Marché d'Adjamé, notées par la cantine de démonstration, avec leur dépense dans la comptabilité (catégorie
// « ingredients »), et un comptage d'oignons. Ce sont des chiffres de démonstration, comme les personnes et les repas
// de `npm run demo` : à couper pour un vrai service.
//
//   node scripts/stock-demo.mts        (après `npm run demo`, ou seul : il remet la réserve de démonstration à neuf)
//
// Il retire d'abord la réserve et les dépenses de livraison de démonstration déjà là (reconnues à leur fournisseur et
// à qui les a notées) : on peut le relancer sans doublon. Les autres dépenses ne bougent pas.
import { PrismaClient } from "@prisma/client";
import type { Unite } from "../src/lib/besoins.ts";
import { COMPTES_DEMO } from "../src/lib/demo.ts";
import { ajouterJours, jourIso } from "../src/lib/jours.ts";
import { libelleLivraison } from "../src/lib/stock.ts";

const prisma = new PrismaClient();
const FOURNISSEUR = "Marché d'Adjamé";
const NOTEE_PAR = COMPTES_DEMO.admin.nom;
const aujourdhui = jourIso(Date.now());
const ilYa = (n: number) => ajouterJours(aujourdhui, -n);

/** [ingrédient, quantité dans son unité, prix payé en F CFA, il y a combien de jours] */
const LIVRAISONS: [string, number, number, number][] = [
  ["Riz", 25_000, 15_000, 4],
  ["Riz", 25_000, 16_250, 1],
  ["Attiéké", 10_000, 5_000, 1],
  ["Banane plantain", 60, 7_500, 2],
  ["Bœuf", 8_000, 28_000, 2],
  ["Huile", 10_000, 14_000, 4],
  ["Igname", 25_000, 10_000, 2],
  ["Oignon", 15_000, 9_000, 4],
  ["Poisson", 6_000, 13_200, 1],
  ["Poulet", 5_000, 14_000, 1],
  ["Pâte d'arachide", 3_000, 6_000, 4],
  ["Tomate", 12_000, 10_800, 1],
  ["Œuf", 90, 9_000, 2],
];

// 1. La réserve et les dépenses de livraison de démonstration d'avant, pour repartir à neuf.
const avant = await prisma.mouvementStock.findMany({ select: { depenseId: true } });
const depensesLiees = avant.map((m) => m.depenseId).filter((id): id is string => id !== null);
await prisma.$transaction([
  prisma.depense.deleteMany({ where: { OR: [{ id: { in: depensesLiees } }, { categorie: "ingredients", fournisseur: FOURNISSEUR, noteePar: NOTEE_PAR, libelle: { startsWith: "Livraison : " } }] } }),
  prisma.mouvementStock.deleteMany(),
]);

// 2. Les livraisons, chacune avec sa dépense, comme le fait la page (src/lib/operations.ts, livrerIngredient).
const ingredients = new Map((await prisma.ingredient.findMany({ select: { id: true, nom: true, unite: true } })).map((i) => [i.nom, i]));
let livrees = 0;
let depense = 0;
for (const [nom, quantite, prix, jours] of LIVRAISONS) {
  const i = ingredients.get(nom);
  if (!i) { console.log(`Ingrédient absent, livraison sautée : ${nom}`); continue; }
  const jour = ilYa(jours);
  await prisma.$transaction(async (tx) => {
    const d = await tx.depense.create({
      data: { jour, categorie: "ingredients", libelle: libelleLivraison(nom, quantite, i.unite as Unite), montant: prix, fournisseur: FOURNISSEUR, moyen: "especes", noteePar: NOTEE_PAR },
    });
    await tx.mouvementStock.create({ data: { ingredientId: i.id, genre: "livraison", quantite, jour, prix, depenseId: d.id, note: FOURNISSEUR, noteePar: NOTEE_PAR } });
  });
  livrees += 1;
  depense += prix;
}

// 3. Un comptage d'oignons, hier : un kilo de moins que prévu.
const oignon = ingredients.get("Oignon");
if (oignon) await prisma.mouvementStock.create({ data: { ingredientId: oignon.id, genre: "inventaire", quantite: -1_000, jour: ilYa(1), noteePar: NOTEE_PAR } });

console.log(`Réserve de démonstration prête : ${livrees} livraisons, ${depense.toLocaleString("fr-FR")} F CFA de dépenses « ingrédients », un comptage.`);
await prisma.$disconnect();
