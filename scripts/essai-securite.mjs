// Essai des corrections de sécurité et de fonctionnement du 21/11/2026 (audit), contre un serveur qui tourne, par
// défaut la copie d'essai sur http://localhost:3711. À lancer sur une copie de la base, jamais sur la vraie : il relie
// et délie un parent, change un profil alimentaire, sert un ticket, demande et confirme une recharge, et ferme un
// moment la connexion d'un compte de démonstration (le compteur de tentatives).
// Les mots de passe de démonstration se lisent dans le README au lancement : ils ne sont pas ici.
// Lancer : node scripts/essai-securite.mjs  (ADRESSE=http://localhost:3711 par défaut)
import { readFileSync } from "node:fs";

const ADRESSE = process.env.ADRESSE || "http://localhost:3711";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const MOT_DE_PASSE = readme.match(/`awa@cantine\.test`\s*\|\s*`([^`]+)`/)?.[1];
if (!MOT_DE_PASSE) throw new Error("Mot de passe de démonstration introuvable dans le README");

let echecs = 0;
const verdict = (ok, etape, detail = "") => {
  if (!ok) echecs++;
  console.log(`${ok ? "OK    " : "ÉCHEC "} ${etape}${detail ? `  (${detail})` : ""}`);
};
const saute = (etape, raison) => console.log(`SAUTÉ  ${etape}  (${raison})`);

async function appel(chemin, { jeton, corps, racine = "/api/mobile" } = {}) {
  const enTetes = { Origin: ADRESSE };
  if (jeton) enTetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) enTetes["Content-Type"] = "application/json";
  const r = await fetch(`${ADRESSE}${racine}${chemin}`, { method: corps !== undefined ? "POST" : "GET", headers: enTetes, body: corps !== undefined ? JSON.stringify(corps) : undefined });
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch { /* pas du JSON */ }
  return { status: r.status, json };
}
const connexion = (email, motDePasse = MOT_DE_PASSE) => appel("/connexion", { corps: { email, motDePasse } });
/** « Aïcha N'Guessan » : aicha.nguessan@cantine.test, comme le fait scripts/demo.mts. */
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
const emailDe = (nom) => { const [prenom, ...reste] = nom.split(" "); return `${sansAccent(prenom)}.${sansAccent(reste.join(" "))}@cantine.test`; };

// 1. Les chemins de Better Auth fermés
for (const chemin of ["/sign-up/email", "/update-user", "/change-password", "/change-email", "/delete-user"]) {
  const r = await appel(chemin, { racine: "/api/auth", corps: { name: "Essai", email: "essai@cantine.test", password: "un-mot-de-passe-long", image: "https://exemple.test/x.png" } });
  verdict(r.status === 404, `route de Better Auth fermée : ${chemin}`, String(r.status));
}

// 2. Qui entre
const cantine = (await connexion("cantine@cantine.test")).json;
const mariam = (await connexion("mariam@cantine.test")).json;
const kouassi = (await connexion("kouassi@cantine.test")).json;
verdict(!!cantine?.jeton && !!mariam?.jeton && !!kouassi?.jeton, "connexion de la cantine, du parent et d'un employé");
if (!cantine?.jeton || !mariam?.jeton || !kouassi?.jeton) { console.log("Sans jeton, rien d'autre ne peut s'essayer"); process.exit(1); }

// 3. Le code famille à usage unique
const compteAvant = (await appel("/compte", { jeton: kouassi.jeton })).json;
verdict(compteAvant?.profil && !("codeFamille" in compteAvant.profil), "le compte ne montre plus de code famille permanent");
verdict(Array.isArray(compteAvant?.parents) && compteAvant.parents.length === 0, "aucun parent relié au départ", JSON.stringify(compteAvant?.parents));
const refusParent = await appel("/code-famille", { jeton: mariam.jeton, corps: {} });
verdict(refusParent.status === 403, "un parent ne crée pas de code famille : 403", String(refusParent.status));
const premier = (await appel("/code-famille", { jeton: kouassi.jeton, corps: {} })).json;
verdict(/^[A-Z2-9]{6}$/.test(premier?.code ?? "") && typeof premier?.valableJusqua === "string", "l'employé crée un code", `${premier?.code}, valable jusqu'à ${premier?.valableJusqua}`);
const second = (await appel("/code-famille", { jeton: kouassi.jeton, corps: {} })).json;
verdict(!!second?.code && second.code !== premier?.code, "un nouveau code remplace l'ancien", second?.code);
const ancien = await appel("/parent/lier", { jeton: mariam.jeton, corps: { code: premier?.code ?? "" } });
verdict(ancien.status === 409 && /pas valable/.test(ancien.json?.erreur ?? ""), "l'ancien code ne relie plus", ancien.json?.erreur);
const lie = await appel("/parent/lier", { jeton: mariam.jeton, corps: { code: second?.code ?? "" } });
verdict(lie.status === 200 && /Kouassi/.test(lie.json?.message ?? ""), "le parent se relie avec le code", lie.json?.message ?? lie.json?.erreur);
const rejoue = await appel("/parent/lier", { jeton: mariam.jeton, corps: { code: second?.code ?? "" } });
verdict(rejoue.status === 409, "le même code ne sert pas deux fois", rejoue.json?.erreur);
const compteLie = (await appel("/compte", { jeton: kouassi.jeton })).json;
verdict(compteLie?.parents?.length === 1 && /Mariam/.test(compteLie.parents[0].nom), "l'employé voit le parent relié", compteLie?.parents?.[0]?.nom);
const retire = await appel("/parents/retirer", { jeton: kouassi.jeton, corps: { parentId: compteLie?.parents?.[0]?.id ?? "" } });
verdict(retire.status === 200, "l'employé retire ce parent", retire.json?.erreur ?? "");
const fiche = await appel(`/parent/enfant/${kouassi.moi.id}`, { jeton: mariam.jeton });
verdict(fiche.status === 403 || fiche.status === 404, "le parent retiré ne voit plus sa fiche", String(fiche.status));
// Cinq codes faux ferment « relier un enfant » à ce parent.
let dernier = null;
for (let i = 0; i < 6; i++) dernier = await appel("/parent/lier", { jeton: mariam.jeton, corps: { code: `ZZZZZ${"23456789"[i]}` } });
verdict(/Trop d'essais/.test(dernier?.json?.erreur ?? ""), "après cinq codes faux, relier un enfant se ferme un moment", dernier?.json?.erreur);

// 4. Un repas déjà réservé que le profil écarte : dit au convive, puis au comptoir
const commandes = (await appel("/comptoir/commandes", { jeton: cantine.jeton })).json;
const avecOeuf = commandes?.plats?.find((p) => /œuf/i.test(p.nom));
const cible = avecOeuf?.convives?.find((c) => c.etat === "reservee");
if (!cible) {
  saute("profil réglé après la réservation", "personne n'a réservé le plat aux œufs aujourd'hui, ou il est déjà servi");
} else {
  const convive = (await connexion(emailDe(cible.nom))).json;
  verdict(!!convive?.jeton, "connexion du convive qui a réservé le plat aux œufs", cible.nom);
  const profil = await appel("/profil", { jeton: convive?.jeton, corps: { allergenes: ["oeuf"], regimes: [] } });
  const enCause = profil.json?.repasEnCause ?? [];
  verdict(profil.status === 200 && enCause.some((r) => r.plat === avecOeuf.nom && r.enCause.some((e) => e.id === "oeuf")), "le profil enregistré dit quel repas réservé il écarte", JSON.stringify(enCause.map((r) => `${r.jour}, ${r.plat}`)));
  const apres = (await appel("/comptoir/commandes", { jeton: cantine.jeton })).json;
  const ligne = apres?.plats?.find((p) => p.id === avecOeuf.id)?.convives?.find((c) => c.id === cible.id);
  verdict(ligne?.enCause?.some((e) => e.id === "oeuf"), "les commandes signalent ce repas à la cantine", JSON.stringify(ligne?.enCause?.map((e) => e.nom)));
  const servi = await appel("/comptoir/servir", { jeton: cantine.jeton, corps: { cle: cible.code } });
  verdict(servi.json?.genre === "servi" && servi.json?.enCause?.some((e) => e.id === "oeuf"), "le scanner le signale au moment de servir", `${servi.json?.phrase}, en cause : ${servi.json?.enCause?.map((e) => e.nom).join(", ")}`);
  const deux = await appel("/comptoir/servir", { jeton: cantine.jeton, corps: { cle: cible.code } });
  verdict(deux.json?.genre === "deja_servi", "le même ticket ne se sert pas deux fois", deux.json?.phrase);
}

// 5. Une recharge confirmée à la main compte en espèces tant que le QR est coupé ; une annulation ne se rejoue pas
const awa = (await connexion("awa@cantine.test")).json;
const demande = await appel("/recharge", { jeton: awa?.jeton, corps: { pour: "", montant: "1000" } });
verdict(demande.status === 200 && !!demande.json?.id, "l'élève demande une recharge", demande.json?.erreur ?? demande.json?.id);
if (demande.json?.id) {
  const ok = await appel("/comptoir/recharges/confirmer", { jeton: cantine.jeton, corps: { id: demande.json.id } });
  verdict(ok.status === 200, "la cantine dit « Paiement reçu »", ok.json?.erreur ?? "");
  const close = (await appel("/comptoir/recharges", { jeton: cantine.jeton })).json?.dernieres?.find((r) => r.id === demande.json.id);
  verdict(close && !/QR universel/i.test(JSON.stringify(close)), "elle n'est pas rangée sous « QR universel »", close ? JSON.stringify({ moyen: close.moyen, libelle: close.libelleMoyen }) : "absente");
}
const autre = await appel("/recharge", { jeton: awa?.jeton, corps: { pour: "", montant: "500" } });
if (autre.json?.id) {
  const a1 = await appel(`/recharge/${autre.json.id}/annuler`, { jeton: awa.jeton, corps: {} });
  const a2 = await appel(`/recharge/${autre.json.id}/annuler`, { jeton: awa.jeton, corps: {} });
  verdict(a1.status === 200 && a2.status !== 200, "une recharge ne s'annule qu'une fois", `${a1.status}, puis ${a2.status} ${a2.json?.erreur ?? ""}`);
}

// 6. La limite des tentatives de connexion (à la fin : elle ferme un moment le compte d'Ismaël sur ce serveur)
let codes = [];
for (let i = 0; i < 9; i++) codes.push((await connexion("ismael@cantine.test", `mauvais-mot-de-passe-${i}`)).status);
verdict(codes.slice(0, 8).every((c) => c === 401) && codes[8] === 429, "huit mots de passe faux, puis la porte se ferme", codes.join(" "));
const bon = await connexion("ismael@cantine.test");
verdict(bon.status === 429 && /Trop d'essais/.test(bon.json?.erreur ?? ""), "même le bon mot de passe attend que la fenêtre passe", bon.json?.erreur);
const ailleurs = await connexion("awa@cantine.test");
verdict(ailleurs.status === 200, "les autres comptes entrent toujours", String(ailleurs.status));
const parLaRoute = await appel("/sign-in/email", { racine: "/api/auth", corps: { email: "ismael@cantine.test", password: MOT_DE_PASSE } });
verdict(parLaRoute.status === 429, "la route de Better Auth est derrière le même compteur", String(parLaRoute.status));

console.log(echecs === 0 ? "\nTout est passé" : `\n${echecs} étape${echecs > 1 ? "s" : ""} en échec`);
process.exit(echecs === 0 ? 0 : 1);
