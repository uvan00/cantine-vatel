import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { EssayerComme } from "@/components/essayer-comme";
import { prisma } from "@/lib/db";
import { modeDemo } from "@/lib/demo";
import { fcfa } from "@/lib/format";
import { aujourdhui } from "@/lib/horloge";
import { HEURE_CLOTURE_LISIBLE, jourLong } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { qrSvg } from "@/lib/qr";
import { accueilDe, moi, origine } from "@/lib/session";

// L'accueil public : ce qu'on vient faire ici, en un écran, sur l'ardoise. Connecté, on file vers l'accueil de son rôle.
export const dynamic = "force-dynamic";

const TEMPS: [string, string][] = [
  ["Réserve ton plat", `Le menu de la semaine, avec les prix et les allergènes. Tu réserves jusqu'à ${HEURE_CLOTURE_LISIBLE} le jour même, et tu peux encore annuler jusque-là.`],
  ["Montre ton ticket", "Un QR sur ton téléphone. Un scan au comptoir, et tu es servi, sans chercher ta monnaie."],
  ["Recharge sans espèces", "Toi ou ton parent, avec ton application Mobile Money. La cantine confirme, ton solde monte."],
];

/** Le ticket du prochain plat au menu, tiré de la base : le QR ouvre l'application sur le téléphone de celui qui le scanne. */
async function TicketApercu() {
  const mj = await prisma.menuJour.findFirst({
    where: { jour: { gte: aujourdhui() }, epuise: false },
    orderBy: [{ jour: "asc" }, { prix: "desc" }],
    include: { plat: { select: { nom: true } } },
  });
  if (!mj) return null;
  const qr = await qrSvg(`${await origine()}/connexion`);
  return (
    <div className="ticket-ombre mx-auto w-full max-w-[300px] -rotate-2">
      <div className="ticket px-5 pt-6 text-[14px] leading-[1.45]">
        <p className="text-center text-[16px] font-medium">{MARQUE.cantine}</p>
        <p className="text-center text-encre/65">Ticket repas</p>
        <div className="ticket-filet my-4" />
        <div className="flex justify-between gap-3">
          <span className="min-w-0">{mj.plat.nom}</span>
          <span className="shrink-0">{fcfa(mj.prix)}</span>
        </div>
        <p className="mt-1 text-encre/65">Pour {jourLong(mj.jour)}</p>
        <div className="mt-3 flex justify-end">
          <span aria-hidden="true" className="-rotate-6 rounded-[10px] border-[3px] border-marque px-3 py-0.5 text-[22px] leading-7 font-semibold tracking-[0.08em] text-marque opacity-80 mix-blend-multiply">SERVI</span>
        </div>
        <div className="ticket-filet my-4" />
        <div className="mx-auto size-[132px] [&>svg]:size-full" role="img" aria-label="QR qui ouvre l'application" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-3 text-center text-[13px] text-encre/55">Scanne pour ouvrir la cantine sur ton téléphone</p>
      </div>
    </div>
  );
}

export default async function PageAccueil() {
  const m = await moi();
  if (m) redirect(accueilDe(m.role));

  return (
    <main className="min-h-dvh">
      <section className="ardoise" style={{ "--sn-on": "255 255 255", "--logo-marque": "#86D6A5" } as React.CSSProperties}>
        <div className="mx-auto max-w-lg px-5 pt-6 pb-12 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-12 lg:px-8 lg:pt-8 lg:pb-16">
          <div>
            <Logo className="text-[22px]" />
            <p className="mt-10 text-[15px] leading-5 text-white/65 lg:mt-16">{MARQUE.cantine}</p>
            <h1 className="mt-2 text-[34px] leading-10 font-semibold text-white lg:text-[44px] lg:leading-[52px]">{MARQUE.slogan}</h1>
            <p className="mt-4 max-w-md text-[16px] leading-6 text-white/75">
              Réserve ton repas avant {HEURE_CLOTURE_LISIBLE}, montre ton ticket au comptoir, et c&apos;est servi.
              La cuisine prépare juste ce qu&apos;il faut, toi tu gardes ta pause pour manger.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/connexion"
                className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[16px] font-semibold text-[#1c1c1c] transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Se connecter
              </Link>
              <Link href="/inscription"
                className="inline-flex h-12 items-center rounded-full px-5 text-[16px] font-medium text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)] transition-[background-color,transform] hover:bg-white/10 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Créer un compte
              </Link>
            </div>
            {modeDemo() && <EssayerComme surArdoise className="mt-8" />}
          </div>
          <div className="mt-12 lg:mt-0">
            <TicketApercu />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-lg px-5 py-10 lg:max-w-5xl lg:px-8 lg:py-14">
        <h2 className="text-[22px] leading-7">Comment ça marche</h2>
        <ol className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {TEMPS.map(([titre, texte], i) => (
            <li key={titre} className="flex gap-4 lg:block">
              <span className="chiffres grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-semibold"
                style={{ background: "rgb(var(--h-marque-teinte) / var(--h-teinte))", color: "rgb(var(--h-marque-texte))" }}>{i + 1}</span>
              <div className="lg:mt-4">
                <h3 className="text-[17px] leading-6">{titre}</h3>
                <p className="mt-1 text-[15px] leading-6 text-encre/75">{texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
