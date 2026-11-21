// Essai des routes de l'application mobile (src/app/api/mobile/**) contre un serveur qui tourne, par défaut la copie
// d'essai sur http://localhost:3711. Se connecte comme Awa (convive de démonstration) et joue chaque route, réserver
// puis annuler compris : à lancer sur une copie de la base, jamais sur la vraie.
// Le mot de passe de démonstration se lit dans le README au lancement : il n'est pas écrit ici.
// Lancer : node scripts/essai-mobile.mjs  (ADRESSE=http://localhost:3711 par défaut)
import { readFileSync } from "node:fs";

const ADRESSE = process.env.ADRESSE || "http://localhost:3711";
const ORIGINE_WEB = "http://localhost:8081";

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

async function appel(chemin, { jeton, corps, methode, origine } = {}) {
  const enTetes = {};
  if (jeton) enTetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) enTetes["Content-Type"] = "application/json";
  if (origine) enTetes.Origin = origine;
  const r = await fetch(`${ADRESSE}/api/mobile${chemin}`, { method: methode ?? (corps !== undefined ? "POST" : "GET"), headers: enTetes, body: corps !== undefined ? JSON.stringify(corps) : undefined });
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch { /* pas du JSON */ }
  return { status: r.status, json, enTetes: r.headers };
}

async function connexion(email) {
  const r = await appel("/connexion", { corps: { email, motDePasse: motDePasse(email) } });
  return r;
}

// 1. Connexion, et ce qu'on refuse
const awa = await connexion("awa@cantine.test");
verdict(awa.status === 200 && typeof awa.json?.jeton === "string" && awa.json?.moi?.role === "convive", "connexion du convive", `${awa.status}, rôle ${awa.json?.moi?.role}`);
const jeton = awa.json?.jeton;
if (!jeton) { console.log("Sans jeton, rien d'autre ne peut s'essayer"); process.exit(1); }

const mauvais = await appel("/connexion", { corps: { email: "awa@cantine.test", motDePasse: "pas-le-bon" } });
verdict(mauvais.status === 401 && typeof mauvais.json?.erreur === "string", "connexion refusée avec un mauvais mot de passe", mauvais.json?.erreur);
const vide = await appel("/connexion", { corps: { email: "" } });
verdict(vide.status === 400, "corps invalide refusé par zod", vide.json?.erreur);
const sansJeton = await appel("/menu");
verdict(sansJeton.status === 401, "menu sans jeton : 401", sansJeton.json?.erreur);

const mariam = await connexion("mariam@cantine.test");
const parentSurMenu = await appel("/menu", { jeton: mariam.json?.jeton });
verdict(mariam.json?.moi?.role === "parent" && parentSurMenu.status === 403, "menu avec le jeton d'un parent : 403", parentSurMenu.json?.erreur);
await appel("/deconnexion", { jeton: mariam.json?.jeton, corps: {} });

// 2. CORS pour l'aperçu web seulement
const pre = await appel("/menu", { methode: "OPTIONS", origine: ORIGINE_WEB });
verdict(pre.status === 204 && pre.enTetes.get("access-control-allow-origin") === ORIGINE_WEB, "CORS ouvert à l'aperçu web", pre.enTetes.get("access-control-allow-origin") ?? "aucun");
const autre = await appel("/menu", { methode: "OPTIONS", origine: "http://exemple.test" });
verdict(autre.enTetes.get("access-control-allow-origin") === null, "CORS fermé à une autre origine");

// 3. Qui est connecté
const moi = await appel("/moi", { jeton });
verdict(moi.status === 200 && moi.json?.moi?.email === "awa@cantine.test" && typeof moi.json?.nonLus === "number", "moi", `${moi.json?.moi?.nom}, ${moi.json?.nonLus} non lus`);

// 4. Le menu
const menu = await appel("/menu", { jeton });
verdict(menu.status === 200 && Array.isArray(menu.json?.jours) && typeof menu.json?.solde === "number", "menu de la semaine", `${menu.json?.jours?.length} jours, solde ${menu.json?.solde}`);
const profilVu = (menu.json?.plats ?? []).some((p) => p.refus?.genre === "profil");
console.log(`       jour choisi ${menu.json?.choisi}, ${menu.json?.plats?.length} plats${profilVu ? ", dont un écarté par le profil" : ""}`);

// 4 bis. Les allergènes en étiquettes : chaque plat dit ce qu'il déclare et ce qui l'écarte, un dessin et un nom chacun
const estEtiquette = (e) => typeof e?.id === "string" && typeof e?.nom === "string" && e.nom.length > 0 && /^\/allergenes\/[a-z-]+\.webp$/.test(e?.image ?? "");
const etiquettesOk = (liste) => Array.isArray(liste) && liste.every(estEtiquette);
const tousLesPlats = [];
for (const j of menu.json?.jours ?? []) {
  const m = j.jour === menu.json?.choisi ? menu : await appel(`/menu?jour=${j.jour}`, { jeton });
  tousLesPlats.push(...(m.json?.plats ?? []));
}
verdict(tousLesPlats.length > 0 && tousLesPlats.every((p) => etiquettesOk(p.etiquettes) && etiquettesOk(p.enCause)), "chaque plat a ses étiquettes et ce qui l'écarte",
  `${tousLesPlats.length} plats sur la semaine`);
