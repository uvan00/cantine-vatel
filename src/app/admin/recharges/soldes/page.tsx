import type { Metadata } from "next";
import { EnTetePage } from "@/components/fenetre";
import { SChiffresBande } from "@/components/sneat";
import { soldes } from "@/lib/comptabilite";
import { soldesDesConvives } from "@/lib/donnees-compta";
import { fcfa, nombre } from "@/lib/format";
import { exiger } from "@/lib/session";
import { Aide } from "../lignes";

export const metadata: Metadata = { title: "Soldes" };

export default async function PageSoldes() {
  await exiger("admin");
  const s = soldes(await soldesDesConvives());
  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Soldes" sousTitre="L'argent des élèves et du personnel en dépôt à la cantine : versé, pas encore mangé"
        actions={<a href="/api/admin/compta?vue=soldes" className="hb hb--filet hb--petit print:hidden">Exporter en CSV</a>} />
      <SChiffresBande items={[
        { titre: "En dépôt", valeur: fcfa(s.total) },
        { titre: "Comptes avec de l'argent", valeur: nombre(s.comptes.length) },
        { titre: "Comptes à zéro", valeur: nombre(s.sansArgent) },
      ]} />
      <Aide>Cet argent n&apos;est pas à la cantine : il revient aux élèves, repas après repas. C&apos;est ce que la cantine leur doit encore en repas.</Aide>
      <section className="sn-card overflow-hidden">
        {s.comptes.length === 0 ? <p className="p-5 text-[14px] leading-5 text-texte-2">Aucun compte n&apos;a d&apos;argent pour l&apos;instant</p> : (
          <ul className="divide-y divide-[color:var(--h-filet)]">
            {s.comptes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 truncate text-[15px] leading-5"><span className="font-medium text-encre/95">{c.nom}</span>{c.groupe && <span className="text-texte-2">, {c.groupe}</span>}</p>
                <p className="chiffres shrink-0 text-[15px] leading-5 font-semibold text-encre/95">{fcfa(c.solde)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
