import "server-only";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { peutAgirPour, photosDisponibles } from "@/lib/donnees";
import { fcfa } from "@/lib/format";
import { estUnJour, jourIso, jourLong } from "@/lib/jours";
import { IDS_ALLERGENES, IDS_REGIMES, ecrireListe, lireListe } from "@/lib/listes";
import { DESCRIPTION_MAX, NOM_MAX, noteValable, peutRetirer, portionsValables, prixValable } from "@/lib/menu";
import { incompatibilites } from "@/lib/profil-alimentaire";
import { ATTENTES_MAX, RECHARGE_MAX, RECHARGE_MIN, montantValable, peutAnnulerRecharge, peutConfirmer, peutDemander } from "@/lib/recharge";
import { peutAnnuler, peutReserver, scanner, type Scan } from "@/lib/reservation";
import type { Moi, Role } from "@/lib/session";
import { mouvementRecharge, mouvementRemboursement, mouvementRepas, seuilValable, soldeDe } from "@/lib/solde";
import { lireCle, nettoyerCode, nouveauCode, nouveauCodeFamille, nouveauJeton, nouvelleReference } from "@/lib/ticket";

// TOUT ce qui écrit dans la base passe par ici. Chaque geste applique la règle pure (src/lib/*.ts), puis écrit dans une
// seule transaction : une réservation et son mouvement d'argent partent ensemble ou pas du tout.
// Ces fonctions ne vérifient pas QUI appelle (sauf quand elles reçoivent l'acteur) : l'action serveur le fait avant,
// avec `autorise()` de src/lib/session.ts.

type Tx = Prisma.TransactionClient;
export type Echec = { ok: false; erreur: string };
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

export async function seConnecter(email: string, motDePasse: string): Promise<{ ok: true; role: Role } | Echec> {
  const adresse = email.trim().toLowerCase();
  try {
    await auth.api.signInEmail({ body: { email: adresse, password: motDePasse }, headers: await headers() });
  } catch (e) {
    return echec(messageConnexion(e, "E-mail ou mot de passe incorrect"));
  }
  const u = await prisma.user.findUnique({ where: { email: adresse }, select: { role: true } });
  return { ok: true, role: (u?.role ?? "convive") as Role };
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

/** Réserver, c'est payer : la réservation et son mouvement s'écrivent ensemble. Rend le jeton du ticket. */
export async function reserver(conviveId: string, menuJourId: string, maintenant = Date.now()): Promise<{ ok: true; jeton: string } | Echec> {
  return prisma.$transaction(async (tx) => {
    const mj = await tx.menuJour.findUnique({ where: { id: menuJourId }, include: { plat: true } });
    if (!mj) return echec("Ce plat n'est plus au menu");
    const profil = await tx.profil.findUnique({ where: { userId: conviveId } });
    if (!profil) return echec("Seul un compte d'élève ou d'employé peut réserver un repas");
    const dejaReserve = (await tx.reservation.count({ where: { conviveId, jour: mj.jour, etat: { not: "annulee" } } })) > 0;
    const reservees = await tx.reservation.count({ where: { menuJourId, etat: { not: "annulee" } } });
    const verdict = peutReserver({
      maintenant,
      jour: mj.jour,
      dejaReserve,
      epuise: mj.epuise,
      portions: mj.portions,
      reservees,
      incompatibilites: incompatibilites(
        { allergenes: lireListe(profil.allergenes), regimes: lireListe(profil.regimes) },
        { allergenes: lireListe(mj.plat.allergenes), porc: mj.plat.porc, vegetarien: mj.plat.vegetarien },
      ),
      solde: await soldeDans(tx, conviveId),
      prix: mj.prix,
    });
    if (!verdict.ok) return echec(verdict.phrase);

    const r = await tx.reservation.create({
      data: { conviveId, menuJourId, jour: mj.jour, prix: mj.prix, jeton: nouveauJeton(), code: await codeLibre(tx, mj.jour), creeLe: new Date(maintenant) },
    });
    const m = mouvementRepas(mj.prix);
    await tx.mouvement.create({
      data: { conviveId, genre: m.genre, montant: m.montant, libelle: `Repas du ${jourLong(mj.jour)} : ${mj.plat.nom}`, reservationId: r.id, creeLe: new Date(maintenant) },
    });
    return { ok: true as const, jeton: r.jeton };
  });
}

/** Annuler avant la clôture rembourse le repas en entier, dans la même transaction. */
export async function annuler(conviveId: string, reservationId: string, maintenant = Date.now()): Promise<Fait | Echec> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id: reservationId }, include: { menuJour: { include: { plat: true } } } });
    if (!r || r.conviveId !== conviveId) return echec("Réservation introuvable");
    const verdict = peutAnnuler(r, maintenant);
    if (!verdict.ok) return echec(verdict.phrase);
    await tx.reservation.update({ where: { id: r.id }, data: { etat: "annulee", annuleLe: new Date(maintenant) } });
    const m = mouvementRemboursement(r.prix);
    await tx.mouvement.create({
      data: { conviveId, genre: m.genre, montant: m.montant, libelle: `Annulation : ${r.menuJour.plat.nom}`, reservationId: r.id, creeLe: new Date(maintenant) },
    });
    return FAIT;
  });
}

