"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDownToLine, Calculator, Clock, Receipt, ShoppingBag, Wallet, type LucideIcon } from "@/components/icons";

// Le deuxième menu de la rubrique Recharges, façon LinkAfr (demande du propriétaire du 21/11/2026) : à l'ordinateur,
// une colonne à gauche de la page ; au téléphone, des onglets qui défilent. La période choisie (jour, semaine, mois)
// suit d'une page de comptes à l'autre.

const ENTREES: { href: string; libelle: string; Icon: LucideIcon; periode: boolean }[] = [
  { href: "/admin/recharges", libelle: "À confirmer", Icon: Clock, periode: false },
  { href: "/admin/recharges/encaissements", libelle: "Encaissements", Icon: ArrowDownToLine, periode: true },
  { href: "/admin/recharges/ventes", libelle: "Ventes", Icon: ShoppingBag, periode: true },
  { href: "/admin/recharges/depenses", libelle: "Dépenses", Icon: Receipt, periode: true },
  { href: "/admin/recharges/bilan", libelle: "Bilan", Icon: Calculator, periode: true },
  { href: "/admin/recharges/soldes", libelle: "Soldes", Icon: Wallet, periode: false },
];

export function MenuArgent() {
  const chemin = usePathname();
  const params = useSearchParams();
  // La période choisie suit d'une page de comptes à l'autre, qu'elle soit jour, semaine, mois ou dates.
  const garder = new URLSearchParams();
  for (const cle of ["p", "j", "du", "au"]) { const v = params.get(cle); if (v) garder.set(cle, v); }
  const periode = garder.size ? `?${garder.toString()}` : "";
  return (
    <nav aria-label="Argent de la cantine" className="print:hidden">
      <p className="mb-2 hidden px-3 text-[13px] leading-5 font-medium text-texte-2 @4xl/page:block">L&apos;argent de la cantine</p>
      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 @4xl/page:mx-0 @4xl/page:flex-col @4xl/page:gap-1 @4xl/page:overflow-visible @4xl/page:px-0 @4xl/page:pb-0"
        style={{ scrollbarWidth: "none" }}>
        {ENTREES.map(({ href, libelle, Icon, periode: avecPeriode }) => {
          const actif = href === "/admin/recharges" ? chemin === href : chemin.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link href={avecPeriode ? `${href}${periode}` : href} aria-current={actif ? "page" : undefined}
                className={`flex h-10 items-center gap-2.5 rounded-[12px] px-3 text-[14px] leading-5 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${
                  actif ? "bg-surface text-encre/95 shadow-[inset_0_0_0_1px_var(--h-filet)]" : "text-encre/70 hover:bg-[color:var(--h-survol)] hover:text-encre/95"}`}>
                <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
