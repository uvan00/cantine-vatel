import { z } from "zod";
import { lireReglages } from "@/lib/donnees";
import { ticketDe } from "@/lib/donnees-convive";
import { creneauLisible } from "@/lib/creneaux";
import { dateLongue } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { clotureLisible, jourIso, jourLong, jourProche } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { erreur, refus, reponse } from "@/lib/mobile";
import { qrSvg } from "@/lib/qr";
import { LIBELLE_ETAT, etatAffiche, heureH, nomDeLaFile, paiementLisible, peutAnnuler } from "@/lib/reservation";
import { autorise, origine } from "@/lib/session";

// Un ticket entier, comme la page /ticket/<jeton> du site. Son QR est fabriqué ici, par la même fonction et pour la même
// adresse que sur le site (`<origine>/ticket/<jeton>`) : le scanner du comptoir le lit pareil. Seul son propriétaire le voit.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Jeton = z.string().regex(/^[0-9a-f]{32}$/);

export async function GET(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const jeton = Jeton.safeParse((await params).jeton);
  const repas = jeton.success ? await ticketDe(jeton.data) : null;
  if (!repas || repas.conviveId !== moi.id) return erreur(requete, "Ticket inconnu", 404);

  const instant = maintenant();
  const { heureCloture } = await lireReglages();
  const annulation = peutAnnuler(repas, instant, heureCloture);
  const etat = etatAffiche(repas, instant);
  const adresse = `${await origine()}/ticket/${repas.jeton}`;
  return reponse(requete, {
    id: repas.id,
    jeton: repas.jeton,
    cantine: MARQUE.cantine,
    convive: repas.convive,
    plat: repas.plat,
    jour: repas.jour,
    jourLong: jourLong(repas.jour),
    prix: repas.prix,
    code: repas.code,
    reserveLe: dateLongue(repas.reserveLe),
    quand: jourProche(repas.jour, instant),
    etat,
    libelleEtat: LIBELLE_ETAT[etat],
    // Sa file au comptoir et comment il est payé (src/lib/reservation.ts), en identifiants et en mots.
    file: repas.file,
    nomFile: nomDeLaFile(repas.file),
    paiement: repas.paiement,
    libellePaiement: paiementLisible(repas.paiement, etat),
    serviA: repas.serviLe ? heureH(repas.serviLe) : null,
    // Seul le ticket d'aujourd'hui, pas encore servi, peut changer sous les yeux du convive : lui seul se relit.
    enDirect: repas.etat === "reservee" && repas.jour === jourIso(instant),
    refusAnnulation: annulation.ok ? null : annulation.phrase,
    clotureLisible: clotureLisible(heureCloture),
    creneau: repas.creneau ? creneauLisible(repas.creneau) : null,
    note: repas.note,
    mot: repas.mot,
    adresse,
    qr: await qrSvg(adresse),
  });
}
