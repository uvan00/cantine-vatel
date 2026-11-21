"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, CircleUser, Mail, MenuRestaurant, Receipt, Users, Wallet } from "@/components/icons";

// La coque du convive et du parent, pensée pour le téléphone : une colonne de 560 px au plus et quatre onglets en bas
// (63 px, comme le tableau de bord), dont « Messages » avec la pastille des messages non lus. La colonne n'a pas de marge intérieure : chaque page pose `px-4` sur ses blocs,
// ce qui laisse un bandeau aller d'un bord à l'autre (l'ardoise du menu).

type Onglet = { href: string; libelle: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; racines: string[] };

const ONGLETS: Record<"convive" | "parent", Onglet[]> = {
  convive: [
    { href: "/menu", libelle: "Menu", Icon: MenuRestaurant, racines: ["/menu"] },
    { href: "/ticket", libelle: "Ticket", Icon: Receipt, racines: ["/ticket"] },
    { href: "/messages", libelle: "Messages", Icon: Mail, racines: ["/messages"] },
    { href: "/compte", libelle: "Compte", Icon: CircleUser, racines: ["/compte", "/recharger"] },
  ],
  parent: [
    { href: "/parent", libelle: "Enfants", Icon: Users, racines: ["/parent/enfant"] },
    { href: "/recharger", libelle: "Recharger", Icon: Wallet, racines: ["/recharger"] },
    { href: "/messages", libelle: "Messages", Icon: Mail, racines: ["/messages"] },
    { href: "/parent/compte", libelle: "Compte", Icon: CircleUser, racines: ["/parent/compte"] },
  ],
};

const actif = (chemin: string, o: Onglet) => chemin === o.href || o.racines.some((r) => chemin === r || chemin.startsWith(`${r}/`));

export function CoqueEspace({ role, nonLus = 0, children }: { role: "convive" | "parent" | "admin"; nonLus?: number; children: React.ReactNode }) {
  const chemin = usePathname();
  // Une recharge se paie comme dans un checkout, sans les onglets : le retour en haut de sa page suffit.
  const onglets = role === "admin" || /^\/recharger\/[^/]+$/.test(chemin) ? [] : ONGLETS[role];
  return (
    <div className="min-h-dvh bg-cote">
      <div className={`mx-auto min-h-dvh w-full max-w-[560px] bg-fond ${onglets.length > 0 ? "pb-[87px]" : "pb-6"} sm:border-x sm:border-[color:var(--h-filet)]`}>
        {children}
      </div>
      {onglets.length > 0 && (
        <nav aria-label="Rubriques" className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--h-filet)] bg-surface print:hidden">
          <div className="mx-auto grid h-[63px] w-full max-w-[560px] grid-cols-4">
            {onglets.map((o) => {
              const ici = actif(chemin, o);
              return (
                <Link key={o.href} href={o.href} aria-current={ici ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 text-[12px] leading-4 font-medium transition-colors ${ici ? "text-encre/95" : "text-encre/65"}`}>
                  <span className={`relative grid h-7 w-14 place-items-center rounded-full transition-colors ${ici ? "bg-[color:var(--h-surface)]" : ""}`}>
                    <o.Icon className="size-5" strokeWidth={1.8} />
                    {o.href === "/messages" && nonLus > 0 && (
                      <span className="chiffres absolute -top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-marque px-1 text-[11px] leading-none font-semibold text-white">
                        {nonLus > 9 ? "9+" : nonLus}
                      </span>
                    )}
                  </span>
                  {o.libelle}
                  {o.href === "/messages" && nonLus > 0 && <span className="sr-only">, {nonLus > 1 ? `${nonLus} non lus` : "1 non lu"}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * L'en-tête d'une page de l'espace : son titre, une phrase en option, un retour en option, un geste à droite en option.
 * Le menu a le sien (l'ardoise) ; toutes les autres pages prennent celui-ci.
 */
export function EnTeteEspace({ titre, sousTitre, retour, action }: { titre: string; sousTitre?: React.ReactNode; retour?: { href: string; libelle: string }; action?: React.ReactNode }) {
  return (
    <header className="px-4 pt-6 pb-4">
      {retour && (
        <Link href={retour.href} className="-ml-2 mb-2 inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[14px] font-medium text-encre/75 transition-colors hover:bg-[color:var(--h-survol)]">
          <ChevronLeft className="size-4" strokeWidth={1.8} />
          {retour.libelle}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-8">{titre}</h1>
          {sousTitre && <p className="mt-1 text-[15px] leading-5 text-texte-2">{sousTitre}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
