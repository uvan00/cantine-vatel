import { z } from "zod";
import { configCartflox } from "@/lib/cartflox-serveur";
import { peutAgirPour, soldeDuCompte } from "@/lib/donnees";
import { Identifiant, enfantsDuParent, rechargesEnAttenteDe } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { erreur, refus, reponse } from "@/lib/mobile";
import { demanderRecharge } from "@/lib/operations";
import { MONTANTS_RAPIDES, RECHARGE_MAX, RECHARGE_MIN, montantValable, moyenManuel } from "@/lib/recharge";
import { autorise, prenomDe } from "@/lib/session";
import { lignesEnAttente } from "./commun";

// Recharger un compte, comme la page /recharger du site : le convive le sien, le parent celui d'un de ses enfants
// (« ?pour=<id> » le choisit d'avance, s'il est bien le sien). GET : les comptes, les montants permis et les recharges
// en attente. POST : crée la demande (src/lib/operations.ts, `peutAgirPour`) ; l'écran ouvre ensuite sa page.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

type Compte = { id: string; nom: string; prenom: string; classe: string; solde: number; photo: string | null };
/** Sous le nom : « Bachelor 2, solde 2 000 F CFA », ou « Solde 1 500 F CFA » sans classe (comme le site). */
const detail = (c: Compte) => (c.classe ? `${c.classe}, solde ${fcfa(c.solde)}` : `Solde ${fcfa(c.solde)}`);

export async function GET(requete: Request) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const pour = new URL(requete.url).searchParams.get("pour");
  const parent = moi.role === "parent";
  const [comptes, enAttente] = await Promise.all([
    parent
      ? enfantsDuParent(moi.id).then((enfants) => enfants.map((e): Compte => ({ id: e.id, nom: e.nom, prenom: prenomDe(e.nom), classe: e.classe, solde: e.solde, photo: e.photo })))
      : soldeDuCompte(moi.id).then((solde): Compte[] => [{ id: moi.id, nom: moi.nom, prenom: prenomDe(moi.nom), classe: "", solde, photo: moi.photo }]),
    rechargesEnAttenteDe(moi.id),
  ]);
  // On ne présélectionne qu'un compte que cette personne peut recharger : un identifiant d'ailleurs est ignoré.
  const choisi = comptes.find((c) => c.id === pour)?.id ?? (comptes.length === 1 ? comptes[0].id : "");
  return reponse(requete, {
    parent,
    sousTitre: comptes.length > 0 ? (configCartflox() ? "Le compte est crédité dès que le paiement passe" : "La cantine confirme dès qu'elle voit ton paiement") : null,
    comptes: comptes.map((c) => ({ ...c, detail: detail(c) })),
    choisi,
    montantsRapides: MONTANTS_RAPIDES,
    min: RECHARGE_MIN,
    max: RECHARGE_MAX,
    aideMontant: `Entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}`,
    enAttente: lignesEnAttente(enAttente, moi.id, maintenant()),
  });
}

const phraseMontant = `Un montant entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}, sans centimes`;

// La même validation que `demanderUneRecharge` du site (src/app/(espace)/recharger/actions.ts).
const Demande = z.object({
  /** L'enfant à recharger, pour un parent. Un convive recharge toujours son propre compte : ce champ est alors ignoré. */
  pour: z.string().max(64),
  montant: z.string().max(20, phraseMontant).transform((t) => t.replace(/\s/g, ""))
    .pipe(z.string().min(1, "Choisis un montant").regex(/^\d{1,7}$/, phraseMontant)).transform(Number).refine(montantValable, phraseMontant),
});

export async function POST(requete: Request) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  let brut: unknown;
  try { brut = await requete.json(); } catch { brut = null; }
  const v = Demande.safeParse(brut);
  if (!v.success) return erreur(requete, v.error.issues[0]?.message ?? phraseMontant);
  let beneficiaireId = moi.id;
  if (moi.role === "parent") {
    const enfant = Identifiant.safeParse(v.data.pour);
    if (!enfant.success) return erreur(requete, "Choisis d'abord pour qui tu recharges");
    // Un parent ne recharge que ses enfants : l'enfant d'un autre est refusé avant toute écriture.
    if (!(await peutAgirPour(moi, enfant.data))) return erreur(requete, "Tu ne peux recharger que ton compte ou celui de ton enfant", 403);
    beneficiaireId = enfant.data;
  }
  const r = await demanderRecharge(moi, beneficiaireId, v.data.montant, configCartflox() ? "cartflox" : moyenManuel());
  return r.ok ? reponse(requete, { id: r.id }) : erreur(requete, r.erreur, 409);
}
