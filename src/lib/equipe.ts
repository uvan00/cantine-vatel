// L'équipe de la cantine : les règles d'un compte de responsable, créé par l'admin dans les Réglages (jamais par
// l'inscription publique). Pur et testé (equipe.test.ts) ; l'écriture est dans src/lib/operations.ts.

export const NOM_EQUIPE_MAX = 60;
export const MOT_DE_PASSE_MIN = 8;
export const MOT_DE_PASSE_MAX = 128;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pourquoi ce mot de passe ne va pas, en une phrase ; null : il va. */
export function refusMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < MOT_DE_PASSE_MIN) return `Un mot de passe d'au moins ${MOT_DE_PASSE_MIN} caractères`;
  if (motDePasse.length > MOT_DE_PASSE_MAX) return "Ce mot de passe est trop long";
  return null;
}

/** Pourquoi ce nouveau responsable ne se crée pas, en une phrase ; null : il se crée. */
export function refusResponsable(d: { nom: string; email: string; motDePasse: string }): string | null {
  const nom = d.nom.trim();
  if (nom.length < 2 || nom.length > NOM_EQUIPE_MAX) return `Son nom, en 2 à ${NOM_EQUIPE_MAX} caractères`;
  if (!EMAIL.test(d.email.trim())) return "Cet e-mail n'a pas l'air juste";
  return refusMotDePasse(d.motDePasse);
}
