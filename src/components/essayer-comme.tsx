import { entrerCommeDemo } from "@/app/actions";
import { COMPTES_DEMO, type RoleDemo } from "@/lib/demo";

// « Essayer comme… » : trois entrées directes dans les comptes de démonstration, pour le jury et pour la démo en direct.
// À n'afficher que si `modeDemo()` est vrai (l'action serveur le revérifie).

const ORDRE: RoleDemo[] = ["convive", "parent", "admin"];

export function EssayerComme({ className = "", surArdoise = false }: { className?: string; surArdoise?: boolean }) {
  return (
    <section className={className} aria-label="Comptes de démonstration">
      <p className={`text-[14px] leading-5 font-semibold ${surArdoise ? "text-white/90" : "text-encre/95"}`}>Démonstration</p>
      <p className={`mt-1 text-[13px] leading-5 ${surArdoise ? "text-white/65" : "text-texte-2"}`}>Entre sans compte, avec des personnes et des repas inventés pour l&apos;essai</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ORDRE.map((role) => (
          <form key={role} action={entrerCommeDemo.bind(null, role)}>
            <button type="submit"
              className={`inline-flex h-10 items-center rounded-full px-4 text-[14px] font-medium transition-[background-color,transform] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 ${surArdoise ? "bg-white/10 text-white hover:bg-white/15 focus-visible:outline-white" : "bg-[color:var(--h-surface)] text-encre/90 hover:bg-[color:var(--h-survol)] focus-visible:outline-[rgb(var(--h-marque-texte))]"}`}>
              {COMPTES_DEMO[role].libelle}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
