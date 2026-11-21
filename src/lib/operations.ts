import "server-only";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { avatarPermis } from "@/lib/avatars";
import { prisma } from "@/lib/db";
import { estParentDe, lireReglages, peutAgirPour, photosDisponibles } from "@/lib/donnees";
import { refusMessage } from "@/lib/messages";
import { refusFiche, type LigneFiche, type Unite } from "@/lib/besoins";
import { libelleLivraison, refusInventaire, refusLivraison, stockDe } from "@/lib/stock";
import { refusDepense, type DepenseSaisie } from "@/lib/comptabilite";
import { CODE_PAS_VALABLE, codeUtilisable, estUnCodeFamille, expirationCode, identifiantCode } from "@/lib/code-famille";
import { verdictCreneau } from "@/lib/creneaux";
import { erreurReglages, heuresDePassage, type Reglages } from "@/lib/reglages";
import { de, fcfa, nombre } from "@/lib/format";
import { ajouterJours, estUnJour, jourIso, jourLong, lundiDe } from "@/lib/jours";
import { IDS_ALLERGENES, IDS_REGIMES, ecrireListe, etiquettesAllergenes, lireListe, type Etiquette } from "@/lib/listes";
import { DESCRIPTION_MAX, NOM_MAX, PORTIONS_MAX, PRIX_MAX, PRIX_MIN, noteValable, peutRetirer, portionsValables, prixValable } from "@/lib/menu";
import { etiquettesEnCause, incompatibilites } from "@/lib/profil-alimentaire";
import { ATTENTES_MAX, RECHARGE_MAX, RECHARGE_MIN, montantValable, moyenManuel, peutAnnulerRecharge, peutConfirmer, peutDemander, type MoyenRecharge } from "@/lib/recharge";
import { peutAnnuler, peutDemanderHorsDelai, peutReserver, scanner, type Scan } from "@/lib/reservation";
import { RESTES_MAX, peutPeser, restesValables } from "@/lib/restes";
import type { Moi, Role } from "@/lib/session";
import { PLAFOND_MAX, PLAFOND_MIN, SEUIL_ALERTE_MAX, mouvementRecharge, mouvementRemboursement, mouvementRepas, mouvementsTransfert, peutReglerPlafond, plafondValable, refusTransfert, seuilValable, soldeDe } from "@/lib/solde";
import { LIMITE_CODE, TROP_D_ESSAIS, clesConnexion, connexionBloquee, noterConnexion, tentatives } from "@/lib/tentatives";
import { lireCle, nettoyerCode, nouveauCode, nouveauCodeFamille, nouveauJeton, nouvelId, nouvelleReference } from "@/lib/ticket";
import { sessionValable } from "@/lib/cartflox";

// TOUT ce qui écrit dans la base passe par ici. Chaque geste applique la règle pure (src/lib/*.ts), puis écrit dans une
// seule transaction : une réservation et son mouvement d'argent partent ensemble ou pas du tout.
// Ces fonctions ne vérifient pas QUI appelle (sauf quand elles reçoivent l'acteur) : l'action serveur le fait avant,
// avec `autorise()` de src/lib/session.ts.

type Tx = Prisma.TransactionClient;
/** `enCause` : pour un plat refusé à cause du profil alimentaire, ce qui l'écarte, en étiquettes (un dessin et un nom). */
export type Echec = { ok: false; erreur: string; enCause?: Etiquette[] };
export type Fait = { ok: true };
const echec = (erreur: string): Echec => ({ ok: false, erreur });
const FAIT: Fait = { ok: true };

/* ── Comptes ───────────────────────────────────────────────────────────────── */

/** La phrase à montrer pour une erreur de Better Auth. */
function messageConnexion(e: unknown, defaut: string) {
  const code = (e as { body?: { code?: string } })?.body?.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "Un compte existe déjà avec cet e-mail, connecte-toi";
  if (code === "PASSWORD_TOO_SHORT") return "Un mot de passe d'au moins 8 caractères";
  if (code === "PASSWORD_TOO_LONG") return "Ce mot de passe est trop long";
  if (code === "INVALID_EMAIL") return "Cet e-mail n'a pas l'air juste";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_PASSWORD") return "E-mail ou mot de passe incorrect";
  return defaut;
}

async function codeFamilleLibre(tx: Tx) {
  for (;;) {
    const code = nouveauCodeFamille();
    if (!(await tx.profil.findUnique({ where: { codeFamille: code } }))) return code;
  }
}

export type DemandeInscription = {
  nom: string;
  email: string;
  motDePasse: string;
  /** L'inscription publique ne crée que des convives et des parents, jamais un administrateur. */
  role: "convive" | "parent";
  genre?: "eleve" | "employe";
  classe?: string;
};

/** Crée le compte, pose son rôle côté serveur, ouvre sa session, et crée le profil d'un convive avec son code famille. */
export async function inscrire(d: DemandeInscription): Promise<{ ok: true; role: Role } | Echec> {
  const email = d.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return echec("Un compte existe déjà avec cet e-mail, connecte-toi");
  let id: string;
  try {
    const r = await auth.api.signUpEmail({ body: { name: d.nom.trim(), email, password: d.motDePasse }, headers: await headers() });
    id = r.user.id;
  } catch (e) {
    return echec(messageConnexion(e, "Impossible de créer le compte, réessaie"));
  }
  const role: Role = d.role === "parent" ? "parent" : "convive";
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role } });
    if (role === "convive") {
      await tx.profil.create({
        data: { userId: id, genre: d.genre === "employe" ? "employe" : "eleve", classe: (d.classe ?? "").trim().slice(0, NOM_MAX), codeFamille: await codeFamilleLibre(tx) },
      });
    }
  });
  return { ok: true, role };
}

/**
 * La porte de la connexion, la même pour le site et pour l'application mobile, derrière le compteur de tentatives
 * (src/lib/tentatives.ts) : trop de mots de passe faux pour un e-mail, ou depuis une adresse, et elle se ferme un moment.
 */
async function ouvrirSession(email: string, motDePasse: string, resterConnecte: boolean) {
  const adresse = email.trim().toLowerCase();
  const enTetes = await headers();
  const cles = clesConnexion(adresse, enTetes);
  if (connexionBloquee(cles, Date.now())) return echec(TROP_D_ESSAIS);
  try {
    const session = await auth.api.signInEmail({ body: { email: adresse, password: motDePasse, rememberMe: resterConnecte }, headers: enTetes });
    noterConnexion(cles, true, Date.now());
    return { ok: true as const, adresse, session };
  } catch (e) {
    noterConnexion(cles, false, Date.now());
    return echec(messageConnexion(e, "E-mail ou mot de passe incorrect"));
  }
}

/** `resterConnecte` faux : la session finit quand le navigateur se ferme (« Rester connecté » décoché). */
export async function seConnecter(email: string, motDePasse: string, resterConnecte = true): Promise<{ ok: true; role: Role } | Echec> {
  const r = await ouvrirSession(email, motDePasse, resterConnecte);
  if (!r.ok) return r;
  const u = await prisma.user.findUnique({ where: { email: r.adresse }, select: { role: true } });
  return { ok: true, role: (u?.role ?? "convive") as Role };
}

