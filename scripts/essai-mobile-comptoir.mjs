// Essai des routes du comptoir de l'application mobile (src/app/api/mobile/comptoir/**) contre un serveur qui tourne,
// par défaut la copie d'essai sur http://localhost:3711. Se connecte comme Aminata (la cantine), sert un ticket
// d'aujourd'hui, confirme une recharge demandée pour l'essai par Mariam (le parent) : à lancer sur une copie de la base,
// jamais sur la vraie. Les mots de passe de démonstration se lisent dans le README au lancement : ils ne sont pas ici.
// La recharge du parent passe par la route de l'application (/api/mobile/recharge), avec le jeton du parent.
// Lancer : node scripts/essai-mobile-comptoir.mjs  (ADRESSE=http://localhost:3711 par défaut)
import { readFileSync } from "node:fs";

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
const saute = (etape, raison) => console.log(`SAUTÉ  ${etape}  (${raison})`);

async function appel(chemin, { jeton, corps, brut } = {}) {
  const enTetes = {};
  if (jeton) enTetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined || brut !== undefined) enTetes["Content-Type"] = "application/json";
  const r = await fetch(`${ADRESSE}/api/mobile${chemin}`, {
    method: corps !== undefined || brut !== undefined ? "POST" : "GET",
    headers: enTetes,
    body: brut ?? (corps !== undefined ? JSON.stringify(corps) : undefined),
  });
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch { /* pas du JSON */ }
  return { status: r.status, json };
}

/** Une liste d'étiquettes d'allergènes bien formée : un dessin et un nom, des allergènes seulement (pas de régime). */
const REGIMES = ["sans-porc", "vegetarien", "porc"];
const etiquettesValables = (liste) => Array.isArray(liste) && liste.every((e) =>
  typeof e?.id === "string" && typeof e?.nom === "string" && typeof e?.image === "string" && e.image.startsWith("/allergenes/") && !REGIMES.includes(e.id));
const ids = (liste) => (liste ?? []).map((e) => e.id).join(",");

const connexion = (email) => appel("/connexion", { corps: { email, motDePasse: motDePasse(email) } });

// 1. Qui entre au comptoir
const aminata = await connexion("cantine@cantine.test");
verdict(aminata.status === 200 && aminata.json?.moi?.role === "admin", "connexion de la cantine", `${aminata.status}, rôle ${aminata.json?.moi?.role}`);
const jeton = aminata.json?.jeton;
if (!jeton) { console.log("Sans jeton, rien d'autre ne peut s'essayer"); process.exit(1); }
const awa = await connexion("awa@cantine.test");
const jetonAwa = awa.json?.jeton;

const sansJeton = await appel("/comptoir/commandes");
verdict(sansJeton.status === 401, "commandes sans jeton : 401", sansJeton.json?.erreur);
for (const [chemin, corps] of [["/comptoir/commandes"], ["/comptoir/recharges"], ["/comptoir/servir", { cle: "ABCDEF" }], ["/comptoir/recharges/confirmer", { id: "x" }]]) {
  const r = await appel(chemin, { jeton: jetonAwa, corps });
  verdict(r.status === 403, `un convive sur ${chemin} : 403`, r.json?.erreur);
}

// 2. Les commandes
const commandes = await appel("/comptoir/commandes", { jeton });
const c = commandes.json;
verdict(commandes.status === 200 && Array.isArray(c?.plats) && typeof c?.service?.aServir === "number", "commandes du jour",
  `${c?.jourLong}, ${c?.plats?.length} plats, ${c?.service?.reserves} réservés, ${c?.service?.servis} servis, ${c?.service?.aServir} à servir`);
console.log(`       ${c?.phraseCloture}`);
const convivesDuJour = (c?.plats ?? []).flatMap((p) => p.convives);
verdict(convivesDuJour.every((x) => etiquettesValables(x.allergies)), "chaque convive des commandes porte ses allergies",
  `${convivesDuJour.filter((x) => x.allergies?.length > 0).length} allergiques sur ${convivesDuJour.length}`);
