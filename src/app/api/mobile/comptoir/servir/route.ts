import { z } from "zod";
import { creneauLisible } from "@/lib/creneaux";
import { serviceDuJour } from "@/lib/donnees-admin";
import { aujourdhui } from "@/lib/horloge";
import { lireCorps, refus, reponse } from "@/lib/mobile";
import { servir } from "@/lib/operations";
import { autorise, prenomDe } from "@/lib/session";

// Servir un ticket au comptoir, comme `servirTicket` du site : le texte lu dans le QR (l'adresse du ticket) ou le code
// tapé part tel quel, et src/lib/operations.ts (servir) en tire le jeton ou le code avec lireCle. La réponse dit
// toujours pourquoi, en mots (src/lib/reservation.ts, scanner), avec les repas du jour après ce geste.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ cle: z.string().trim().min(1).max(300) });

export async function POST(requete: Request) {
  if (!(await autorise("admin"))) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ticket inconnu");
  if (!corps.ok) return corps.reponse;
  const r = await servir(corps.donnees.cle);
  return reponse(requete, {
    genre: r.genre,
    phrase: r.phrase,
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
