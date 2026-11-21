// Les plats favoris et le badge « Nouveau » (l'étoile sur un plat, une alerte
// quand il revient au menu, « Nouveau » sur un plat récent). Règles pures, testées par `npm test`.

/** Un plat est « Nouveau » pendant les 14 jours qui suivent son arrivée à la carte. */
export const JOURS_NOUVEAU = 14;

export const estNouveau = (creeLe: Date | string, maintenant: number) =>
  maintenant - new Date(creeLe).getTime() < JOURS_NOUVEAU * 86_400_000;

/** Le premier jour à venir où un plat favori est au menu, avec son nom ; null s'il n'y en a pas. */
export function favoriAuMenu(jours: { jour: string; plats: { platId: string; nom: string }[] }[], favoris: Set<string>): { jour: string; nom: string } | null {
  for (const j of [...jours].sort((a, b) => a.jour.localeCompare(b.jour))) {
    const p = j.plats.find((x) => favoris.has(x.platId));
    if (p) return { jour: j.jour, nom: p.nom };
  }
  return null;
}
