import Image from "next/image";
import { entrerCommeDemo } from "@/app/actions";
import { prisma } from "@/lib/db";
import { COMPTES_DEMO, rolesDemo } from "@/lib/demo";

// « Essayer sans compte » : les comptes de démonstration, pour le jury et pour la démo en direct. Ils prennent la place
// des ronds de connexion du modèle (des réseaux que la cantine n'a pas), chacun avec l'avatar dessiné de la personne,
// lu dans la base (posé par `npm run demo`), ses initiales sinon. Le compte de la cantine n'est proposé que sur un
// ordinateur de développement (`rolesDemo`), jamais sur un serveur en ligne.
// À n'afficher que si `modeDemo()` est vrai (l'action serveur le revérifie).

const initiales = (nom: string) => nom.split(" ").map((m) => m.charAt(0)).join("").slice(0, 2);

export async function EssayerComme({ className = "" }: { className?: string }) {
  const ORDRE = rolesDemo();
  const comptes = await prisma.user.findMany({ where: { email: { in: ORDRE.map((r) => COMPTES_DEMO[r].email) } }, select: { email: true, image: true } });
  const image = new Map(comptes.map((c) => [c.email, c.image]));
  return (
    <section className={className} aria-labelledby="titre-demo">
      {/* Au téléphone, le filet du modèle mobile (« ou … ») ; à l'ordinateur, un titre aligné à gauche comme le reste. */}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--h-filet)] lg:hidden" />
        <h2 id="titre-demo" className="text-[14px] leading-5 font-semibold text-encre/95">Essayer sans compte</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--h-filet)] lg:hidden" />
      </div>
      <p className="mt-1 text-[13px] leading-5 text-texte-2 max-lg:text-center">Des personnes et des repas inventés pour l&apos;essai</p>
      <ul className="mt-4 flex gap-4 max-lg:justify-center">
        {ORDRE.map((role) => {
          const c = COMPTES_DEMO[role];
          const src = image.get(c.email);
          return (
            <li key={role}>
              <form action={entrerCommeDemo.bind(null, role)}>
                <button type="submit" className="group flex w-[92px] flex-col items-center gap-2 text-center outline-none">
                  <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_rgb(0_0_0/0.08)] ring-4 ring-white transition-transform group-hover:-translate-y-0.5 group-active:scale-95 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[rgb(var(--h-marque-texte))]">
                    {src
                      ? <Image src={src} alt="" width={128} height={128} className="size-full object-cover" />
                      : <span className="text-[18px] font-semibold text-encre/80">{initiales(c.nom)}</span>}
                  </span>
                  {/* « Mariam, sa maman » : le prénom, puis qui elle est, sur deux lignes. */}
                  <span className="text-[13px] leading-4">
                    <span className="block font-medium text-encre/90">{c.libelle.split(", ")[0]}</span>
                    <span className="block text-texte-2">{c.libelle.split(", ").slice(1).join(", ")}</span>
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