export type ReponseScan = Scan & { convive?: string; plat?: string; code?: string };

/**
 * Le comptoir a lu un QR ou tapé un code court. Seul un ticket d'aujourd'hui, encore réservé, passe à « servi », et
 * une seule fois. La réponse dit toujours pourquoi (src/lib/reservation.ts, scanner).
 */
export async function servir(cle: string, maintenant = Date.now()): Promise<ReponseScan> {
  const lue = lireCle(cle);
  if (!lue) return scanner(null, maintenant);
  return prisma.$transaction(async (tx) => {
    const avec = { convive: { select: { name: true } }, menuJour: { include: { plat: { select: { nom: true } } } } } as const;
    const r = "jeton" in lue
      ? await tx.reservation.findUnique({ where: { jeton: lue.jeton }, include: avec })
      : (await tx.reservation.findFirst({ where: { code: lue.code, jour: jourIso(maintenant) }, include: avec }))
        ?? (await tx.reservation.findFirst({ where: { code: lue.code }, orderBy: { jour: "desc" }, include: avec }));
    const reponse = scanner(r, maintenant);
    if (!r) return reponse;
    if (reponse.genre === "servi") await tx.reservation.update({ where: { id: r.id }, data: { etat: "servie", serviLe: new Date(maintenant) } });
    return { ...reponse, convive: r.convive.name, plat: r.menuJour.plat.nom, code: r.code };
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

/** Le convive pour lui-même, ou le parent pour son enfant, demande une recharge : elle attend la cantine. */
export async function demanderRecharge(demandeur: Pick<Moi, "id" | "role">, beneficiaireId: string, montant: number): Promise<{ ok: true; id: string } | Echec> {
  if (!montantValable(montant)) return echec(phraseMontant);
  if (demandeur.role === "admin" || !(await peutAgirPour(demandeur, beneficiaireId))) return echec("Tu ne peux recharger que ton compte ou celui de ton enfant");
  if (!(await prisma.profil.findUnique({ where: { userId: beneficiaireId }, select: { userId: true } }))) return echec("Ce compte ne se recharge pas");
  const enAttente = await prisma.recharge.count({ where: { demandeurId: demandeur.id, etat: "en_attente" } });
  if (!peutDemander(enAttente)) return echec(`Tu as déjà ${ATTENTES_MAX} recharges en attente : annule-en une, ou laisse la cantine les confirmer`);
  const r = await prisma.$transaction(async (tx) =>
    tx.recharge.create({ data: { beneficiaireId, demandeurId: demandeur.id, montant, reference: await referenceLibre(tx), moyen: "pispi" } }));
  return { ok: true, id: r.id };
}

/** Celui qui a demandé la recharge peut l'annuler tant que la cantine ne l'a pas confirmée. */
export async function annulerRecharge(demandeurId: string, id: string, maintenant = Date.now()): Promise<Fait | Echec> {
  const r = await prisma.recharge.findUnique({ where: { id } });
  if (!r || r.demandeurId !== demandeurId) return echec("Recharge introuvable");
  if (!peutAnnulerRecharge(r)) return echec("Cette recharge ne s'annule plus");
  await prisma.recharge.update({ where: { id }, data: { etat: "annulee", annuleeLe: new Date(maintenant) } });
  return FAIT;
}

/** « Paiement reçu » : la cantine confirme, le mouvement s'écrit, le solde monte. Une seule fois par recharge. */
export async function confirmerRecharge(adminId: string, id: string, maintenant = Date.now()): Promise<Fait | Echec> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.recharge.findUnique({ where: { id } });
    if (!r) return echec("Recharge introuvable");
    if (!peutConfirmer(r)) return echec("Cette recharge n'attend plus de confirmation");
    await tx.recharge.update({ where: { id }, data: { etat: "confirmee", confirmeePar: adminId, confirmeeLe: new Date(maintenant) } });
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

/* ── Parent, profil alimentaire, seuil d'alerte ────────────────────────────── */

/** Le parent saisit le code famille de son enfant (lu dans le compte de l'enfant). */
export async function lierEnfant(parentId: string, codeFamille: string): Promise<{ ok: true; enfant: string } | Echec> {
  const code = nettoyerCode(codeFamille);
  if (code.length !== 6) return echec("Le code famille fait 6 caractères");
  const profil = await prisma.profil.findUnique({ where: { codeFamille: code }, include: { user: { select: { id: true, name: true } } } });
  if (!profil) return echec("Ce code ne correspond à aucun compte");
  if (await prisma.lienParent.findUnique({ where: { parentId_enfantId: { parentId, enfantId: profil.userId } } })) return echec(`${profil.user.name} est déjà dans ta liste`);
  await prisma.lienParent.create({ data: { parentId, enfantId: profil.userId } });
  return { ok: true, enfant: profil.user.name };
}

/** Le convive règle son profil alimentaire ; son parent peut le faire pour lui. Valeurs inconnues écartées. */
export async function enregistrerProfilAlimentaire(acteur: Pick<Moi, "id" | "role">, conviveId: string, d: { allergenes: string[]; regimes: string[] }): Promise<Fait | Echec> {
  if (!(await peutAgirPour(acteur, conviveId))) return echec("Tu ne peux régler que ton profil ou celui de ton enfant");
  const fait = await prisma.profil.updateMany({
    where: { userId: conviveId },
    data: { allergenes: ecrireListe(d.allergenes, IDS_ALLERGENES), regimes: ecrireListe(d.regimes, IDS_REGIMES) },
  });
  return fait.count === 1 ? FAIT : echec("Profil introuvable");
}

export async function reglerSeuilAlerte(acteur: Pick<Moi, "id" | "role">, conviveId: string, seuil: number): Promise<Fait | Echec> {
  if (!seuilValable(seuil)) return echec("Un seuil entre 0 et 50 000 francs");
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

async function platValide(d: DonneesPlat): Promise<{ ok: true; data: Omit<DonneesPlat, "allergenes"> & { allergenes: string } } | Echec> {
  const nom = d.nom.trim();
  if (nom.length < 2 || nom.length > NOM_MAX) return echec("Un nom de plat de 2 à 60 caractères");
  if (!prixValable(d.prix)) return echec("Un prix entre 100 et 50 000 francs, sans centimes");
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
  if (!prixValable(prix)) return echec("Un prix entre 100 et 50 000 francs, sans centimes");
  if (!portionsValables(portions)) return echec("Des portions entre 1 et 5 000, ou rien");
  if (!(await prisma.plat.findUnique({ where: { id: platId }, select: { id: true } }))) return echec("Plat introuvable");
  if (await prisma.menuJour.findUnique({ where: { jour_platId: { jour, platId } } })) return echec("Ce plat est déjà au menu de ce jour");
  const mj = await prisma.menuJour.create({ data: { jour, platId, prix, portions } });
  return { ok: true, id: mj.id };
}

/** Change le prix (pour les prochaines réservations : un repas déjà réservé garde son prix), les portions, l'état épuisé. */
export async function modifierMenuJour(id: string, d: { prix: number; portions: number | null; epuise: boolean }): Promise<Fait | Echec> {
  if (!prixValable(d.prix)) return echec("Un prix entre 100 et 50 000 francs, sans centimes");
  if (!portionsValables(d.portions)) return echec("Des portions entre 1 et 5 000, ou rien");
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
