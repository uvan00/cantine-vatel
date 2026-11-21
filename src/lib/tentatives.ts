// Les essais ratés, comptés en mémoire : passé un nombre d'essais dans une fenêtre de temps, la porte se ferme jusqu'à
// ce que la fenêtre soit passée. Sert devant la connexion (par e-mail et par adresse du visiteur) et devant « relier un
// enfant ». Le compte vit dans la mémoire du serveur : il repart de zéro quand le serveur redémarre, et ne se partage
// pas entre plusieurs serveurs. Règles pures (l'instant est donné), testées par `npm test`.

export type Limite = { essais: number; fenetreMs: number };

/** 8 mots de passe faux pour un même e-mail en 10 minutes. */
export const LIMITE_EMAIL: Limite = { essais: 8, fenetreMs: 10 * 60_000 };
/** 30 connexions ratées depuis une même adresse en 10 minutes. */
export const LIMITE_ADRESSE: Limite = { essais: 30, fenetreMs: 10 * 60_000 };
/** 5 codes famille faux pour un même parent en 10 minutes. */
export const LIMITE_CODE: Limite = { essais: 5, fenetreMs: 10 * 60_000 };

export const TROP_D_ESSAIS = "Trop d'essais : attends quelques minutes, puis réessaie";

export function creerCompteur() {
  const rates = new Map<string, number[]>();
  const recents = (cle: string, limite: Limite, maintenant: number) => (rates.get(cle) ?? []).filter((t) => maintenant - t < limite.fenetreMs);
  return {
    /** Vrai si cette clé a épuisé ses essais : on refuse sans regarder ce qu'elle propose. */
    bloque: (cle: string, limite: Limite, maintenant: number) => recents(cle, limite, maintenant).length >= limite.essais,
    /** Note un essai raté. */
    rate(cle: string, limite: Limite, maintenant: number) {
      rates.set(cle, [...recents(cle, limite, maintenant), maintenant]);
      // Le ménage, de loin en loin : les clés dont tous les essais sont vieux de plus d'une heure.
      if (rates.size > 5000) for (const [c, liste] of rates) if (liste.every((t) => maintenant - t > 3_600_000)) rates.delete(c);
    },
    /** Un essai réussi efface l'ardoise de cette clé. */
    reussi: (cle: string) => { rates.delete(cle); },
  };
}

/** Le compteur du serveur. */
export const tentatives = creerCompteur();

/** Les deux clés d'une connexion : l'e-mail visé, et l'adresse d'où vient la demande. */
export function clesConnexion(email: string, enTetes: { get(nom: string): string | null }): [string, Limite][] {
  const adresse = (enTetes.get("x-forwarded-for") ?? "").split(",")[0].trim() || "locale";
  return [[`email:${email.trim().toLowerCase()}`, LIMITE_EMAIL], [`adresse:${adresse}`, LIMITE_ADRESSE]];
}

export const connexionBloquee = (cles: [string, Limite][], maintenant: number, compteur = tentatives) => cles.some(([cle, limite]) => compteur.bloque(cle, limite, maintenant));

/** Après la réponse : une connexion réussie efface les essais de cet e-mail, une ratée compte pour l'e-mail et pour l'adresse. */
export function noterConnexion(cles: [string, Limite][], reussie: boolean, maintenant: number, compteur = tentatives) {
  if (reussie) compteur.reussi(cles[0][0]);
  else for (const [cle, limite] of cles) compteur.rate(cle, limite, maintenant);
}