/** La connexion de l'application mobile : la même porte, et le jeton de session que le téléphone renverra. */
export async function seConnecterMobile(email: string, motDePasse: string): Promise<{ ok: true; jeton: string; moi: Moi } | Echec> {
  const r = await ouvrirSession(email, motDePasse, true);
  if (!r.ok) return r;
  const u = r.session.user as typeof r.session.user & { role?: string | null };
  const role = (["convive", "parent", "admin"].includes(u.role ?? "") ? u.role : "convive") as Role;
  return { ok: true, jeton: r.session.token, moi: { id: u.id, nom: u.name, email: u.email, role, photo: u.image ?? null } };
}

export async function seDeconnecter() {
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
}

/* ── Réserver, annuler, servir ─────────────────────────────────────────────── */

async function codeLibre(tx: Tx, jour: string) {
  for (;;) {
    const code = nouveauCode();
    if (!(await tx.reservation.findFirst({ where: { jour, code }, select: { id: true } }))) return code;
  }
}

const soldeDans = async (tx: Tx, conviveId: string) => soldeDe(await tx.mouvement.findMany({ where: { conviveId }, select: { montant: true } }));

/**
 * Réserver, c'est payer : la réservation et son mouvement s'écrivent ensemble. Rend le jeton et le code du ticket.
 * `parLaCantine` : c'est la cantine qui réserve pour ce convive, clôture comprise. `horsDelai` : elle accepte une demande
 * hors délai, le seul chemin qui passe après la clôture (src/lib/reservation.ts, peutReserver).
 */
export async function reserver(conviveId: string, menuJourId: string, maintenant = Date.now(), parLaCantine = false, creneau: string | null = null, horsDelai = false): Promise<{ ok: true; jeton: string; code: string; plat: string } | Echec> {
  const reglages = await lireReglages();
  return prisma.$transaction(async (tx) => {
    const mj = await tx.menuJour.findUnique({ where: { id: menuJourId }, include: { plat: true } });
    if (!mj) return echec("Ce plat n'est plus au menu");
    const profil = await tx.profil.findUnique({ where: { userId: conviveId } });
    if (!profil) return echec("Seul un compte d'élève ou d'employé peut réserver un repas");
    const dejaReserve = (await tx.reservation.count({ where: { conviveId, jour: mj.jour, etat: { not: "annulee" } } })) > 0;
    const reservees = await tx.reservation.count({ where: { menuJourId, etat: { not: "annulee" } } });
    // Le plafond de la semaine (du lundi au dimanche du jour réservé) : ce qui est déjà réservé, annulés exclus.
    const lundi = lundiDe(mj.jour);
    const depense = profil.plafondSemaine === null ? 0 : (await tx.reservation.aggregate({
      where: { conviveId, jour: { gte: lundi, lte: ajouterJours(lundi, 6) }, etat: { not: "annulee" } },
      _sum: { prix: true },
    }))._sum.prix ?? 0;
    const verdict = peutReserver({
      maintenant,
      jour: mj.jour,
      dejaReserve,
      plafond: { max: profil.plafondSemaine, depense },
      epuise: mj.epuise,
      portions: mj.portions,
      reservees,
      incompatibilites: incompatibilites(
        { allergenes: lireListe(profil.allergenes), regimes: lireListe(profil.regimes) },
        { allergenes: lireListe(mj.plat.allergenes), porc: mj.plat.porc, vegetarien: mj.plat.vegetarien },
      ),
      solde: await soldeDans(tx, conviveId),
      prix: mj.prix,
      parLaCantine,
      horsDelai,
      heureCloture: reglages.heureCloture,
    });
    if (!verdict.ok) {
      if (verdict.refus !== "profil") return echec(verdict.phrase);
      return { ...echec(verdict.phrase), enCause: etiquettesEnCause(
        { allergenes: lireListe(profil.allergenes), regimes: lireListe(profil.regimes) },
        { allergenes: lireListe(mj.plat.allergenes), porc: mj.plat.porc, vegetarien: mj.plat.vegetarien },
      ) };
    }

    // L'heure de passage (src/lib/creneaux.ts) : le convive la choisit quand la cantine a ouvert des créneaux. Quand la
    // cantine réserve pour lui, elle est facultative, mais une heure donnée doit exister et avoir de la place.
    const heures = heuresDePassage(reglages);
    const actifs = heures.length > 0 && (!parLaCantine || creneau !== null);
    const pris = actifs && creneau ? await tx.reservation.count({ where: { jour: mj.jour, creneau, etat: { not: "annulee" } } }) : 0;
    const passage = verdictCreneau({ actifs, choisi: creneau, heures, pris, capacite: reglages.creneauCapacite });
    if (!passage.ok) return echec(passage.phrase);

    const r = await tx.reservation.create({
      data: { conviveId, menuJourId, jour: mj.jour, prix: mj.prix, jeton: nouveauJeton(), code: await codeLibre(tx, mj.jour), creneau: actifs ? creneau : null, creeLe: new Date(maintenant) },
    });
    const m = mouvementRepas(mj.prix);
    await tx.mouvement.create({
      data: { conviveId, genre: m.genre, montant: m.montant, libelle: `Repas du ${jourLong(mj.jour)} : ${mj.plat.nom}`, reservationId: r.id, creeLe: new Date(maintenant) },
    });
    return { ok: true as const, jeton: r.jeton, code: r.code, plat: mj.plat.nom };
  });
}

/** Annuler avant la clôture rembourse le repas en entier, dans la même transaction. */
export async function annuler(conviveId: string, reservationId: string, maintenant = Date.now()): Promise<Fait | Echec> {
  const { heureCloture } = await lireReglages();
  return prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id: reservationId }, include: { menuJour: { include: { plat: true } } } });
    if (!r || r.conviveId !== conviveId) return echec("Réservation introuvable");
    const verdict = peutAnnuler(r, maintenant, heureCloture);
    if (!verdict.ok) return echec(verdict.phrase);
    // Sous condition : deux annulations au même instant ne remboursent qu'une fois, et un repas servi entre-temps reste servi.
    const fait = await tx.reservation.updateMany({ where: { id: r.id, etat: "reservee" }, data: { etat: "annulee", annuleLe: new Date(maintenant) } });
    if (fait.count !== 1) return echec("Cette réservation vient de changer, recharge la page");
    const m = mouvementRemboursement(r.prix);
    await tx.mouvement.create({
      data: { conviveId, genre: m.genre, montant: m.montant, libelle: `Annulation : ${r.menuJour.plat.nom}`, reservationId: r.id, creeLe: new Date(maintenant) },
    });
    return FAIT;
  });
}

/* ── La demande hors délai (les demandes urgentes) ─────────────────────────── */