const declares = tousLesPlats.filter((p) => p.etiquettes.length > 0);
verdict(declares.length > 0 && declares.every((p) => typeof p.contient === "string" && p.contient.length > 0), "un plat qui déclare garde aussi « contient » en phrase",
  declares.map((p) => `${p.nom} : ${p.etiquettes.map((e) => e.nom).join(", ")}`).slice(0, 3).join(" ; "));
const ecartes = tousLesPlats.filter((p) => p.refus?.genre === "profil");
if (ecartes.length > 0) {
  verdict(ecartes.every((p) => p.enCause.length > 0), "un plat écarté par le profil dit ce qui l'écarte", ecartes.map((p) => `${p.nom} : ${p.enCause.map((e) => e.nom).join(", ")}`).join(" ; "));
} else {
  saute("plat écarté par le profil", "aucun plat écarté par le profil d'Awa cette semaine");
}
const unDessin = tousLesPlats.flatMap((p) => p.etiquettes)[0];
if (unDessin) {
  const d = await fetch(`${ADRESSE}${unDessin.image}`);
  verdict(d.status === 200 && (d.headers.get("content-type") ?? "").includes("image"), "le dessin d'une étiquette se charge", unDessin.image);
}

// 5. Réserver puis annuler, sur un jour encore ouvert
let essai = null;
for (const j of menu.json?.jours ?? []) {
  const m = await appel(`/menu?jour=${j.jour}`, { jeton });
  const plat = m.json?.plats?.find((p) => p.refus === null);
  if (!j.reserve && plat) { essai = { jour: j.jour, plat, creneaux: m.json.creneaux, dejaPris: null }; break; }
  if (j.reserve && m.json?.repas?.annulable) {
    const meme = m.json.plats.find((p) => p.nom === m.json.repas.plat);
    if (meme) { essai = { jour: j.jour, plat: meme, creneaux: m.json.creneaux, dejaPris: m.json.repas }; break; }
  }
}
if (!essai) {
  saute("réserver et annuler", "aucun jour encore ouvert avec un plat réservable");
} else {
  // Un jour déjà réservé : on annule d'abord, puis on réserve à nouveau le même plat, pour laisser la base comme avant.
  if (essai.dejaPris) {
    const a0 = await appel("/annuler", { jeton, corps: { reservationId: essai.dejaPris.id } });
    verdict(a0.status === 200, "annuler le repas déjà réservé", essai.dejaPris.plat);
  }
  const creneau = essai.creneaux?.find((c) => !c.complet)?.heure ?? null;
  const r = await appel("/reserver", { jeton, corps: { menuJourId: essai.plat.id, creneau } });
  verdict(r.status === 200 && /^[0-9a-f]{32}$/.test(r.json?.jeton ?? ""), "réserver", `${essai.plat.nom}, ${essai.jour}${creneau ? `, ${creneau}` : ""}`);
  const encore = await appel("/reserver", { jeton, corps: { menuJourId: essai.plat.id, creneau } });
  verdict(encore.status === 409 && typeof encore.json?.erreur === "string", "réserver deux fois refusé", encore.json?.erreur);

  const t = await appel(`/ticket/${r.json?.jeton}`, { jeton });
  verdict(t.status === 200 && t.json?.qr?.startsWith("<svg") && t.json?.adresse?.endsWith(`/ticket/${r.json?.jeton}`) && t.json?.etat === "reservee", "ticket avec son QR", t.json?.adresse);
  const e = await appel(`/ticket/${r.json?.jeton}/etat`, { jeton });
  verdict(e.status === 200 && e.json?.etat === "reservee", "état du ticket", e.json?.etat);

  const apres = await appel(`/menu?jour=${essai.jour}`, { jeton });
  const a = await appel("/annuler", { jeton, corps: { reservationId: apres.json?.repas?.id } });
  verdict(a.status === 200, "annuler");
  const e2 = await appel(`/ticket/${r.json?.jeton}/etat`, { jeton });
  verdict(e2.json?.etat === "annulee", "le ticket annulé se lit annulé", e2.json?.etat);

  if (essai.dejaPris) {
    const r2 = await appel("/reserver", { jeton, corps: { menuJourId: essai.plat.id, creneau } });
    verdict(r2.status === 200, "réserver à nouveau, comme avant l'essai");
  }
}
const inconnu = await appel("/ticket/00000000000000000000000000000000", { jeton });
verdict(inconnu.status === 404, "ticket inconnu : 404", inconnu.json?.erreur);

