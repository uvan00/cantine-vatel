"use server";

import { donneesDuRapport } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { redigerSuggestion } from "@/lib/ia";
import { jourIso } from "@/lib/jours";
import { lundiDuRapport, rapportDeLaSemaine } from "@/lib/rapport";
import { autorise } from "@/lib/session";
import type { Suggestion } from "@/lib/suggestion";

/**
 * La suggestion de l'IA pour la semaine de ce rapport (bonus 5). Le navigateur n'envoie que le jour : le serveur relit
 * les chiffres dans la base, comme la page.
 */
export async function suggerer(semaine: string): Promise<{ ok: true; suggestions: Suggestion[] } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };
  const instant = maintenant();
  const lundi = lundiDuRapport(semaine, jourIso(instant));
  return redigerSuggestion(rapportDeLaSemaine(lundi, await donneesDuRapport(lundi), instant));
}