/** Après la clôture, le convive sans repas demande un plat qui reste ; rien n'est payé tant que la cantine n'accepte pas. */
export async function demanderHorsDelai(conviveId: string, menuJourId: string, maintenant = Date.now()): Promise<Fait | Echec> {
  const { heureCloture } = await lireReglages();
  return prisma.$transaction(async (tx) => {
    const mj = await tx.menuJour.findUnique({ where: { id: menuJourId }, include: { plat: true } });
    if (!mj) return echec("Ce plat n'est plus au menu");
    const profil = await tx.profil.findUnique({ where: { userId: conviveId } });
    if (!profil) return echec("Seul un compte d'élève ou d'employé peut demander un repas");
    const lundi = lundiDe(mj.jour);
    const depense = profil.plafondSemaine === null ? 0 : (await tx.reservation.aggregate({
      where: { conviveId, jour: { gte: lundi, lte: ajouterJours(lundi, 6) }, etat: { not: "annulee" } },
      _sum: { prix: true },
    }))._sum.prix ?? 0;
    const verdict = peutDemanderHorsDelai({
      plafond: { max: profil.plafondSemaine, depense },
      maintenant,
      jour: mj.jour,
      heureCloture,
      dejaReserve: (await tx.reservation.count({ where: { conviveId, jour: mj.jour, etat: { not: "annulee" } } })) > 0,
      demandeEnCours: (await tx.demandeRepas.count({ where: { conviveId, jour: mj.jour, etat: "en_attente" } })) > 0,
      epuise: mj.epuise,
      portions: mj.portions,
      reservees: await tx.reservation.count({ where: { menuJourId, etat: { not: "annulee" } } }),
      incompatibilites: incompatibilites(
        { allergenes: lireListe(profil.allergenes), regimes: lireListe(profil.regimes) },
        { allergenes: lireListe(mj.plat.allergenes), porc: mj.plat.porc, vegetarien: mj.plat.vegetarien },
      ),
      solde: await soldeDans(tx, conviveId),
      prix: mj.prix,
    });
    if (!verdict.ok) return echec(verdict.phrase);
    await tx.demandeRepas.create({ data: { conviveId, menuJourId, jour: mj.jour, creeLe: new Date(maintenant) } });
    return FAIT;
  });
}

/**
 * La cantine répond à une demande hors délai. Accepter, c'est réserver pour le convive (mêmes règles que « réserver pour
 * un convive », le repas payé sur son solde) ; refuser ne coûte rien. Une demande n'a qu'une réponse.
 */
export async function traiterDemande(demandeId: string, accepter: boolean, maintenant = Date.now()): Promise<{ ok: true; convive: string; plat: string; code: string | null } | Echec> {
  const d = await prisma.demandeRepas.findUnique({ where: { id: demandeId }, include: { convive: { select: { name: true } }, menuJour: { include: { plat: { select: { nom: true } } } } } });
  if (!d) return echec("Demande introuvable");
  if (d.etat !== "en_attente") return echec("Cette demande a déjà sa réponse");
  if (!accepter) {
    const fait = await prisma.demandeRepas.updateMany({ where: { id: d.id, etat: "en_attente" }, data: { etat: "refusee", traiteeLe: new Date(maintenant) } });
    return fait.count === 1 ? { ok: true as const, convive: d.convive.name, plat: d.menuJour.plat.nom, code: null } : echec("Cette demande a déjà sa réponse");
  }
  const r = await reserver(d.conviveId, d.menuJourId, maintenant, true, null, true);
  if (!r.ok) return r;
  const reservation = await prisma.reservation.findUnique({ where: { jeton: r.jeton }, select: { id: true } });
  await prisma.demandeRepas.update({ where: { id: d.id }, data: { etat: "acceptee", traiteeLe: new Date(maintenant), reservationId: reservation?.id ?? null } });
  return { ok: true as const, convive: d.convive.name, plat: r.plat, code: r.code };
}

/* ── Lot 2 : familles et élèves ───────────────────────────────────────────── */

/** Un parent fait passer de l'argent du compte d'un de ses enfants à celui d'un autre (src/lib/solde.ts). */
export async function transfererSolde(parentId: string, deId: string, versId: string, montant: number, maintenant = Date.now()): Promise<{ ok: true; de: string; vers: string } | Echec> {
  if (!(await estParentDe(parentId, deId)) || !(await estParentDe(parentId, versId))) return echec("Tu ne transfères qu'entre tes enfants");
  return prisma.$transaction(async (tx) => {
    const [source, cible] = await Promise.all([
      tx.user.findUnique({ where: { id: deId }, select: { name: true } }),
      tx.user.findUnique({ where: { id: versId }, select: { name: true } }),
    ]);
    if (!source || !cible) return echec("Compte introuvable");
    const refus = refusTransfert({ montant, soldeSource: await soldeDans(tx, deId), memeCompte: deId === versId });
    if (refus) return echec(refus);
    const [sortie, entree] = mouvementsTransfert(montant);
    const prenom = (n: string) => n.split(/\s+/)[0];
    const quand = new Date(maintenant);
    await tx.mouvement.create({ data: { conviveId: deId, genre: sortie.genre, montant: sortie.montant, libelle: `Transfert vers ${prenom(cible.name)}`, creeLe: quand } });
    await tx.mouvement.create({ data: { conviveId: versId, genre: entree.genre, montant: entree.montant, libelle: `Transfert ${de(prenom(source.name))}`, creeLe: quand } });
    return { ok: true as const, de: source.name, vers: cible.name };
  });
}

/** Le plafond des repas d'une semaine : posé par le convive pour lui, ou par son parent ; null le retire. */
export async function reglerPlafond(acteur: Pick<Moi, "id" | "role">, conviveId: string, plafond: number | null): Promise<Fait | Echec> {
  if (!plafondValable(plafond)) return echec(`Un plafond entre ${nombre(PLAFOND_MIN)} et ${fcfa(PLAFOND_MAX)}, sans centimes`);
  if (!(await peutAgirPour(acteur, conviveId))) return echec("Tu ne peux régler que ton plafond ou celui de ton enfant");
  if (!peutReglerPlafond(acteur.role, (await prisma.lienParent.count({ where: { enfantId: conviveId } })) > 0)) return echec("C'est ton parent qui règle ton plafond");
  const fait = await prisma.profil.updateMany({ where: { userId: conviveId }, data: { plafondSemaine: plafond } });
  return fait.count === 1 ? FAIT : echec("Profil introuvable");
}

/** La cantine envoie un message aux familles (src/lib/messages.ts). */
export async function envoyerMessage(auteurId: string, m: { titre: string; texte: string; cible: string; epingle: boolean }, maintenant = Date.now()): Promise<Fait | Echec> {
  const refus = refusMessage(m);
  if (refus) return echec(refus);
  await prisma.message.create({ data: { titre: m.titre.trim(), texte: m.texte.trim(), cible: m.cible, epingle: m.epingle, auteurId, creeLe: new Date(maintenant) } });
  return FAIT;
}

export async function supprimerMessage(messageId: string): Promise<Fait | Echec> {
  const fait = await prisma.message.deleteMany({ where: { id: messageId } });
  return fait.count === 1 ? FAIT : echec("Message introuvable");
}

/** Ces messages sont lus par cette personne : l'accusé de lecture que la cantine voit. */
export async function marquerLus(userId: string, messageIds: string[]): Promise<void> {
  const deja = new Set((await prisma.messageLu.findMany({ where: { userId, messageId: { in: messageIds } }, select: { messageId: true } })).map((l) => l.messageId));
  const nouveaux = messageIds.filter((id) => !deja.has(id));
  if (nouveaux.length === 0) return;
  const existants = new Set((await prisma.message.findMany({ where: { id: { in: nouveaux } }, select: { id: true } })).map((m) => m.id));
  await prisma.messageLu.createMany({ data: nouveaux.filter((id) => existants.has(id)).map((messageId) => ({ messageId, userId })) });
}