const demain = await appel("/comptoir/commandes?jour=demain", { jeton });
verdict(demain.status === 200 && demain.json?.cle === "demain", "commandes de demain", `${demain.json?.jourLong}, ${demain.json?.service?.reserves} réservés`);
verdict((demain.json?.plats ?? []).flatMap((p) => p.convives).every((x) => etiquettesValables(x.allergies)), "les convives de demain aussi");
const jourFaux = await appel("/comptoir/commandes?jour=hier", { jeton });
verdict(jourFaux.status === 400, "un jour qui ne se lit pas : 400", jourFaux.json?.erreur);

// 3. Un ticket d'aujourd'hui : Awa réserve si la base le permet, sinon un ticket déjà réservé pour aujourd'hui
const aujourdhui = c?.jour;
let cle = null;
let qui = "";
const menu = await appel(`/menu?jour=${aujourdhui}`, { jeton: jetonAwa });
if (menu.json?.repas?.etat === "reservee") {
  cle = `${ADRESSE}/ticket/${menu.json.repas.jeton}`;
  qui = `ticket d'Awa déjà réservé pour aujourd'hui, ${menu.json.repas.plat}`;
} else if (!menu.json?.repas) {
  const plat = (menu.json?.plats ?? []).find((p) => !p.refus);
  if (plat) {
    const creneau = menu.json?.creneaux?.find((x) => !x.complet)?.heure ?? null;
    const r = await appel("/reserver", { jeton: jetonAwa, corps: { menuJourId: plat.id, creneau } });
    verdict(r.status === 200 && typeof r.json?.jeton === "string", "Awa réserve pour aujourd'hui", r.json?.erreur ?? plat.nom);
    if (r.json?.jeton) { cle = `${ADRESSE}/ticket/${r.json.jeton}`; qui = `ticket d'Awa réservé à l'instant, ${plat.nom}`; }
  } else {
    saute("Awa réserve pour aujourd'hui", menu.json?.plats?.[0]?.refus?.phrase ?? "aucun plat ouvert");
  }
}
if (!cle) {
  // Le QR n'est pas lisible ici : le code court d'un convive encore à servir, tapé à la main comme au comptoir.
  const libre = (c?.plats ?? []).flatMap((p) => p.convives).find((x) => x.etat === "reservee");
  if (libre) { cle = libre.code; qui = `code tapé de ${libre.nom}`; }
}
if (cle) {
  console.log(`       ${qui}`);
  const servi = await appel("/comptoir/servir", { jeton, corps: { cle } });
  verdict(servi.status === 200 && servi.json?.genre === "servi", "servir ce ticket", `${servi.json?.phrase}, ${servi.json?.convive}, ${servi.json?.plat}${servi.json?.creneau ? `, passage à ${servi.json.creneau}` : ""}, ${servi.json?.service?.aServir} à servir`);
  verdict(etiquettesValables(servi.json?.allergies), "la réponse dit ses allergies", ids(servi.json?.allergies) || "aucune");
  // Awa (données de démonstration) a déclaré des allergènes : quand c'est son ticket, la réponse doit les dire.
  if (qui.includes("Awa")) verdict(servi.json?.allergies?.length > 0, "Awa est servie : ses allergies sont là", ids(servi.json?.allergies));
  const encore = await appel("/comptoir/servir", { jeton, corps: { cle } });
  verdict(encore.status === 200 && encore.json?.genre === "deja_servi", "le servir une deuxième fois : refusé en mots", encore.json?.phrase);
  const apres = await appel("/comptoir/commandes", { jeton });
  const vu = (apres.json?.plats ?? []).flatMap((p) => p.convives).find((x) => x.nom === servi.json?.convive && x.etat === "servie");
  verdict(!!vu, "les commandes le montrent servi", vu ? `${vu.libelleEtat} à ${vu.serviA}` : "absent");
  verdict(!!vu && ids(vu.allergies) === ids(servi.json?.allergies), "les mêmes allergies au scanner et dans les commandes", ids(vu?.allergies) || "aucune");
} else {
  saute("servir un ticket", "aucun ticket encore à servir aujourd'hui");
}
const inconnu = await appel("/comptoir/servir", { jeton, corps: { cle: "ZZZZZZ" } });
verdict(inconnu.status === 200 && inconnu.json?.genre === "inconnu", "un code inconnu : refusé en mots", inconnu.json?.phrase);
verdict(Array.isArray(inconnu.json?.allergies) && inconnu.json.allergies.length === 0, "personne d'identifié : allergies vides");
const illisible = await appel("/comptoir/servir", { jeton, corps: { cle: "bonjour" } });
verdict(illisible.json?.genre === "inconnu", "un QR qui n'est pas un ticket : refusé en mots", illisible.json?.phrase);
const corpsFaux = await appel("/comptoir/servir", { jeton, brut: "{pas du json" });
verdict(corpsFaux.status === 400, "un corps illisible refusé par zod : 400", corpsFaux.json?.erreur);

