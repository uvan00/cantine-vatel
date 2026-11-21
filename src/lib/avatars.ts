// Les avatars dessinés de la cantine (public/avatars, de 01 à 16) : des étudiants, dont deux en veste de cuisine, et
// des parents, sur les fonds clairs des teintes de pagne. Dessinés par Codex le 20/11/2026, planche validée par le
// propriétaire. Le 17 (la responsable de cantine en veste blanche, généré le 21/11/2026 dans le même style) est le
// visage du compte de démonstration de Fatou, posé par scripts/demo.mts : il n'est pas proposé au choix. Chacun choisit le sien dans son compte, le parent celui de son enfant ; sans choix, ses initiales.
// Règle pure, testée par `npm test` (avatars.test.ts).

export const AVATARS: readonly string[] = Array.from({ length: 16 }, (_, i) => `/avatars/${String(i + 1).padStart(2, "0")}.webp`);

/** Vrai pour l'adresse d'un des avatars dessinés : c'est la seule photo qu'on accepte d'écrire sur un compte. */
export const avatarPermis = (adresse: string) => AVATARS.includes(adresse);