/** Ajoute ou retire un plat des favoris de ce convive. Rend vrai s'il est maintenant favori. */
export async function basculerFavori(userId: string, platId: string): Promise<{ ok: true; favori: boolean } | Echec> {
  if (!(await prisma.plat.findUnique({ where: { id: platId }, select: { id: true } }))) return echec("Ce plat n'existe plus");
  const cle = { userId_platId: { userId, platId } };
  if (await prisma.favori.findUnique({ where: cle })) {
    await prisma.favori.delete({ where: cle });
    return { ok: true as const, favori: false };
  }
  await prisma.favori.create({ data: { userId, platId } });
  return { ok: true as const, favori: true };
}

/** Le jeton de la carte de cantine de ce convive, tiré au hasard la première fois qu'il la montre. */
export async function carteDe(conviveId: string): Promise<string | null> {
  const profil = await prisma.profil.findUnique({ where: { userId: conviveId }, select: { carte: true } });
  if (!profil) return null;
  if (profil.carte) return profil.carte;
  const carte = nouveauJeton();
  await prisma.profil.update({ where: { userId: conviveId }, data: { carte } });
  return carte;
}

/**
 * Refaire sa carte : un nouveau jeton, l'ancien ne passe plus au comptoir. Pour une carte perdue, prêtée ou
 * photographiée : sans cela, sa photo servait de passe pour toujours.
 */
export async function refaireCarte(conviveId: string): Promise<Fait | Echec> {
  const fait = await prisma.profil.updateMany({ where: { userId: conviveId }, data: { carte: nouveauJeton() } });
  return fait.count === 1 ? FAIT : echec("Seul un compte d'élève ou d'employé a une carte");
}

/* ── La fiche recette d'un plat (besoins de la cuisine, bonus 2) ─────────────── */

/**
 * Remplace la fiche recette de ce plat : un ingrédient par ligne, avec sa quantité pour une portion. Un ingrédient
 * nouveau est créé ; un ingrédient connu garde son unité (le riz ne se compte pas en grammes ici et en pièces là).
 */
export async function enregistrerFiche(platId: string, lignes: LigneFiche[]): Promise<Fait | Echec> {
  const refus = refusFiche(lignes);
  if (refus) return echec(refus);
  return prisma.$transaction(async (tx) => {
    if (!(await tx.plat.findUnique({ where: { id: platId }, select: { id: true } }))) return echec("Ce plat n'existe plus");
    const connus = await tx.ingredient.findMany();
    const parNom = new Map(connus.map((i) => [i.nom.toLocaleLowerCase("fr"), i]));
    const ids: { ingredientId: string; quantite: number }[] = [];
    for (const l of lignes) {
      const nom = l.nom.trim();
      let ingredient = parNom.get(nom.toLocaleLowerCase("fr"));
      if (ingredient && ingredient.unite !== l.unite) {
        const unites: Record<string, string> = { g: "en grammes", ml: "en millilitres", piece: "à la pièce" };
        return echec(`« ${ingredient.nom} » se compte déjà ${unites[ingredient.unite] ?? ingredient.unite}`);
      }
      if (!ingredient) {
        ingredient = await tx.ingredient.create({ data: { nom, unite: l.unite } });
        parNom.set(nom.toLocaleLowerCase("fr"), ingredient);
      }
      ids.push({ ingredientId: ingredient.id, quantite: l.quantite });
    }
    await tx.ligneRecette.deleteMany({ where: { platId } });
    if (ids.length > 0) await tx.ligneRecette.createMany({ data: ids.map((l) => ({ platId, ...l })) });
    return FAIT;
  });
}

/* ── Les réglages de la cantine ───────────────────────────────────────────── */

export async function enregistrerReglages(r: Reglages): Promise<Fait | Echec> {
  const erreur = erreurReglages(r);
  if (erreur) return echec(erreur);
  await prisma.reglages.upsert({ where: { id: 1 }, create: { id: 1, ...r }, update: r });
  return FAIT;
}

/** Les restes d'un plat du jour, pesés après le service (en grammes ; null efface la pesée). */
export async function peserRestes(menuJourId: string, grammes: number | null, maintenant = Date.now()): Promise<Fait | Echec> {
  if (!restesValables(grammes)) return echec(`Un poids entre 0 et ${nombre(RESTES_MAX / 1000)} kg`);
  const mj = await prisma.menuJour.findUnique({ where: { id: menuJourId }, select: { jour: true } });
  if (!mj) return echec("Ce plat n'est plus au menu");
  if (!peutPeser(mj.jour, maintenant)) return echec("On pèse les restes une fois le service passé");
  await prisma.menuJour.update({ where: { id: menuJourId }, data: { restes: grammes } });
  return FAIT;
}

/**
 * `allergies` : les allergènes du convive identifié (pas ses régimes), pour le comptoir ; vide s'il n'en a pas.
 * `enCause` : ce que CE plat contient et que ce convive ne mange pas (allergène, porc, régime). Réserver le refuse, mais
 * un profil réglé après la réservation, ou un plat modifié, laisse passer le cas : le comptoir doit le voir avant de servir.
 */
export type ReponseScan = Scan & { convive?: string; conviveId?: string; photo?: string | null; plat?: string; code?: string; creneau?: string | null; allergies?: Etiquette[]; enCause?: Etiquette[] };

/**
 * Le comptoir a lu un QR ou tapé un code court. Seul un ticket d'aujourd'hui, encore réservé, passe à « servi », et
 * une seule fois. La réponse dit toujours pourquoi (src/lib/reservation.ts, scanner).
 */
export async function servir(cle: string, maintenant = Date.now()): Promise<ReponseScan> {
  const lu = lireCle(cle);
  if (!lu) return scanner(null, maintenant);
  let lue: NonNullable<ReturnType<typeof lireCle>> = lu;
  return prisma.$transaction(async (tx) => {
    const avec = { convive: { select: { id: true, name: true, image: true, profil: { select: { allergenes: true, regimes: true } } } }, menuJour: { include: { plat: { select: { nom: true, allergenes: true, porc: true, vegetarien: true } } } } } as const;
    const allergiesDe = (texte: string | undefined) => etiquettesAllergenes(lireListe(texte ?? ""));
    // La carte de cantine : le repas du jour de son élève, ou la raison pour laquelle il n'y en a pas.
    if ("carte" in lue) {
      const profil = await tx.profil.findUnique({ where: { carte: lue.carte }, select: { userId: true, allergenes: true, user: { select: { name: true, image: true } } } });
      if (!profil) return { genre: "inconnu" as const, phrase: "Carte inconnue" };
      const duJour = await tx.reservation.findFirst({ where: { conviveId: profil.userId, jour: jourIso(maintenant), etat: { not: "annulee" } }, include: avec });
      if (!duJour) return { genre: "inconnu" as const, phrase: "Pas de repas réservé aujourd'hui", convive: profil.user.name, conviveId: profil.userId, photo: profil.user.image ?? null, allergies: allergiesDe(profil.allergenes) };
      lue = { jeton: duJour.jeton };
    }
    const r = "jeton" in lue
      ? await tx.reservation.findUnique({ where: { jeton: lue.jeton }, include: avec })
      : (await tx.reservation.findFirst({ where: { code: lue.code, jour: jourIso(maintenant) }, include: avec }))
        ?? (await tx.reservation.findFirst({ where: { code: lue.code }, orderBy: { jour: "desc" }, include: avec }));
    let reponse = scanner(r, maintenant);
    if (!r) return reponse;
    if (reponse.genre === "servi") {
      // Sous condition : deux scans du même ticket au même instant, un seul sert, l'autre répond « déjà servi ».
      const fait = await tx.reservation.updateMany({ where: { id: r.id, etat: "reservee" }, data: { etat: "servie", serviLe: new Date(maintenant) } });
      if (fait.count !== 1) reponse = scanner({ etat: "servie", jour: r.jour, serviLe: new Date(maintenant) }, maintenant);
    }
    const enCause = etiquettesEnCause(
      { allergenes: lireListe(r.convive.profil?.allergenes ?? ""), regimes: lireListe(r.convive.profil?.regimes ?? "") },
      { allergenes: lireListe(r.menuJour.plat.allergenes), porc: r.menuJour.plat.porc, vegetarien: r.menuJour.plat.vegetarien },
    );
    return { ...reponse, convive: r.convive.name, conviveId: r.convive.id, photo: r.convive.image ?? null, plat: r.menuJour.plat.nom, code: r.code, creneau: r.creneau, allergies: allergiesDe(r.convive.profil?.allergenes), enCause };
  });
}

