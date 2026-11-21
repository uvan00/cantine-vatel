// Montants en francs CFA et dates en français, sans tiret ni point médian (repris de Palabre).
// Espace insécable dans « F CFA » : un montant ne se coupe jamais entre F et CFA.
export const fcfa = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} F CFA`;
export const nombre = (v: number) => Math.round(v).toLocaleString("fr-FR");

export const heure = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

export const dateLongue = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

/** « à l'instant », « il y a 4 min », « il y a 1 h 05 », puis en jours : « il y a 1 jour », « il y a 3 jours » */
export const depuis = (iso: string | Date, maintenant: number) => {
  const min = Math.max(0, Math.floor((maintenant - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  const jours = Math.floor(min / (24 * 60));
  return `il y a ${jours} ${jours > 1 ? "jours" : "jour"}`;
};

/** Initiales : la première lettre de chacun des deux premiers mots (« Awa » → « A », « Jean Marc » → « JM »). */
export const initiales = (nom: string) =>
  nom.split(/\s+/).map((m) => m.match(/[\p{L}\p{N}]/u)?.[0] ?? "").filter(Boolean).slice(0, 2).map((c) => c.toUpperCase()).join("");

/** Liste en français : « Awa », « Awa et Kofi », « Awa, Kofi et Mariam » */
export const liste = (mots: string[]) =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

/** « 1 plat », « 3 plats » */
export const pluriel = (n: number, un: string, plusieurs = `${un}s`) => `${n.toLocaleString("fr-FR")} ${n > 1 ? plusieurs : un}`;

/** Numéro ivoirien à 10 chiffres : « 0707070707 » → « 07 07 07 07 07 ». */
export const telephoneLisible = (t: string) => t.replace(/\D/g, "").replace(/(\d{2})(?=\d)/g, "$1 ").trim();

/** « de Wave », « d'Orange Money » : l'élision devant une voyelle. */
export const de = (mot: string) => (/^[aeiouyàâéèêëîïôöûù]/i.test(mot) ? `d'${mot}` : `de ${mot}`);
