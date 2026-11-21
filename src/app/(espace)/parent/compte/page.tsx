import type { Metadata } from "next";
import { deconnexion } from "@/app/actions";
import { ChoixAvatar } from "@/components/choix-avatar";
import { EnTeteEspace } from "@/components/coque-espace";
import { exiger } from "@/lib/session";

export const metadata: Metadata = { title: "Compte" };

// Le compte du parent : qui il est, et la sortie.
export default async function PageCompteParent() {
  const m = await exiger("parent");
  const lignes: [string, string][] = [["Nom", m.nom], ["E-mail", m.email]];
  return (
    <>
      <EnTeteEspace titre="Compte" sousTitre="Ton compte de parent"
        action={<ChoixAvatar id={m.id} nom={m.nom} photo={m.photo} titre="Choisis ton avatar" sousTitre="Touche celui qui te ressemble le plus" />} />
      <div className="space-y-8 px-4">
        <dl className="divide-y divide-[color:var(--h-filet)] rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
          {lignes.map(([libelle, valeur]) => (
            <div key={libelle} className="flex h-14 items-center justify-between gap-4 px-4">
              <dt className="shrink-0 text-[14px] leading-5 text-texte-2">{libelle}</dt>
              <dd className="min-w-0 truncate text-[15px] leading-5 text-encre/95">{valeur}</dd>
            </div>
          ))}
        </dl>
        <form action={deconnexion}>
          <button type="submit" className="hb hb--filet w-full">Se déconnecter</button>
        </form>
      </div>
    </>
  );
}