/** Noter un repas servi, de 1 à 5, avec un mot en option. Une note par repas : la renvoyer la remplace. */
export async function noter(conviveId: string, reservationId: string, note: number, mot = ""): Promise<Fait | Echec> {
  if (!noteValable(note)) return echec("Une note de 1 à 5");
  const r = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { menuJour: true } });
  if (!r || r.conviveId !== conviveId) return echec("Réservation introuvable");
  if (r.etat !== "servie") return echec("On note un repas une fois servi");
  const texte = mot.trim().slice(0, DESCRIPTION_MAX);
  await prisma.note.upsert({
    where: { reservationId },
    create: { reservationId, platId: r.menuJour.platId, conviveId, note, mot: texte },
    update: { note, mot: texte },
  });
  return FAIT;
}

/* ── Recharger ─────────────────────────────────────────────────────────────── */

async function referenceLibre(tx: Tx) {
  for (;;) {
    const reference = nouvelleReference();
    if (!(await tx.recharge.findUnique({ where: { reference } }))) return reference;
  }
}

const phraseMontant = `Un montant entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}`;

/**
 * Le convive pour lui-même, ou le parent pour son enfant, demande une recharge : elle attend son paiement.
 * `moyen` : « cartflox » quand le paiement en ligne est branché (il se confirme tout seul), sinon celui d'une recharge
 * que la cantine confirme à la main (`moyenManuel` : le QR universel s'il est actif, les espèces au comptoir sinon).
 * Le moyen se précise à la confirmation, selon le chemin qu'a pris le paiement.
 */
export async function demanderRecharge(demandeur: Pick<Moi, "id" | "role">, beneficiaireId: string, montant: number, moyen: MoyenRecharge = moyenManuel()): Promise<{ ok: true; id: string } | Echec> {
  if (!montantValable(montant)) return echec(phraseMontant);
  if (demandeur.role === "admin" || !(await peutAgirPour(demandeur, beneficiaireId))) return echec("Tu ne peux recharger que ton compte ou celui de ton enfant");
  if (!(await prisma.profil.findUnique({ where: { userId: beneficiaireId }, select: { userId: true } }))) return echec("Ce compte ne se recharge pas");
  const enAttente = await prisma.recharge.count({ where: { demandeurId: demandeur.id, etat: "en_attente" } });
  if (!peutDemander(enAttente)) return echec(`Tu as déjà ${ATTENTES_MAX} recharges en attente : annule-en une, ou laisse la cantine les confirmer`);
  const r = await prisma.$transaction(async (tx) =>
    tx.recharge.create({ data: { beneficiaireId, demandeurId: demandeur.id, montant, reference: await referenceLibre(tx), moyen } }));
  return { ok: true, id: r.id };
}

/** Celui qui a demandé la recharge peut l'annuler tant que la cantine ne l'a pas confirmée. */
export async function annulerRecharge(demandeurId: string, id: string, maintenant = Date.now()): Promise<Fait | Echec> {
  const r = await prisma.recharge.findUnique({ where: { id } });
  if (!r || r.demandeurId !== demandeurId) return echec("Recharge introuvable");
  if (!peutAnnulerRecharge(r)) return echec("Cette recharge ne s'annule plus");
  // Sous condition : si le paiement vient d'être crédité entre la lecture et l'écriture, la recharge reste confirmée.
  const fait = await prisma.recharge.updateMany({ where: { id, etat: "en_attente" }, data: { etat: "annulee", annuleeLe: new Date(maintenant) } });
  return fait.count === 1 ? FAIT : echec("Cette recharge ne s'annule plus");
}

/**
 * « Paiement reçu » : la cantine confirme, le mouvement s'écrit, le solde monte. Une seule fois par recharge : le passage
 * « en attente » vers « confirmée » est une écriture conditionnelle, deux clics ou deux écrans ne créditent jamais deux fois.
 * Le moyen devient « cartflox » si Cartflox a vu ce paiement réussir ; sinon celui d'une confirmation à la main
 * (`moyenManuel` : « pispi » quand le QR universel est actif, « especes » tant qu'il est coupé).
 */
export async function confirmerRecharge(adminId: string, id: string, maintenant = Date.now()): Promise<Fait | Echec> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.recharge.findUnique({ where: { id } });
    if (!r) return echec("Recharge introuvable");
    if (!peutConfirmer(r)) return echec("Cette recharge n'attend plus de confirmation");
    const payeeChezCartflox = (await tx.paiementCartflox.count({ where: { rechargeId: id, statut: "SUCCESS" } })) > 0;
    const fait = await tx.recharge.updateMany({
      where: { id, etat: "en_attente" },
      data: { etat: "confirmee", moyen: payeeChezCartflox ? "cartflox" : moyenManuel(), confirmeePar: adminId, confirmeeLe: new Date(maintenant) },
    });
    if (fait.count !== 1) return echec("Cette recharge n'attend plus de confirmation");
    const m = mouvementRecharge(r.montant);
    await tx.mouvement.create({
      data: { conviveId: r.beneficiaireId, genre: m.genre, montant: m.montant, libelle: `Recharge ${r.reference}`, rechargeId: r.id, creeLe: new Date(maintenant) },
    });
    return FAIT;
  });
}

/** Au comptoir, la cantine encaisse des espèces et crédite le compte tout de suite. */
export async function rechargerEnEspeces(adminId: string, beneficiaireId: string, montant: number, maintenant = Date.now()): Promise<{ ok: true; reference: string } | Echec> {
  if (!montantValable(montant)) return echec(phraseMontant);
  return prisma.$transaction(async (tx) => {
    if (!(await tx.profil.findUnique({ where: { userId: beneficiaireId }, select: { userId: true } }))) return echec("Ce compte ne se recharge pas");
    const r = await tx.recharge.create({
      data: { beneficiaireId, demandeurId: adminId, montant, reference: await referenceLibre(tx), moyen: "especes", etat: "confirmee", confirmeePar: adminId, creeLe: new Date(maintenant), confirmeeLe: new Date(maintenant) },
    });
    const m = mouvementRecharge(montant);
    await tx.mouvement.create({
      data: { conviveId: beneficiaireId, genre: m.genre, montant: m.montant, libelle: `Recharge en espèces ${r.reference}`, rechargeId: r.id, creeLe: new Date(maintenant) },
    });
    return { ok: true as const, reference: r.reference };
  });
}

