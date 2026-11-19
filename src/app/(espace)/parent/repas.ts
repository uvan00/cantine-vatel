// Un convive n'a qu'un repas par jour, mais il peut avoir réservé, annulé, puis réservé encore : son journal garde
// chaque réservation, son parent, lui, lit UN repas par jour. Pure, testée par `npm test`.

/**
 * Le repas à montrer pour chaque jour : celui qui tient (réservé, servi), sinon la réservation annulée la plus récente.
 * Attend les réservations de la plus récente à la plus ancienne, et les rend dans le même ordre. `cle` dit ce qui fait
 * « un jour » : le jour seul pour un convive, le convive et le jour quand on en lit plusieurs.
 */
export function unRepasParJour<T extends { etat: string }>(reservations: T[], cle: (r: T) => string): T[] {
  const retenus = new Map<string, T>();
  for (const r of reservations) {
    const garde = retenus.get(cle(r));
    if (!garde || (garde.etat === "annulee" && r.etat !== "annulee")) retenus.set(cle(r), r);
  }
  return [...retenus.values()];
}
