import Image from "next/image";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { MARQUE } from "@/lib/marque";
import { accueilDe, moi } from "@/lib/session";
import { PanneauCantine } from "./panneau";

// Connexion et inscription, d'après les deux modèles donnés par le propriétaire le 21/11/2026. Au téléphone (modèle
// mobile) : le haut marine avec la cloche et la phrase de la cantine, puis la feuille blanche du formulaire. À
// l'ordinateur (second modèle) : le formulaire à gauche sur le gris clair, le panneau marine à droite. La cloche est le
// dessin de l'application mobile (public/connexion/dessin-cloche.webp, fond transparent), à la demande du propriétaire
// du même jour : le site, au téléphone comme à l'ordinateur, et l'application montrent la même.
// Déjà connecté, on file vers son accueil.
export const dynamic = "force-dynamic";

/** Sur le marine, l'encre du kit passe au blanc : le logo écrit « Cantine de Vatel » avec elle. */
const SUR_MARINE = { "--sn-on": "255 255 255" } as React.CSSProperties;

export default async function LayoutEntree({ children }: { children: React.ReactNode }) {
  const m = await moi();
  if (m) redirect(accueilDe(m.role));
  return (
    <main className="flex min-h-dvh flex-col bg-[#072A5D] lg:flex-row lg:bg-[#F4F4F5] lg:py-12 lg:pr-12 xl:py-14 xl:pr-16">
      {/* Téléphone, comme l'application : le logo, la cloche dessinée (haute de 42 % de la largeur, 190 au plus), la phrase. */}
      <header className="shrink-0 px-5 pt-5 pb-11 lg:hidden" style={SUR_MARINE}>
        <Logo className="text-[20px]" />
        <Image src="/connexion/dessin-cloche.webp" alt="" width={1080} height={752} priority sizes="(max-width: 452px) 61vw, 273px"
          className="mx-auto my-3 block h-[min(42vw,190px)] w-auto" />
        <p className="text-[28px] leading-9 font-semibold text-white">{MARQUE.slogan}</p>
        <p className="mt-1 text-[15px] leading-5 text-white/70">Ton e-mail, ton mot de passe, et à table</p>
      </header>

      {/* Le formulaire : la feuille blanche au téléphone, la colonne de gauche à l'ordinateur. */}
      <div className="relative z-10 -mt-7 flex flex-1 flex-col rounded-t-[28px] bg-white px-5 pt-6 pb-10 lg:mt-0 lg:items-center lg:justify-center lg:rounded-none lg:bg-transparent lg:px-12 lg:py-0">
        <div className="mx-auto w-full max-w-[440px]">
          <Logo className="mb-10 hidden text-[22px] lg:inline-flex" />
          {children}
        </div>
      </div>

      <PanneauCantine className="hidden lg:flex lg:w-[48%] lg:max-w-[880px] lg:shrink-0" />
    </main>
  );
}
