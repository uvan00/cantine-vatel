"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnexion } from "@/app/actions";
import { Logo, Table as MarqueTable } from "@/components/brand";
import { ChefHat, Home, LogOut, MenuRestaurant, QrCode, Wallet } from "@/components/icons";
import { SIconBtn } from "@/components/sneat";
import { MARQUE } from "@/lib/marque";

// La coque de l'administrateur, d'après le tableau de bord de Tablée (rail d'icônes, page dans un panneau à coins de
// 24), en clair. Sous 1024 px : barre du haut et onglets en bas (63 px).

const RUBRIQUES = [
  { href: "/admin", libelle: "Accueil", Icon: Home },
  { href: "/admin/menus", libelle: "Menus", Icon: MenuRestaurant },
  { href: "/admin/commandes", libelle: "Commandes", Icon: ChefHat },
  { href: "/admin/scanner", libelle: "Scanner", Icon: QrCode },
  { href: "/admin/recharges", libelle: "Recharges", Icon: Wallet },
];

const estActive = (chemin: string, href: string) => (href === "/admin" ? chemin === "/admin" : chemin.startsWith(href));

function Deconnexion() {
  return (
    <form action={deconnexion}>
      <SIconBtn label="Se déconnecter" type="submit"><LogOut className="size-5" strokeWidth={1.8} /></SIconBtn>
    </form>
  );
}

export function CoqueAdmin({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  return (
    <div className="flex h-dvh flex-col bg-cadre lg:flex-row lg:gap-2 lg:p-2 print:block print:h-auto print:bg-white">
      {/* Rail d'icônes (ordinateur) */}
      <nav aria-label="Rubriques" className="hidden w-[84px] shrink-0 flex-col items-center py-2 lg:flex print:hidden">
        <Link href="/admin" aria-label={`${MARQUE.nom} : tableau de bord`} title="Tableau de bord"
          className="mb-6 grid size-12 place-items-center rounded-[14px] transition-colors hover:bg-[color:var(--h-survol)]">
          <MarqueTable className="size-7 text-[var(--logo-marque)]" />
        </Link>
        <ul className="flex flex-col gap-1">
          {RUBRIQUES.map(({ href, libelle, Icon }) => {
            const actif = estActive(chemin, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={actif ? "page" : undefined}
                  className={`flex w-[76px] flex-col items-center gap-1 rounded-[16px] py-2.5 text-[12px] leading-4 font-medium transition-colors ${actif ? "bg-surface text-encre/95 shadow-[inset_0_0_0_1px_var(--h-filet)]" : "text-encre/65 hover:bg-[color:var(--h-survol)] hover:text-encre/90"}`}>
                  <Icon className="size-6" strokeWidth={1.8} />
                  {libelle}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto"><Deconnexion /></div>
      </nav>

      {/* Barre du haut (téléphone, tablette en portrait) */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[color:var(--h-filet)] bg-[rgb(var(--sn-page))] px-4 lg:hidden print:hidden">
        <Link href="/admin" aria-label={`${MARQUE.nom} : tableau de bord`}><Logo className="text-[20px]" /></Link>
        <span className="min-w-0 flex-1 truncate text-[13px] text-texte-2">{MARQUE.cantine}</span>
        <Deconnexion />
      </header>

      {/* La page, dans son panneau */}
      <div className="min-h-0 min-w-0 flex-1 pb-[63px] lg:pb-0 print:pb-0">
        <main className="sn-entree h-full min-h-0 overflow-y-auto bg-[rgb(var(--sn-page))] lg:rounded-[24px] lg:border lg:border-[color:var(--h-filet)] print:overflow-visible print:border-0">
          <div className="@container/page px-4 py-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>

      {/* Onglets en bas (téléphone) */}
      <nav aria-label="Rubriques" className="fixed inset-x-0 bottom-0 z-30 grid h-[63px] grid-cols-5 border-t border-[color:var(--h-filet)] bg-[rgb(var(--sn-page))] lg:hidden print:hidden">
        {RUBRIQUES.map(({ href, libelle, Icon }) => {
          const actif = estActive(chemin, href);
          return (
            <Link key={href} href={href} aria-current={actif ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] leading-4 font-medium ${actif ? "text-encre/95" : "text-encre/65"}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${actif ? "bg-[color:var(--h-surface)]" : ""}`}>
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="max-w-full truncate px-0.5">{libelle}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
