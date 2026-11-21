import type { Metadata } from "next";
import Link from "next/link";
import { AUTRES_RUBRIQUES } from "@/components/rubriques-admin";
import { EnTetePage } from "@/components/fenetre";
import { ChevronRight, FileText, Printer, QrCode, AlertTriangle } from "@/components/icons";
import { exiger } from "@/lib/session";

export const metadata: Metadata = { title: "Plus" };

// Au téléphone, la barre du bas n'a de place que pour cinq rubriques : les autres, et les écrans à part (la borne
// d'entrée, les repas non retirés, la feuille du jour, le rapport de la semaine), se trouvent ici.

const ECRANS = [
  { href: "/borne", libelle: "Borne d'entrée", phrase: "Les élèves scannent eux-mêmes leur ticket à l'entrée", Icon: QrCode },
  { href: "/admin/non-retires", libelle: "Repas non retirés", phrase: "Les sept derniers jours, convive par convive", Icon: AlertTriangle },
  { href: "/feuille/aujourdhui", libelle: "Feuille du jour", phrase: "Les réservés par plat, à imprimer en secours", Icon: Printer },
  { href: "/admin/rapport", libelle: "Rapport de la semaine", phrase: "Du lundi au dimanche, à imprimer et en CSV", Icon: FileText },
];

export default async function PagePlus() {
  await exiger("admin");
  const lignes = [...AUTRES_RUBRIQUES.map((r) => ({ ...r, phrase: "" })), ...ECRANS];
  return (
    <div className="space-y-6">
      <EnTetePage titre="Plus" />
      <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
        {lignes.map(({ href, libelle, phrase, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--h-filet-doux)]">
              <Icon className="size-5 shrink-0 text-encre/75" strokeWidth={1.8} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-5 font-medium text-encre/95">{libelle}</span>
                {phrase && <span className="block text-[13px] leading-5 text-texte-2">{phrase}</span>}
              </span>
              <ChevronRight className="size-5 shrink-0 text-encre/40" strokeWidth={1.8} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
