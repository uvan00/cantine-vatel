// « Ta semaine avec ton solde » (cahier des charges, section 11, bonus 1) : un plat proposé pour chaque jour à venir où
// le convive n'a pas encore réservé, selon son solde, son profil alimentaire et les notes des plats. Rien ne se réserve
// tout seul : c'est une proposition. Pure, testée par `npm test` (semaine.test.ts).
import { incompatibilites, type ProfilAlimentaire } from "./profil-alimentaire.ts";
import { estComplet } from "./reservation.ts";
import { resteApres, totalRepas } from "./solde.ts";

export type PlatPropose = {
  /** Le plat au menu de ce jour (MenuJour). */
  id: string;
  nom: string;
  prix: number;
  allergenes: string[];
  porc: boolean;
  vegetarien: boolean;
  portions: number | null;
  epuise: boolean;
  reservees: number;
  /** La moyenne des notes ; null tant que personne ne l'a noté. */
  note: number | null;
};

export type JourPropose = { jour: string; plats: PlatPropose[] };

/** Pour chaque jour : le plat proposé, ou pourquoi il n'y en a pas (« solde » : pas assez ; « rien » : rien qui convienne). */
export type Proposition = { jour: string; plat: { id: string; nom: string; prix: number; note: number | null } | null; raison: "solde" | "rien" | null };

/**
 * Deux temps. D'abord couvrir le plus de jours possible, dans l'ordre du calendrier, avec le plat le moins cher qui
 * convient. Puis, avec ce qui reste, passer chaque jour au plat le mieux noté qu'on peut encore payer. Ainsi un plat cher
 * ne laisse pas les jours suivants sans repas.
 */
export function proposerSemaine(jours: JourPropose[], solde: number, profil: ProfilAlimentaire): { propositions: Proposition[]; total: number; reste: number } {
  const ordonnes = [...jours].sort((a, b) => a.jour.localeCompare(b.jour));
  const possibles = ordonnes.map((j) => j.plats.filter((p) => !estComplet(p) && incompatibilites(profil, p).length === 0).sort((a, b) => a.prix - b.prix));

  let reste = Math.max(0, solde);
  const choix: (PlatPropose | null)[] = possibles.map((liste) => {
    const moinsCher = liste[0];
    if (!moinsCher || moinsCher.prix > reste) return null;
    reste -= moinsCher.prix;
    return moinsCher;
  });

  // Le mieux noté d'abord ; sans note, après tous les plats notés.
  const meilleur = (a: PlatPropose, b: PlatPropose) => (b.note ?? -1) - (a.note ?? -1) || a.prix - b.prix;
  choix.forEach((actuel, i) => {
    if (!actuel) return;
    const mieux = [...possibles[i]].sort(meilleur).find((p) => (p.note ?? -1) > (actuel.note ?? -1) && p.prix - actuel.prix <= reste);
    if (mieux) {
      reste -= mieux.prix - actuel.prix;
      choix[i] = mieux;
    }
  });

  const propositions = ordonnes.map((j, i): Proposition => {
    const p = choix[i];
    if (p) return { jour: j.jour, plat: { id: p.id, nom: p.nom, prix: p.prix, note: p.note }, raison: null };
    return { jour: j.jour, plat: null, raison: possibles[i].length === 0 ? "rien" : "solde" };
  });
  // Les deux montants montrés se calculent là où se calcule tout l'argent (src/lib/solde.ts).
  const total = totalRepas(choix.flatMap((p) => (p ? [p.prix] : [])));
  return { propositions, total, reste: resteApres(Math.max(0, solde), total) };
}
