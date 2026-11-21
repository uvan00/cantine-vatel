import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { EnTetePage } from "@/components/fenetre";
import { ArrowLeft } from "@/components/icons";
import { VideIcone } from "@/components/kit-client";
import type { VueNonRetire } from "@/lib/donnees-admin";
import { fcfa } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { periode } from "@/lib/statistiques";

// Les repas réservés et jamais servis des sept derniers jours, convive par convive. Ils ne sont pas remboursés : c'est
// ce qui rend les chiffres de la cuisine fiables (cahier des charges, 4.3). La page se lit, elle n'écrit rien.

export function NonRetiresClient({ debut, fin, repas }: { debut: string; fin: string; repas: VueNonRetire[] }) {
  const jours = [...new Set(repas.map((r) => r.jour))];

  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Repas non retirés" sousTitre={<span className="block first-letter:uppercase">{periode(debut, fin)}</span>}
        actions={<Link href="/admin" className="hb hb--filet hb--petit"><ArrowLeft className="size-4" strokeWidth={1.8} />Tableau de bord</Link>} />

      <p className="max-w-[640px] text-[14px] leading-5 text-texte-2">
        Réservés, payés, jamais venus chercher : ils ne sont pas remboursés, c&apos;est ce qui rend les chiffres de la cuisine fiables
      </p>

      {repas.length === 0 ? (
        <div className="sn-card">
          <VideIcone icone="coche" title="Aucun repas non retiré" hint="Sur ces 7 jours, chaque repas réservé a été servi ou annulé à temps" />
        </div>
      ) : jours.map((jour) => (
        <section key={jour} className="sn-card p-5 @xl/page:p-6" aria-label={jourLong(jour)}>
          <h2 className="text-[16px] leading-6 first-letter:uppercase">{jourLong(jour)}</h2>
          <ul className="mt-3 divide-y divide-[color:var(--h-filet-doux)]">
            {repas.filter((r) => r.jour === jour).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <Avatar id={r.personneId} nom={r.nom} photo={r.photo} taille={32} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] leading-5 font-semibold text-encre/95">{r.nom}</p>
                  <p className="chiffres truncate text-[13px] leading-5 text-texte-2">{r.groupe}, {r.plat}, {fcfa(r.prix)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
