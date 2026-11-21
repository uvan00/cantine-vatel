import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BoutonImprimer } from "@/app/feuille/[cle]/bouton-imprimer";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/brand";
import { EnTeteEspace } from "@/components/coque-espace";
import { estParentDe, identiteDe } from "@/lib/donnees";
import { Identifiant } from "@/lib/donnees-parent";
import { de } from "@/lib/format";
import { carteDe } from "@/lib/operations";
import { qrSvg } from "@/lib/qr";
import { exiger, origine, prenomDe } from "@/lib/session";
import { RefaireCarte } from "./refaire-carte";

// La carte de cantine (bonus du lot 2) : un QR qui ne change pas, sauf quand on refait la carte. Au comptoir ou à la
// borne, il sert le repas réservé du jour, par la même règle que le ticket ; elle s'imprime pour l'enfant qui n'a pas de
// téléphone. Le convive voit la sienne ; le parent, celle de son enfant (`?pour=<id>`).
export const metadata: Metadata = { title: "Carte de cantine" };

export default async function PageCarte({ searchParams }: { searchParams: Promise<{ pour?: string | string[] }> }) {
  const moi = await exiger("convive", "parent");
  let id = moi.id;
  if (moi.role === "parent") {
    const pour = Identifiant.safeParse((await searchParams).pour);
    if (!pour.success) redirect("/parent");
    if (!(await estParentDe(moi.id, pour.data))) notFound();
    id = pour.data;
  }
  const [personne, jeton] = await Promise.all([identiteDe(id), carteDe(id)]);
  if (!personne || !jeton) notFound();
  const prenom = prenomDe(personne.nom);
  const qr = await qrSvg(`${await origine()}/carte/${jeton}`);
  const pourParent = moi.role === "parent";

  return (
    <main>
      <EnTeteEspace titre="Carte de cantine"
        retour={pourParent ? { href: `/parent/enfant/${id}`, libelle: prenom } : { href: "/ticket", libelle: "Tes tickets" }}
        sousTitre={pourParent ? `Imprime-la si ${prenom} n'a pas de téléphone : au comptoir, elle vaut son ticket du jour` : "Un QR qui ne change pas : au comptoir, il vaut ton ticket du jour"} />
      <div className="px-4">
        <article className="mx-auto max-w-[360px] rounded-[24px] border border-[color:var(--h-filet)] bg-surface p-5 print:border-black">
          <Logo className="text-[16px]" />
          <div className="mt-5 flex items-center gap-3">
            <Avatar id={id} nom={personne.nom} photo={personne.photo} taille={48} />
            <div className="min-w-0">
              <p className="truncate text-[18px] leading-6 font-medium text-encre/95">{personne.nom}</p>
              {personne.classe && <p className="truncate text-[14px] leading-5 text-texte-2">{personne.classe}</p>}
            </div>
          </div>
          <div className="mx-auto mt-5 size-[220px] [&>svg]:size-full" role="img" aria-label={`Le QR de la carte de cantine ${de(prenom)}`} dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-4 text-center text-[13px] leading-5 text-texte-2">Au comptoir, ce QR sert le repas réservé du jour</p>
        </article>
        <div className="mt-6 flex justify-center"><BoutonImprimer /></div>
        <RefaireCarte pour={pourParent ? id : null} />
      </div>
    </main>
  );
}