/* ── Cartflox : les sessions de paiement d'une recharge ─────────────────────── */

/**
 * Relie une session de paiement Cartflox à une recharge. Une session ne sert qu'une recharge, pour toujours : c'est ce
 * qui empêche un même paiement de créditer deux fois. Une recharge qui n'attend plus rien ne reçoit pas de nouvelle
 * session, sauf `memeClose` (un webhook qui signale un paiement arrivé après coup : on le garde pour que la cantine le voie).
 * Ne vérifie pas QUI demande : l'action serveur le fait avant, le webhook prouve sa signature.
 */
export async function lierSessionCartflox(rechargeId: string, sessionId: string, memeClose = false): Promise<Fait | Echec> {
  if (!sessionValable(sessionId)) return echec("Ce paiement n'a pas la forme d'un paiement Cartflox");
  return prisma.$transaction(async (tx) => {
    const deja = await tx.paiementCartflox.findUnique({ where: { sessionId } });
    if (deja) return deja.rechargeId === rechargeId ? FAIT : echec("Ce paiement appartient à une autre recharge");
    const r = await tx.recharge.findUnique({ where: { id: rechargeId }, select: { etat: true } });
    if (!r) return echec("Recharge introuvable");
    if (r.etat !== "en_attente" && !memeClose) return echec("Cette recharge n'attend plus de paiement");
    await tx.paiementCartflox.create({ data: { sessionId, rechargeId } });
    return FAIT;
  });
}

/** Note ce que Cartflox dit d'une session : son statut, ce qu'il a encaissé, et une remarque pour la cantine. */
export async function noterSessionCartflox(sessionId: string, d: { statut: string; montant: number | null; devise: string | null; remarque: string | null }, maintenant = Date.now()) {
  await prisma.paiementCartflox.updateMany({
    where: { sessionId },
    data: { statut: d.statut.slice(0, 20), montant: d.montant, devise: d.devise?.slice(0, 3) ?? null, remarque: d.remarque?.slice(0, 200) ?? null, luLe: new Date(maintenant) },
  });
}

/**
 * Crédite une recharge payée par Cartflox, avec le montant DE LA RECHARGE (Cartflox a pu encaisser des frais en plus).
 * `par` : « cartflox » pour la vérification automatique, l'identifiant de l'administrateur quand il crédite à la main un
 * paiement que Cartflox n'a pas pu créditer tout seul ; lui seul peut aussi créditer une recharge annulée (`memeAnnulee`)
 * dont le paiement est arrivé après coup. Écriture conditionnelle : la page, le webhook et la cantine peuvent arriver en
 * même temps, la recharge n'est créditée qu'une fois. Une recharge déjà confirmée ne bouge plus.
 */
export async function crediterParCartflox(rechargeId: string, sessionId: string, par: string, maintenant = Date.now(), memeAnnulee = false): Promise<Fait | Echec> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.paiementCartflox.findUnique({ where: { sessionId } });
    if (!p || p.rechargeId !== rechargeId) return echec("Ce paiement n'est pas relié à cette recharge");
    const r = await tx.recharge.findUnique({ where: { id: rechargeId } });
    if (!r) return echec("Recharge introuvable");
    if (r.etat === "confirmee") return FAIT;
    const fait = await tx.recharge.updateMany({
      where: { id: rechargeId, etat: { in: memeAnnulee ? ["en_attente", "annulee"] : ["en_attente"] } },
      data: { etat: "confirmee", moyen: "cartflox", confirmeePar: par, confirmeeLe: new Date(maintenant) },
    });
    if (fait.count !== 1) return r.etat === "annulee" ? echec("Cette demande a été annulée : la cantine décide de la créditer") : FAIT;
    const m = mouvementRecharge(r.montant);
    await tx.mouvement.create({
      data: { conviveId: r.beneficiaireId, genre: m.genre, montant: m.montant, libelle: `Recharge ${r.reference} (Mobile Money)`, rechargeId: r.id, creeLe: new Date(maintenant) },
    });
    if (memeAnnulee) await tx.paiementCartflox.updateMany({ where: { sessionId }, data: { remarque: null } });
    return FAIT;
  });
}

/* ── Parent, profil alimentaire, seuil d'alerte ────────────────────────────── */

/**
 * L'élève crée le code que son parent saisira (src/lib/code-famille.ts) : un seul à la fois, valable 15 minutes, pour
 * un seul parent. Créer un code, c'est donner son accord. Il attend parmi les vérifications gardées en base (la table
 * de Better Auth pour ce qui expire), sous un nom à lui.
 */
export async function creerCodeFamille(conviveId: string, maintenant = Date.now()): Promise<{ ok: true; code: string; expire: number } | Echec> {
  if (!(await prisma.profil.findUnique({ where: { userId: conviveId }, select: { userId: true } }))) return echec("Seul un compte d'élève ou d'employé se relie à un parent");
  const expire = expirationCode(maintenant);
  return prisma.$transaction(async (tx) => {
    // L'ancien code de cet élève s'éteint, et les codes périmés de tout le monde s'en vont au passage.
    const anciens = await tx.verification.findMany({ where: { OR: [{ value: conviveId }, { expiresAt: { lte: new Date(maintenant) } }] }, select: { id: true, identifier: true } });
    await tx.verification.deleteMany({ where: { id: { in: anciens.filter((v) => estUnCodeFamille(v.identifier)).map((v) => v.id) } } });
    for (;;) {
      const code = nouveauCodeFamille();
      if (await tx.verification.findFirst({ where: { identifier: identifiantCode(code) }, select: { id: true } })) continue;
      await tx.verification.create({ data: { id: nouvelId("v_"), identifier: identifiantCode(code), value: conviveId, expiresAt: new Date(expire) } });
      return { ok: true as const, code, expire };
    }
  });
}

/**
 * Le parent saisit le code que son enfant vient de créer dans son compte. Le code ne sert qu'une fois : l'enfant relié,
 * il s'éteint. Cinq codes faux en dix minutes ferment la porte à ce parent (src/lib/tentatives.ts).
 */
export async function lierEnfant(parentId: string, codeFamille: string, maintenant = Date.now()): Promise<{ ok: true; enfant: string } | Echec> {
  const code = nettoyerCode(codeFamille);
  if (code.length !== 6) return echec("Le code famille fait 6 caractères");
  const cle = `code:${parentId}`;
  if (tentatives.bloque(cle, LIMITE_CODE, maintenant)) return echec(TROP_D_ESSAIS);
  return prisma.$transaction(async (tx) => {
    const v = await tx.verification.findFirst({ where: { identifier: identifiantCode(code) } });
    const verdict = codeUtilisable(v ? { expire: v.expiresAt.getTime() } : null, maintenant);
    const enfant = v && verdict.ok ? await tx.user.findUnique({ where: { id: v.value }, select: { id: true, name: true, profil: { select: { userId: true } } } }) : null;
    if (!v || !enfant?.profil) {
      tentatives.rate(cle, LIMITE_CODE, maintenant);
      return echec(CODE_PAS_VALABLE);
    }
    if (await tx.lienParent.findUnique({ where: { parentId_enfantId: { parentId, enfantId: enfant.id } } })) return echec(`${enfant.name} est déjà dans ta liste`);
    await tx.lienParent.create({ data: { parentId, enfantId: enfant.id, creeLe: new Date(maintenant) } });
    await tx.verification.deleteMany({ where: { id: v.id } });
    return { ok: true as const, enfant: enfant.name };
  });
}

