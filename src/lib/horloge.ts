import { jourIso } from "./jours.ts";

// L'heure qu'il est, lue à un seul endroit. Une page serveur est calculée à chaque visite : elle demande l'instant ici
// plutôt que d'appeler Date.now() dans son rendu (la règle de pureté de React le refuse).

/** L'instant de la requête, en millisecondes. */
export const maintenant = () => Date.now();

/** Le jour de la requête (« 2026-11-21 »). */
export const aujourdhui = () => jourIso(Date.now());
