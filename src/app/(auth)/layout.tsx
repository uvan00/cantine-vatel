import Image from "next/image";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { MARQUE } from "@/lib/marque";
import { accueilDe, moi } from "@/lib/session";
import { PanneauCantine } from "./panneau";

// Connexion et inscription, d'après les deux modèles donnés par le propriétaire le 21/11/2026. Au téléphone (modèle
// mobile) : le haut marine avec la cloche et la phrase de la cantine, puis la feuille blanche du formulaire. À
// l'ordinateur (second modèle) : le formulaire à gauche sur le gris clair, le panneau marine à droite. La cloche est une
// image de Codex (public/connexion/), sur un marine uni que le fond reprend au pixel près : aucune couture.
// Déjà connecté, on file vers son accueil.
export const dynamic = "force-dynamic";

/** Sur le marine, l'encre du kit passe au blanc : le logo écrit « Cantine de Vatel » avec elle. */
const SUR_MARINE = { "--sn-on": "255 255 255" } as React.CSSProperties;

export default async function LayoutEntree({ children }: { children: React.ReactNode }) {
  const m = await moi();
  if (m) redirect(accueilDe(m.role));
  return (
    <main className="flex min-h-dvh flex-col bg-[#042557] lg:flex-row lg:bg-[#F4F4F5] lg:py-12 lg:pr-12 xl:py-14 xl:pr-16">
      {/* Téléphone : la cloche en haut, la phrase de la cantine juste sous l'assiette (qui finit à 48 % de la largeur). */}
      <header className="relative h-[calc(min(48vw,260px)+124px)] shrink-0 overflow-hidden lg:hidden" style={SUR_MARINE}>
        <Image src="/connexion/cloche.webp" alt="" width={1024} height={1024} priority sizes="(max-width: 540px) 100vw, 540px"
          className="absolute top-0 left-1/2 w-full max-w-[540px] -translate-x-1/2" />
        <div className="relative px-5 pt-5">
          <Logo className="text-[20px]" />
        </div>
        <div className="absolute inset-x-0 bottom-11 px-5">
          <p className="text-[28px] leading-9 font-semibold text-white">{MARQUE.slogan}</p>
          <p className="mt-1 text-[15px] leading-5 text-white/70">Ton e-mail, ton mot de passe, et à table</p>
        </div>
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
