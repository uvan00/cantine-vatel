// Essai des routes du parent et de la recharge de l'application mobile (src/app/api/mobile/parent/** et
// src/app/api/mobile/recharge/**) contre un serveur qui tourne, par défaut la copie d'essai sur http://localhost:3711.
// Se connecte comme Mariam (parent de démonstration) puis comme Awa (convive), et joue chaque route. Les recharges
// créées sont annulées à la fin, le profil, le seuil et le plafond remis comme avant : à lancer sur une copie de la
// base, jamais sur la vraie. Aucun paiement en ligne n'est déclenché (la copie n'a pas de clé Cartflox).
// Le mot de passe de démonstration se lit dans le README au lancement : il n'est pas écrit ici.
// Lancer : node scripts/essai-mobile-parent.mjs  (ADRESSE=http://localhost:3711 par défaut)
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const ADRESSE = process.env.ADRESSE || "http://localhost:3711";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const motDePasse = (courriel) => {
  const ligne = readme.split("\n").find((l) => l.includes(`\`${courriel}\``));
  const m = ligne?.match(/`[^`]+@[^`]+`\s*\|\s*`([^`]+)`/);
  if (!m) throw new Error(`Mot de passe de ${courriel} introuvable dans le README`);
  return m[1];
};

let echecs = 0;
const verdict = (ok, etape, detail = "") => {
  if (!ok) echecs++;
  console.log(`${ok ? "OK    " : "ÉCHEC "} ${etape}${detail ? `  (${detail})` : ""}`);
};

async function appel(chemin, { jeton, corps } = {}) {
  const enTetes = {};
  if (jeton) enTetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) enTetes["Content-Type"] = "application/json";
  const r = await fetch(`${ADRESSE}/api/mobile${chemin}`, { method: corps !== undefined ? "POST" : "GET", headers: enTetes, body: corps !== undefined ? JSON.stringify(corps) : undefined });
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch { /* pas du JSON */ }
  return { status: r.status, json };
}

const connexion = async (email) => (await appel("/connexion", { corps: { email, motDePasse: motDePasse(email) } })).json?.jeton ?? null;

// 1. Connexion du parent, et ce qu'on refuse
const jeton = await connexion("mariam@cantine.test");
verdict(Boolean(jeton), "connexion du parent de démonstration");
if (!jeton) process.exit(1);
const sansJeton = await appel("/parent");
verdict(sansJeton.status === 401, "enfants sans jeton : 401", sansJeton.json?.erreur);
const jetonAwa = await connexion("awa@cantine.test");
const conviveSurParent = await appel("/parent", { jeton: jetonAwa });
verdict(conviveSurParent.status === 403, "espace parent avec le jeton d'un convive : 403", conviveSurParent.json?.erreur);

// 2. Les enfants
const accueil = await appel("/parent", { jeton });
const enfants = accueil.json?.enfants ?? [];
verdict(accueil.status === 200 && enfants.length >= 2 && enfants.every((e) => typeof e.solde === "number" && Array.isArray(e.semaine)), "enfants du parent",
  enfants.map((e) => `${e.prenom} ${e.solde} F${e.soldeBas ? " (solde bas)" : ""}, ${e.semaine.length} jours`).join(" ; "));
// Ce que chaque enfant ne mange pas, en étiquettes (un dessin et un nom)
const estEtiquette = (e) => typeof e?.id === "string" && typeof e?.nom === "string" && e.nom.length > 0 && /^\/allergenes\/[a-z-]+\.webp$/.test(e?.image ?? "");
verdict(enfants.every((e) => Array.isArray(e.neMangePas) && e.neMangePas.every(estEtiquette)), "chaque enfant dit ce qu'il ne mange pas",
  enfants.map((e) => `${e.prenom} : ${e.neMangePas?.map((x) => x.nom).join(", ") || "rien"}`).join(" ; "));
const enfant = enfants[0];
if (!enfant) { console.log("Sans enfant, rien d'autre ne peut s'essayer"); process.exit(1); }

// 3. La fiche d'un enfant
const fiche = await appel(`/parent/enfant/${enfant.id}`, { jeton });
verdict(fiche.status === 200 && fiche.json?.nom === enfant.nom && Array.isArray(fiche.json?.aVenir) && Array.isArray(fiche.json?.historique), "fiche d'un enfant",
  `${fiche.json?.aVenir?.length} à venir, ${fiche.json?.passes?.length} passés, ${fiche.json?.historique?.length} mouvements, seuil ${fiche.json?.seuil}`);
const avant = fiche.json;
const choixOk = (liste, nombre) => Array.isArray(liste) && liste.length === nombre && liste.every(estEtiquette);
verdict(choixOk(avant?.allergenes, 14) && choixOk(avant?.regimes, 2), "fiche : 14 allergènes et 2 régimes, chacun avec son dessin");
verdict(Array.isArray(avant?.neMangePas) && avant.neMangePas.every(estEtiquette)
  && avant.neMangePas.length === avant.profil.allergenes.length + avant.profil.regimes.length
  && JSON.stringify(avant.neMangePas.map((e) => e.id)) === JSON.stringify(enfant.neMangePas.map((e) => e.id)),
  "fiche : ce qu'il ne mange pas, comme sur la liste des enfants", avant?.neMangePas?.map((e) => e.nom).join(", ") || "rien");

// 4. Profil alimentaire, seuil, plafond (puis remis comme avant)
const profil = await appel("/parent/profil", { jeton, corps: { enfantId: enfant.id, allergenes: [...avant.profil.allergenes], regimes: [...avant.profil.regimes] } });
verdict(profil.status === 200, "profil alimentaire enregistré", profil.json?.message ?? profil.json?.erreur);
const profilFaux = await appel("/parent/profil", { jeton, corps: { enfantId: enfant.id, allergenes: ["pas-un-allergene"], regimes: [] } });
verdict(profilFaux.status === 409, "allergène hors liste refusé", profilFaux.json?.erreur);
const seuil = await appel("/parent/seuil", { jeton, corps: { enfantId: enfant.id, seuil: "3 000" } });
const relu = await appel(`/parent/enfant/${enfant.id}`, { jeton });
verdict(seuil.status === 200 && relu.json?.seuil === 3000, "seuil d'alerte réglé à 3 000", seuil.json?.message ?? seuil.json?.erreur);
const seuilFaux = await appel("/parent/seuil", { jeton, corps: { enfantId: enfant.id, seuil: "999999" } });
verdict(seuilFaux.status === 409, "seuil trop haut refusé", seuilFaux.json?.erreur);
await appel("/parent/seuil", { jeton, corps: { enfantId: enfant.id, seuil: String(avant.seuil) } });
const plafond = await appel("/parent/plafond", { jeton, corps: { enfantId: enfant.id, plafond: 20000 } });
verdict(plafond.status === 200, "plafond de la semaine réglé", plafond.json?.message ?? plafond.json?.erreur);
const plafondFaux = await appel("/parent/plafond", { jeton, corps: { enfantId: enfant.id, plafond: 10 } });
verdict(plafondFaux.status === 409, "plafond trop bas refusé", plafondFaux.json?.erreur);
await appel("/parent/plafond", { jeton, corps: { enfantId: enfant.id, plafond: avant.plafond.plafond } });

// 5. Transfert : seulement des refus, pour ne rien écrire dans le journal
const [a, b] = enfants;
const trop = await appel("/parent/transfert", { jeton, corps: { deId: a.id, versId: b.id, montant: a.solde + 100_000 } });
verdict(trop.status === 409, "transfert plus grand que le solde refusé", trop.json?.erreur);
const meme = await appel("/parent/transfert", { jeton, corps: { deId: a.id, versId: a.id, montant: 100 } });
verdict(meme.status === 409, "transfert vers le même enfant refusé", meme.json?.erreur);

// 6. Relier un code faux
const lier = await appel("/parent/lier", { jeton, corps: { code: "ZZZZZ9" } });
verdict(lier.status === 409 && typeof lier.json?.erreur === "string", "code famille faux refusé", lier.json?.erreur);

// 7. Un parent qui vise l'enfant d'un autre : un convive qui n'est pas relié à Mariam
const prisma = new PrismaClient();
const moiParent = accueil.json?.moi;
const etranger = await prisma.user.findFirst({ where: { role: "convive", profil: { isNot: null }, parents: { none: { parentId: moiParent.id } } }, select: { id: true } });
await prisma.$disconnect();
if (etranger) {
  const ficheAutre = await appel(`/parent/enfant/${etranger.id}`, { jeton });
  verdict(ficheAutre.status === 403, "fiche de l'enfant d'un autre : 403", ficheAutre.json?.erreur);
  const seuilAutre = await appel("/parent/seuil", { jeton, corps: { enfantId: etranger.id, seuil: "0" } });
  verdict(seuilAutre.status === 403, "seuil de l'enfant d'un autre : 403", seuilAutre.json?.erreur);
  const rechargeAutre = await appel("/recharge", { jeton, corps: { pour: etranger.id, montant: "2000" } });
  verdict(rechargeAutre.status === 403, "recharge de l'enfant d'un autre : 403", rechargeAutre.json?.erreur);
} else verdict(false, "un convive qui n'est pas l'enfant de Mariam", "introuvable dans la base");

// 8. La recharge par QR : demander, relire, annuler. La base peut déjà porter 3 demandes de Mariam en attente (la
// limite) : on n'annule jamais ce que l'essai n'a pas créé ; on joue alors le parcours avec Awa, qui recharge son compte.
const crees = [];
const page = await appel(`/recharge?pour=${enfant.id}`, { jeton });
verdict(page.status === 200 && page.json?.choisi === enfant.id && page.json?.min > 0 && page.json?.montantsRapides?.length > 0, "page de recharge, enfant choisi d'avance",
  `de ${page.json?.min} à ${page.json?.max}, ${page.json?.enAttente?.length} en attente`);
const horsBornes = await appel("/recharge", { jeton, corps: { pour: enfant.id, montant: "50" } });
verdict(horsBornes.status === 400, "montant sous le minimum refusé", horsBornes.json?.erreur);

// 9. La limite des recharges en attente (3 par personne) : on demande jusqu'au refus, en gardant la première créée
let refusLimite = null;
for (let i = 0; i < 4 && !refusLimite; i++) {
  const d = await appel("/recharge", { jeton, corps: { pour: enfant.id, montant: i === 0 ? "2 000" : "500" } });
  if (d.status === 200) crees.push(d.json.id);
  else refusLimite = d;
}
verdict(refusLimite?.status === 409 && /en attente/.test(refusLimite?.json?.erreur ?? ""), "limite des recharges en attente", refusLimite?.json?.erreur ?? "jamais refusée");

const parent = crees.length > 0;
const qui = parent ? { jeton, autre: jetonAwa, nom: "le parent" } : { jeton: jetonAwa, autre: jeton, nom: "Awa (Mariam est déjà à la limite)" };
const demande = parent ? { status: 200, json: { id: crees[0] } } : await appel("/recharge", { jeton: jetonAwa, corps: { pour: "", montant: "2000" } });
verdict(demande.status === 200 && typeof demande.json?.id === "string", `demander une recharge par QR, par ${qui.nom}`, demande.json?.id ?? demande.json?.erreur);
if (demande.json?.id) {
  const id = demande.json.id;
  if (!parent) crees.push(id);
  const r = await appel(`/recharge/${id}`, { jeton: qui.jeton });
  verdict(r.status === 200 && r.json?.etat === "en_attente" && r.json?.cartflox === null, "page de la recharge, sans paiement en ligne dans la copie",
    `${r.json?.reference}, ${r.json?.libelleEtat}, QR ${r.json?.qr ? `fabriqué (${r.json.qr.length} caractères de SVG)` : "absent (pas d'adresse PI-SPI)"}`);
  const ouvrir = await appel(`/recharge/${id}/ouvrir`, { jeton: qui.jeton, corps: {} });
  verdict(ouvrir.status === 409, "ouvrir le paiement en ligne sans clés : refus calme", ouvrir.json?.erreur);
  const etat = await appel(`/recharge/${id}/etat`, { jeton: qui.jeton });
  verdict(etat.status === 200 && etat.json?.etat === "en_attente" && typeof etat.json?.solde === "number", "état relu en direct", `${etat.json?.etat}, solde ${etat.json?.solde}`);
  const annulerAutre = await appel(`/recharge/${id}/annuler`, { jeton: qui.autre, corps: {} });
  verdict(annulerAutre.status !== 200, "seul celui qui l'a demandée l'annule", `${annulerAutre.status}, ${annulerAutre.json?.erreur}`);
  const annuler = await appel(`/recharge/${id}/annuler`, { jeton: qui.jeton, corps: {} });
  const apres = await appel(`/recharge/${id}/etat`, { jeton: qui.jeton });
  verdict(annuler.status === 200 && apres.json?.etat === "annulee", "annuler la demande", apres.json?.etat);
  const encore = await appel(`/recharge/${id}/annuler`, { jeton: qui.jeton, corps: {} });
  verdict(encore.status === 409, "une demande annulée ne s'annule plus", encore.json?.erreur);
}

// 10. Un convive qui recharge son propre compte
const awaPage = await appel("/recharge", { jeton: jetonAwa });
verdict(awaPage.status === 200 && awaPage.json?.comptes?.length === 1 && awaPage.json?.parent === false, "page de recharge du convive", awaPage.json?.comptes?.[0]?.detail);
const awaDemande = await appel("/recharge", { jeton: jetonAwa, corps: { pour: "", montant: "5000" } });
verdict(awaDemande.status === 200, "le convive demande une recharge pour lui", awaDemande.json?.id ?? awaDemande.json?.erreur);
if (awaDemande.json?.id) {
  const r = await appel(`/recharge/${awaDemande.json.id}`, { jeton: jetonAwa });
  verdict(r.json?.titre === "Recharge de ton compte" && r.json?.aMoi === true, "sa recharge est la sienne", r.json?.titre);
  const annuler = await appel(`/recharge/${awaDemande.json.id}/annuler`, { jeton: jetonAwa, corps: {} });
  verdict(annuler.status === 200, "le convive annule sa demande");
}

// Ménage : les demandes encore en attente créées par cet essai sont annulées (et seulement elles)
for (const id of crees) for (const j of [jeton, jetonAwa]) await appel(`/recharge/${id}/annuler`, { jeton: j, corps: {} });
await appel("/deconnexion", { jeton, corps: {} });
await appel("/deconnexion", { jeton: jetonAwa, corps: {} });

console.log(echecs === 0 ? "\nTout est passé" : `\n${echecs} étape(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
