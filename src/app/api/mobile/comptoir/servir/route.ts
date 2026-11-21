import { z } from "zod";
import { creneauLisible } from "@/lib/creneaux";
import { serviceDuJour } from "@/lib/donnees-admin";
import { platsAuComptoir } from "@/lib/donnees-comptoir";
import { aujourdhui } from "@/lib/horloge";
import { lireCorps, refus, reponse } from "@/lib/mobile";
import { servir, servirAuBadge } from "@/lib/operations";
import { MOYENS_COMPTOIR } from "@/lib/reservation";
import { CANTINE, autorise, prenomDe } from "@/lib/session";

// Servir un ticket au comptoir, comme `servirTicket` du site : le texte lu dans le QR (l'adresse du ticket) ou le code
// tapé part tel quel, et src/lib/operations.ts (servir) en tire le jeton ou le code avec lireCle. La réponse dit
// toujours pourquoi, en mots (src/lib/reservation.ts, scanner), avec les repas du jour après ce geste.
// Les trois files (21/11/2026) : « a_payer » rend `prix` et `solde`, et se rappelle avec `moyen` pour encaisser et
// servir ; « sans_repas » (un badge sans réservation) rend `plats`, et se rappelle avec `menuJourId` et `moyen`.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Moyen = z.enum(MOYENS_COMPTOIR.map((m) => m.id) as [string, ...string[]]);
const Corps = z.object({
  cle: z.string().trim().min(1).max(300),
  /** Comment la caisse a encaissé : espèces, Mobile Money, ou le solde du convive. */
  moyen: Moyen.optional(),
  /** Le plat choisi par un convive sans réservation (son badge), avec `moyen`. */
  menuJourId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i).optional(),
});

export async function POST(requete: Request) {
  const qui = await autorise(...CANTINE);
  if (!qui) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ticket inconnu");
  if (!corps.ok) return corps.reponse;
  const { cle, menuJourId } = corps.donnees;
  const moyen = MOYENS_COMPTOIR.find((m) => m.id === corps.donnees.moyen)?.id;
  const r = menuJourId && moyen ? await servirAuBadge(cle, menuJourId, moyen, qui.id) : await servir(cle, qui.id, Date.now(), moyen);
  return reponse(requete, {
    genre: r.genre,
    phrase: r.phrase,
    // La file du repas et son paiement ; ce qu'il reste à encaisser et le solde du convive ; les plats à proposer.
    file: r.file ?? null,
    paiement: r.paiement ?? null,
    prix: r.prix ?? null,
    solde: r.solde ?? null,
    plats: r.genre === "sans_repas" && r.conviveId ? await platsAuComptoir(r.conviveId, Date.now()) : [],
    convive: r.convive ?? null,
    prenom: r.convive ? prenomDe(r.convive) : null,
    photo: r.photo ?? null,
    plat: r.plat ?? null,
    code: r.code ?? null,
    creneau: r.creneau ? creneauLisible(r.creneau) : null,
    // Les allergènes du convive identifié (pas ses régimes), en étiquettes ; vide s'il n'en a pas ou si personne n'est identifié.
    allergies: r.allergies ?? [],
    // Ce que CE plat contient et que ce convive ne mange pas : à vérifier avant de servir. Vide quand le plat lui convient.
    enCause: r.enCause ?? [],
    service: await serviceDuJour(aujourdhui()),
  });
}