// 4. Les recharges
const avant = await appel("/comptoir/recharges", { jeton });
verdict(avant.status === 200 && Array.isArray(avant.json?.enAttente), "recharges en attente", `${avant.json?.enAttente?.length} en attente, ${avant.json?.dernieres?.length} dernières`);

/**
 * Mariam demande une recharge pour Awa par la route de l'application (/api/mobile/recharge), comme le fait son
 * téléphone. Rend son identifiant. La route marche aussi sur un serveur construit pour la production : l'ancienne
 * version cherchait l'action du site dans le code de la page, ce qui ne se trouve qu'en développement.
 */
async function rechargeDuParent(enfantId, montant) {
  const mariam = await connexion("mariam@cantine.test");
  if (!mariam.json?.jeton) return { erreur: `connexion du parent refusée (${mariam.status})` };
  const r = await appel("/recharge", { jeton: mariam.json.jeton, corps: { pour: enfantId, montant: String(montant) } });
  return r.json?.id ? { id: r.json.id } : { erreur: r.json?.erreur ?? `pas de recharge créée (${r.status})` };
}

let demande = await rechargeDuParent(awa.json?.moi?.id, 1000);
verdict(!!demande.id || /déjà \d+ recharges en attente/.test(demande.erreur ?? ""), "le parent demande une recharge pour l'essai", demande.id ? `créée, ${demande.id}` : demande.erreur);
if (!demande.id) {
  // Le parent a déjà atteint son nombre de demandes en attente : on confirme l'une des siennes à la place.
  const sienne = avant.json?.enAttente?.find((r) => r.demandeur && r.demandeur.startsWith("Mariam"));
  if (sienne) { demande = { id: sienne.id }; console.log(`       à la place, sa demande ${sienne.reference} déjà en attente`); }
}
if (demande.id) {
  const vue = await appel("/comptoir/recharges", { jeton });
  const ligne = vue.json?.enAttente?.find((r) => r.id === demande.id);
  verdict(!!ligne, "la recharge du parent attend la cantine", ligne ? `${ligne.reference}, ${ligne.montant} F CFA pour ${ligne.beneficiaire}, demandée par ${ligne.demandeur}, ${ligne.depuis}` : "absente");
  const ok = await appel("/comptoir/recharges/confirmer", { jeton, corps: { id: demande.id } });
  verdict(ok.status === 200 && ok.json?.ok === true, "Paiement reçu : recharge confirmée", ok.json?.erreur ?? "");
  const deux = await appel("/comptoir/recharges/confirmer", { jeton, corps: { id: demande.id } });
  verdict(deux.status === 409 && typeof deux.json?.erreur === "string", "la confirmer deux fois : refusé", deux.json?.erreur);
  const close = (await appel("/comptoir/recharges", { jeton })).json?.dernieres?.find((r) => r.id === demande.id);
  verdict(close?.etat === "confirmee", "elle passe dans les dernières recharges", close ? `${close.libelleEtat}, ${close.moyen}, ${close.quand}` : "absente");
} else {
  verdict(false, "une recharge du parent à confirmer", "aucune");
}
const inconnue = await appel("/comptoir/recharges/confirmer", { jeton, corps: { id: "inconnue" } });
verdict(inconnue.status === 409, "une recharge inconnue : refusé", inconnue.json?.erreur);

await appel("/deconnexion", { jeton, corps: {} });
await appel("/deconnexion", { jeton: jetonAwa, corps: {} });
console.log(echecs === 0 ? "\nTout est passé" : `\n${echecs} échec${echecs > 1 ? "s" : ""}`);
process.exit(echecs === 0 ? 0 : 1);