/** L'élève retire un parent de son compte : ce parent ne voit plus rien et ne peut plus rien pour lui. */
export async function retirerParent(conviveId: string, parentId: string): Promise<Fait | Echec> {
  const fait = await prisma.lienParent.deleteMany({ where: { enfantId: conviveId, parentId } });
  return fait.count === 1 ? FAIT : echec("Ce parent n'est plus relié à ton compte");
}

/** Un repas déjà réservé que le profil alimentaire écarte maintenant, et ce qui l'écarte. */
export type RepasEnCause = { jour: string; plat: string; enCause: Etiquette[] };

/**
 * Le convive règle son profil alimentaire ; son parent peut le faire pour lui. Valeurs inconnues écartées.
 * `repasEnCause` : ses repas déjà réservés, d'aujourd'hui ou à venir, que ce profil écarte. Réserver les aurait
 * refusés ; ils restent réservés, l'écran prévient tout de suite et le comptoir le verra au moment de servir.
 */
export async function enregistrerProfilAlimentaire(acteur: Pick<Moi, "id" | "role">, conviveId: string, d: { allergenes: string[]; regimes: string[] }, maintenant = Date.now()): Promise<{ ok: true; repasEnCause: RepasEnCause[] } | Echec> {
  if (!(await peutAgirPour(acteur, conviveId))) return echec("Tu ne peux régler que ton profil ou celui de ton enfant");
  const ecrit = { allergenes: ecrireListe(d.allergenes, IDS_ALLERGENES), regimes: ecrireListe(d.regimes, IDS_REGIMES) };
  const fait = await prisma.profil.updateMany({ where: { userId: conviveId }, data: ecrit });
  if (fait.count !== 1) return echec("Profil introuvable");
  const profil = { allergenes: lireListe(ecrit.allergenes), regimes: lireListe(ecrit.regimes) };
  const reserves = await prisma.reservation.findMany({
    where: { conviveId, etat: "reservee", jour: { gte: jourIso(maintenant) } },
    orderBy: { jour: "asc" },
    select: { jour: true, menuJour: { select: { plat: { select: { nom: true, allergenes: true, porc: true, vegetarien: true } } } } },
  });
  const repasEnCause = reserves
    .map((r) => ({ jour: r.jour, plat: r.menuJour.plat.nom, enCause: etiquettesEnCause(profil, { allergenes: lireListe(r.menuJour.plat.allergenes), porc: r.menuJour.plat.porc, vegetarien: r.menuJour.plat.vegetarien }) }))
    .filter((r) => r.enCause.length > 0);
  return { ok: true, repasEnCause };
}

/**
 * Choisir un avatar dessiné (public/avatars), ou revenir à ses initiales (null) : pour son propre compte, ou pour celui
 * de son enfant. Aucune autre adresse ne s'écrit sur un compte.
 */
export async function choisirAvatar(acteur: Pick<Moi, "id" | "role">, personneId: string, avatar: string | null): Promise<Fait | Echec> {
  if (avatar !== null && !avatarPermis(avatar)) return echec("Choisis un des avatars de la cantine");
  if (acteur.id !== personneId && !(await peutAgirPour(acteur, personneId))) return echec("Tu ne peux changer que ton avatar ou celui de ton enfant");
  const fait = await prisma.user.updateMany({ where: { id: personneId }, data: { image: avatar } });
  return fait.count === 1 ? FAIT : echec("Compte introuvable");
}

export async function reglerSeuilAlerte(acteur: Pick<Moi, "id" | "role">, conviveId: string, seuil: number): Promise<Fait | Echec> {
  if (!seuilValable(seuil)) return echec(`Un seuil entre 0 et ${fcfa(SEUIL_ALERTE_MAX)}`);
  if (!(await peutAgirPour(acteur, conviveId))) return echec("Tu ne peux régler que ton seuil ou celui de ton enfant");
  const fait = await prisma.profil.updateMany({ where: { userId: conviveId }, data: { seuilAlerte: seuil } });
  return fait.count === 1 ? FAIT : echec("Profil introuvable");
}

/* ── Menus (administrateur) ────────────────────────────────────────────────── */

export type DonneesPlat = {
  nom: string;
  description: string;
  /** Une image de public/plats, ou vide. */
  photo: string;
  prix: number;
  allergenes: string[];
  porc: boolean;
  vegetarien: boolean;
};

const PHRASE_PRIX = `Un prix entre ${nombre(PRIX_MIN)} et ${fcfa(PRIX_MAX)}, sans centimes`;
const PHRASE_PORTIONS = `Des portions entre 1 et ${nombre(PORTIONS_MAX)}, ou rien`;

async function platValide(d: DonneesPlat): Promise<{ ok: true; data: Omit<DonneesPlat, "allergenes"> & { allergenes: string } } | Echec> {
  const nom = d.nom.trim();
  if (nom.length < 2 || nom.length > NOM_MAX) return echec(`Un nom de plat de 2 à ${NOM_MAX} caractères`);
  if (!prixValable(d.prix)) return echec(PHRASE_PRIX);
  if (d.photo && !(await photosDisponibles()).includes(d.photo)) return echec("Cette photo n'est pas dans la liste");
  if (d.porc && d.vegetarien) return echec("Un plat ne peut pas être végétarien et contenir du porc");
  return {
    ok: true,
    data: { nom, description: d.description.trim().slice(0, DESCRIPTION_MAX), photo: d.photo, prix: d.prix, allergenes: ecrireListe(d.allergenes, IDS_ALLERGENES), porc: d.porc, vegetarien: d.vegetarien },
  };
}

export async function creerPlat(d: DonneesPlat): Promise<{ ok: true; id: string } | Echec> {
  const v = await platValide(d);
  if (!v.ok) return v;
  const p = await prisma.plat.create({ data: v.data });
  return { ok: true, id: p.id };
}

export async function modifierPlat(id: string, d: DonneesPlat): Promise<Fait | Echec> {
  const v = await platValide(d);
  if (!v.ok) return v;
  const fait = await prisma.plat.updateMany({ where: { id }, data: v.data });
  return fait.count === 1 ? FAIT : echec("Plat introuvable");
}

/** Met un plat au menu d'un jour, avec son prix de ce jour-là et ses portions prévues (null : pas de limite). */
export async function ajouterAuMenu(jour: string, platId: string, prix: number, portions: number | null): Promise<{ ok: true; id: string } | Echec> {
  if (!estUnJour(jour)) return echec("Ce jour n'existe pas");
  if (!prixValable(prix)) return echec(PHRASE_PRIX);
  if (!portionsValables(portions)) return echec(PHRASE_PORTIONS);
  if (!(await prisma.plat.findUnique({ where: { id: platId }, select: { id: true } }))) return echec("Plat introuvable");
  if (await prisma.menuJour.findUnique({ where: { jour_platId: { jour, platId } } })) return echec("Ce plat est déjà au menu de ce jour");
  const mj = await prisma.menuJour.create({ data: { jour, platId, prix, portions } });
  return { ok: true, id: mj.id };
}

