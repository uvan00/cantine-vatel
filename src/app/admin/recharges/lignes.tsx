import { fcfa } from "@/lib/format";

// Une liste de montants avec leur barre (la plus grande ligne fait toute la largeur) : jour par jour, plat par plat,
// catégorie par catégorie. La barre aide l'œil ; le montant écrit fait foi.
export function ListeMontants({ titre, lignes, vide }: {
  titre: string;
  lignes: { cle: string; libelle: string; detail?: string; montant: number }[];
  vide: string;
}) {
  const plusHaut = Math.max(0, ...lignes.map((l) => l.montant));
  return (
    <section className="sn-card p-5 lg:p-6">
      <h2 className="text-[18px] leading-6">{titre}</h2>
      {lignes.length === 0 ? <p className="mt-3 text-[14px] leading-5 text-texte-2">{vide}</p> : (
        <ul className="mt-4 space-y-3">
          {lignes.map((l) => (
            <li key={l.cle}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[15px] leading-5 text-encre/95">
                  <span className="font-medium first-letter:uppercase">{l.libelle}</span>
                  {l.detail && <span className="text-texte-2">, {l.detail}</span>}
                </p>
                <p className="chiffres shrink-0 text-[15px] leading-5 font-semibold text-encre/95">{fcfa(l.montant)}</p>
              </div>
              <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--h-surface)]">
                <div className="h-full rounded-full bg-marque" style={{ width: `${plusHaut ? Math.round((l.montant / plusHaut) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Une phrase d'aide sous les chiffres, pour que chaque page dise ce qu'elle compte. */
export const Aide = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] leading-5 text-texte-2">{children}</p>;