// 6. La demande hors délai, seulement si le site la propose aujourd'hui
const duJour = await appel("/menu", { jeton });
const demandable = duJour.json?.plats?.find((p) => p.demandable);
if (demandable && !duJour.json?.demande) {
  const d = await appel("/demande", { jeton, corps: { menuJourId: demandable.id } });
  verdict(d.status === 200, "demande hors délai", demandable.nom);
} else {
  saute("demande hors délai", duJour.json?.demande ? "une demande existe déjà aujourd'hui" : "rien à demander à cette heure");
}

// 7. Favori : deux fois, pour revenir comme avant
const unPlat = duJour.json?.plats?.[0];
if (unPlat) {
  const f1 = await appel("/favori", { jeton, corps: { platId: unPlat.platId } });
  const f2 = await appel("/favori", { jeton, corps: { platId: unPlat.platId } });
  verdict(f1.status === 200 && f2.status === 200 && f1.json?.favori !== f2.json?.favori, "favori, mis puis retiré", unPlat.nom);
}

// 8. Les tickets, et noter un repas servi
const tickets = await appel("/tickets", { jeton });
verdict(tickets.status === 200 && Array.isArray(tickets.json?.aVenir) && Array.isArray(tickets.json?.passes), "tickets", `${tickets.json?.duJour ? "1 du jour, " : ""}${tickets.json?.aVenir?.length} à venir, ${tickets.json?.passes?.length} passés`);
const servi = [tickets.json?.duJour, ...(tickets.json?.passes ?? [])].find((r) => r?.etat === "servie");
if (servi) {
  const n = await appel("/noter", { jeton, corps: { reservationId: servi.id, note: servi.note ?? 4, mot: servi.mot ?? "" } });
  verdict(n.status === 200, "noter un repas servi", `${servi.plat}, ${servi.note ?? 4} sur 5`);
} else {
  saute("noter", "aucun repas servi");
}
const pasServi = tickets.json?.aVenir?.[0];
if (pasServi) {
  const n = await appel("/noter", { jeton, corps: { reservationId: pasServi.id, note: 5 } });
  verdict(n.status === 409, "noter un repas pas encore servi : refusé", n.json?.erreur);
}
const noteHors = await appel("/noter", { jeton, corps: { reservationId: "abc", note: 9 } });
verdict(noteHors.status === 400, "note hors bornes refusée par zod", noteHors.json?.erreur);

// 9. Le compte : lu, profil et avatar enregistrés tels qu'ils étaient
const compte = await appel("/compte", { jeton });
verdict(compte.status === 200 && typeof compte.json?.solde === "number" && Array.isArray(compte.json?.journal), "compte", `solde ${compte.json?.solde}, ${compte.json?.journal?.length} mouvements`);
const choixOk = (liste, nombre) => Array.isArray(liste) && liste.length === nombre && liste.every(estEtiquette);
verdict(choixOk(compte.json?.allergenes, 14) && choixOk(compte.json?.regimes, 2), "compte : 14 allergènes et 2 régimes, chacun avec son dessin");
verdict(etiquettesOk(compte.json?.neMangePas) && compte.json.neMangePas.length === (compte.json?.profil?.allergenes?.length ?? 0) + (compte.json?.profil?.regimes?.length ?? 0),
  "compte : ce qu'il ne mange pas, en étiquettes", compte.json?.neMangePas?.map((e) => e.nom).join(", ") || "rien");
const profil = compte.json?.profil;
if (profil) {
  const p = await appel("/profil", { jeton, corps: { allergenes: profil.allergenes, regimes: profil.regimes } });
  verdict(p.status === 200, "profil alimentaire enregistré", profil.allergenes.join(", ") || "rien");
}
const p2 = await appel("/profil", { jeton, corps: { allergenes: ["chocolat"], regimes: [] } });
verdict(p2.status === 400, "allergène hors liste refusé", p2.json?.erreur);
const av = await appel("/avatar", { jeton, corps: { avatar: compte.json?.moi?.photo ?? null } });
verdict(av.status === 200, "avatar enregistré", compte.json?.moi?.photo ?? "initiales");

// 10. Les messages
const messages = await appel("/messages", { jeton });
verdict(messages.status === 200 && Array.isArray(messages.json?.messages), "messages", `${messages.json?.messages?.length} messages`);
const nonLus = (messages.json?.messages ?? []).filter((m) => !m.lu).map((m) => m.id);
if (nonLus.length > 0) {
  const l = await appel("/messages/lus", { jeton, corps: { ids: nonLus } });
  const relus = await appel("/moi", { jeton });
  verdict(l.status === 200 && relus.json?.nonLus === 0, "messages marqués lus", `${nonLus.length} lus`);
} else {
  saute("marquer lus", "aucun message non lu");
}

// 11. Déconnexion : le jeton ne sert plus
const fin = await appel("/deconnexion", { jeton, corps: {} });
const apresFin = await appel("/moi", { jeton });
verdict(fin.status === 200 && apresFin.status === 401, "déconnexion, le jeton ne sert plus", `${apresFin.status}`);

console.log(echecs === 0 ? "\nTout est passé" : `\n${echecs} étape${echecs > 1 ? "s" : ""} en échec`);
process.exit(echecs === 0 ? 0 : 1);