/** Change le prix (pour les prochaines réservations : un repas déjà réservé garde son prix), les portions, l'état épuisé. */
export async function modifierMenuJour(id: string, d: { prix: number; portions: number | null; epuise: boolean }): Promise<Fait | Echec> {
  if (!prixValable(d.prix)) return echec(PHRASE_PRIX);
  if (!portionsValables(d.portions)) return echec(PHRASE_PORTIONS);
  const fait = await prisma.menuJour.updateMany({ where: { id }, data: { prix: d.prix, portions: d.portions, epuise: d.epuise } });
  return fait.count === 1 ? FAIT : echec("Ce plat n'est plus au menu");
}

/**
 * Retire un plat du menu d'un jour s'il n'a jamais été réservé. Une réservation, même annulée, garde sa trace dans le
 * journal : le plat reste alors au menu, et on le marque épuisé.
 */
export async function retirerDuMenu(id: string): Promise<Fait | Echec> {
  return prisma.$transaction(async (tx) => {
    const reservations = await tx.reservation.count({ where: { menuJourId: id } });
    if (!peutRetirer(reservations)) return echec("Ce plat a déjà été réservé : marque-le épuisé plutôt");
    await tx.menuJour.deleteMany({ where: { id } });
    return FAIT;
  });
}

/* ── La comptabilité : les dépenses de la cantine ──────────────────────────── */

/** Noter une dépense de la cantine. Elle entre dans le bilan ; elle ne touche aucun solde d'élève. */
export async function ajouterDepense(d: DepenseSaisie, noteePar: string): Promise<{ ok: true } | Echec> {
  const refus = refusDepense(d, jourIso(Date.now()));
  if (refus) return echec(refus);
  await prisma.depense.create({
    data: { jour: d.jour, categorie: d.categorie, libelle: d.libelle.trim(), montant: d.montant, fournisseur: d.fournisseur.trim(), moyen: d.moyen, noteePar },
  });
  return { ok: true };
}

/**
 * Retirer une dépense notée par erreur. Celle d'une livraison de la réserve se retire avec sa livraison, depuis Besoins :
 * retirée seule, elle laisserait dans le stock une livraison sans son achat.
 */
export async function retirerDepense(id: string): Promise<{ ok: true } | Echec> {
  if (await prisma.mouvementStock.findFirst({ where: { depenseId: id }, select: { id: true } })) {
    return echec("Cette dépense vient d'une livraison : retire-la depuis Besoins");
  }
  const r = await prisma.depense.deleteMany({ where: { id } });
  return r.count === 1 ? { ok: true } : echec("Cette dépense n'existe plus");
}

/* ── La réserve de la cuisine (lot 2 des besoins, 21/11/2026) ──────────────── */

export type LivraisonSaisie = { ingredientId: string; quantite: number; prix: number | null; jour: string; fournisseur: string; moyen: string };

/**
 * Une livraison arrive : le stock de l'ingrédient monte. Payée, sa dépense se note dans la même transaction
 * (catégorie « ingredients », src/lib/comptabilite.ts) : la comptabilité et la réserve disent la même chose.
 */
export async function livrerIngredient(l: LivraisonSaisie, noteePar: string): Promise<{ ok: true } | Echec> {
  const aujourdhui = jourIso(Date.now());
  const refus = refusLivraison(l, aujourdhui);
  if (refus) return echec(refus);
  const ingredient = await prisma.ingredient.findUnique({ where: { id: l.ingredientId }, select: { nom: true, unite: true } });
  if (!ingredient) return echec("Cet ingrédient n'existe plus");
  const libelle = libelleLivraison(ingredient.nom, l.quantite, ingredient.unite as Unite);
  const depense: DepenseSaisie | null = l.prix === null ? null
    : { jour: l.jour, categorie: "ingredients", libelle, montant: l.prix, fournisseur: l.fournisseur, moyen: l.moyen };
  const refusD = depense && refusDepense(depense, aujourdhui);
  if (refusD) return echec(refusD);
  await prisma.$transaction(async (tx) => {
    const notee = depense
      ? await tx.depense.create({ data: { ...depense, libelle: depense.libelle.trim(), fournisseur: depense.fournisseur.trim(), noteePar } })
      : null;
    await tx.mouvementStock.create({
      data: { ingredientId: l.ingredientId, genre: "livraison", quantite: l.quantite, jour: l.jour, prix: l.prix, depenseId: notee?.id ?? null, note: l.fournisseur.trim(), noteePar },
    });
  });
  return { ok: true };
}

/**
 * Retirer une livraison notée par erreur : le mouvement de stock et sa dépense (catégorie « ingredients ») partent
 * ensemble, dans la même transaction, pour que le bilan ne garde pas un achat qui n'existe plus.
 */
export async function retirerLivraison(id: string): Promise<{ ok: true } | Echec> {
  const m = await prisma.mouvementStock.findUnique({ where: { id }, select: { genre: true, depenseId: true } });
  if (!m || m.genre !== "livraison") return echec("Cette livraison n'existe plus");
  await prisma.$transaction(async (tx) => {
    if (m.depenseId) await tx.depense.deleteMany({ where: { id: m.depenseId } });
    await tx.mouvementStock.delete({ where: { id } });
  });
  return { ok: true };
}

/** L'inventaire : on compte ce qui est là. L'écart avec le stock calculé se note ; le stock devient le compte. */
export async function compterIngredient(ingredientId: string, compte: number, noteePar: string): Promise<{ ok: true; ecart: number } | Echec> {
  const refus = refusInventaire(compte);
  if (refus) return echec(refus);
  if (!(await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { id: true } }))) return echec("Cet ingrédient n'existe plus");
  return prisma.$transaction(async (tx) => {
    const ecart = compte - stockDe(await tx.mouvementStock.findMany({ where: { ingredientId }, select: { quantite: true } }));
    if (ecart !== 0) await tx.mouvementStock.create({ data: { ingredientId, genre: "inventaire", quantite: ecart, jour: jourIso(Date.now()), noteePar } });
    return { ok: true as const, ecart };
  });
}

/**
 * La case « Sorti » de la liste du jour : cochée, la quantité de ce jour sort de la réserve (le serveur l'a calculée) ;
 * décochée, cette sortie s'annule. Une seule sortie par ingrédient et par jour.
 */
export async function basculerSortie(ingredientId: string, jour: string, quantite: number, noteePar: string): Promise<{ ok: true; sorti: boolean } | Echec> {
  if (!estUnJour(jour)) return echec("Ce jour n'existe pas");
  return prisma.$transaction(async (tx): Promise<{ ok: true; sorti: boolean } | Echec> => {
    // Décocher annule toujours, même si le besoin a changé depuis (des réservations annulées).
    const deja = await tx.mouvementStock.findMany({ where: { ingredientId, jour, genre: "sortie" }, select: { id: true } });
    if (deja.length > 0) {
      await tx.mouvementStock.deleteMany({ where: { id: { in: deja.map((d) => d.id) } } });
      return { ok: true, sorti: false };
    }
    if (!Number.isInteger(quantite) || quantite < 1) return echec("Rien à sortir pour cet ingrédient ce jour-là");
    await tx.mouvementStock.create({ data: { ingredientId, genre: "sortie", quantite: -quantite, jour, noteePar } });
    return { ok: true, sorti: true };
  });
}
