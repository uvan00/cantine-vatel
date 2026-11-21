import Image from "next/image";
import { prisma } from "@/lib/db";
import { lireReglages } from "@/lib/donnees";
import { aujourdhui, maintenant } from "@/lib/horloge";
import { clotureLisible, jourProche } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";

// Le panneau marine de la connexion, à l'ordinateur, d'après le modèle donné pour l'ordinateur : la cloche dessinée de
// l'application mobile (la même qu'au téléphone, à la demande du propriétaire du 21/11/2026), la phrase de la cantine,
// puis la carte à encoche avec le menu du prochain jour servi. Le marine est celui de Vatel, comme au téléphone.
// Tout vient de la base : le jour, les plats, leurs photos, l'heure de clôture. Rien n'est inventé.

const MARINE = "#072A5D";
/** Le carton de la carte à encoche : le marine éclairci de 12 % de blanc, plein (ses morceaux se recouvrent). */
const CARTON = "#254470";

/** « Garba, kedjenou et riz sauce arachide » : trois plats au plus, la suite se lit sur la pile de photos. */
function enMots(noms: string[]) {
  const n = noms.map((nom, i) => (i === 0 ? nom : nom.charAt(0).toLowerCase() + nom.slice(1)));
  if (n.length > 3) return `${n.slice(0, 3).join(", ")} et d'autres plats`;
  return n.length < 2 ? n.join("") : `${n.slice(0, -1).join(", ")} et ${n.at(-1)}`;
}

/** Le premier jour servi à partir d'aujourd'hui, et ses plats, les plus chers d'abord (comme la carte du menu). */
async function prochainMenu() {
  const premier = await prisma.menuJour.findFirst({ where: { jour: { gte: aujourdhui() } }, orderBy: { jour: "asc" }, select: { jour: true } });
  if (!premier) return null;
  const lignes = await prisma.menuJour.findMany({
    where: { jour: premier.jour },
    orderBy: [{ prix: "desc" }, { id: "asc" }],
    select: { plat: { select: { nom: true, photo: true } } },
  });
  return { jour: premier.jour, plats: lignes.map((l) => l.plat) };
}

export async function PanneauCantine({ className = "" }: { className?: string }) {
  const [menu, reglages] = await Promise.all([prochainMenu(), lireReglages()]);
  return (
    <aside aria-label={`${MARQUE.cantine} en bref`} className={`relative isolate flex-col overflow-hidden rounded-[40px] ${className}`}
      style={{ background: MARINE, "--sn-on": "255 255 255" } as React.CSSProperties}>
      <div className="flex flex-1 flex-col px-[10%] pt-[8%] pb-[8%]">
        <Image src="/connexion/dessin-cloche.webp" alt="Une cloche de service dessinée, qui sourit sous deux cœurs"
          width={1080} height={752} priority sizes="(min-width: 1960px) 360px, 19vw"
          className="mx-auto mb-[6%] block h-auto w-[48%] max-w-[360px]" />
        {/* mb-8 : même quand l'écran est bas, 32 au moins entre la phrase et la carte du menu. */}
        <div className="mb-8 pl-[5%]">
          <p className="text-[18px] leading-6 font-medium text-white/90">{MARQUE.ecole}</p>
          <h2 className="mt-4 text-[36px] leading-[44px] font-semibold text-white">{MARQUE.slogan}</h2>
          <p className="mt-3 max-w-[480px] text-[15px] leading-6 text-white/70">
            Réserve ton repas, montre ton ticket au comptoir, et c&apos;est servi. La cuisine prépare juste ce qu&apos;il faut,
            toi tu gardes ta pause pour manger.
          </p>
          <p className="mt-4 text-[16px] leading-6 text-white/90">Élève, employé ou parent : à toi de passer à table</p>
        </div>
        {menu && <CarteMenu jour={menu.jour} plats={menu.plats} cloture={clotureLisible(reglages.heureCloture)} />}
      </div>
    </aside>
  );
}

/**
 * La carte à encoche du modèle : son coin haut droit est découpé (88 sur 80), avec un arrondi bombé de chaque côté et
 * un arrondi creusé au fond. Le carton est fait de trois morceaux pleins : le gros à gauche, l'épaule à droite sous
 * l'encoche, et le coin creusé entre les deux.
 */
function CarteMenu({ jour, plats, cloture }: { jour: string; plats: { nom: string; photo: string }[]; cloture: string }) {
  const photos = plats.filter((p) => p.photo).slice(0, 3);
  const autres = plats.length - photos.length;
  return (
    <section aria-labelledby="titre-menu" className="relative isolate mt-auto">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 right-[88px] -z-10 rounded-[32px]" style={{ background: CARTON }} />
      <span aria-hidden="true" className="absolute top-[80px] right-0 bottom-0 left-[calc(100%-120px)] -z-10 rounded-r-[32px]" style={{ background: CARTON }} />
      <span aria-hidden="true" className="absolute top-[56px] right-[64px] -z-10 size-6"
        style={{ background: `radial-gradient(circle at 100% 0, transparent 23.5px, ${CARTON} 24px)` }} />

      <div className="px-10 pt-9 pb-9">
        <h3 id="titre-menu" className="pr-24 text-[24px] leading-8 font-semibold text-white">Au menu {jourProche(jour, maintenant())}</h3>
        <div className="mt-5 flex items-end justify-between gap-6">
          <p className="max-w-[340px] text-[16px] leading-6 text-white/80">
            {enMots(plats.map((p) => p.nom))}. Tu réserves jusqu&apos;à {cloture} le jour même.
          </p>
          {photos.length > 0 && (
            <ul aria-hidden="true" className="flex shrink-0 -space-x-3">
              {photos.map((p) => (
                <li key={p.nom}>
                  <Image src={p.photo} alt="" width={96} height={96} className="size-12 rounded-full object-cover ring-[3px] ring-white" />
                </li>
              ))}
              {autres > 0 && (
                <li className="chiffres grid size-12 place-items-center rounded-full text-[14px] font-semibold text-white ring-[3px] ring-white" style={{ background: MARINE }}>
                  +{autres}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
