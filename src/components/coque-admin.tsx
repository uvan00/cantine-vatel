"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnexion } from "@/app/actions";
import { AssistantCantine } from "@/components/assistant-cantine";
import { Logo, Table as MarqueTable } from "@/components/brand";
import { LogOut, MessageCircle, MoreVertical } from "@/components/icons";
import { AUTRES_RUBRIQUES, RUBRIQUES } from "@/components/rubriques-admin";
import { SIconBtn } from "@/components/sneat";
import { MARQUE } from "@/lib/marque";

// La coque de l'administrateur, d'après le tableau de bord de Tablée (rail d'icônes, page dans un panneau à coins de
// 24), en clair. Sous 1024 px : barre du haut et onglets en bas (63 px).
// L'assistant (façon LinkAfr, demande du propriétaire du 21/11/2026) : dès 1280 px, posé en colonne à droite de la page,
// ouvert d'office sauf si la cantine l'a fermé (souvenu dans ce navigateur) ; en dessous, un tiroir qui s'ouvre depuis
// le rail ou la barre du haut, et se referme quand on change de page.

const CLE_ASSISTANT = "cantine.assistant";

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
  // null tant que le navigateur n'a pas dit sa largeur : rien ne change entre le serveur et le premier rendu.
  const [assistant, setAssistant] = useState<boolean | null>(null);
  const [grand, setGrand] = useState(false);
  const [large, setLarge] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(min-width: 1280px)");
    const lire = () => {
      setGrand(mq.matches);
      setAssistant(mq.matches && localStorage.getItem(CLE_ASSISTANT) !== "ferme");
    };
    lire();
    mq.addEventListener("change", lire);
    return () => mq.removeEventListener("change", lire);
  }, []);

  const basculerAssistant = useCallback((ouvrir?: boolean) => {
    setAssistant((a) => {
      const v = ouvrir ?? !a;
      if (matchMedia("(min-width: 1280px)").matches) localStorage.setItem(CLE_ASSISTANT, v ? "ouvert" : "ferme");
      return v;
    });
  }, []);

  // Hors grand écran, le tiroir se referme quand on change de page (ajusté pendant le rendu, sans effet).
  const [cheminVu, setCheminVu] = useState(chemin);
  if (chemin !== cheminVu) {
    setCheminVu(chemin);
    if (!grand && assistant) setAssistant(false);
  }

  return (
    <div className="flex h-dvh flex-col bg-cadre lg:flex-row lg:gap-2 lg:p-2 print:block print:h-auto print:bg-white">
      {/* Rail d'icônes (ordinateur) */}
      <nav aria-label="Rubriques" className="hidden w-[84px] shrink-0 flex-col items-center py-2 lg:flex print:hidden">
        <Link href="/admin" aria-label={`${MARQUE.cantine} : tableau de bord`} title="Tableau de bord"
          className="mb-6 grid size-12 place-items-center rounded-[14px] transition-colors hover:bg-[color:var(--h-survol)]">
          <MarqueTable className="size-9" />
        </Link>
        <ul className="flex flex-col gap-1">
          {[...RUBRIQUES, ...AUTRES_RUBRIQUES].map(({ href, libelle, Icon }) => {
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
        <div className="mt-auto flex flex-col items-center gap-2">
          <button type="button" onClick={() => basculerAssistant()} aria-pressed={!!assistant}
            className={`flex w-[76px] flex-col items-center gap-1 rounded-[16px] py-2.5 text-[12px] leading-4 font-medium transition-colors ${assistant ? "bg-surface text-encre/95 shadow-[inset_0_0_0_1px_var(--h-filet)]" : "text-encre/65 hover:bg-[color:var(--h-survol)] hover:text-encre/90"}`}>
            <MessageCircle className="size-6" strokeWidth={1.8} />
            Assistant
          </button>
          <Deconnexion />
        </div>
      </nav>

      {/* Barre du haut (téléphone, tablette en portrait) */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[color:var(--h-filet)] bg-[rgb(var(--sn-page))] px-4 lg:hidden print:hidden">
        <Link href="/admin" aria-label={`${MARQUE.cantine} : tableau de bord`}><Logo className="text-[20px]" /></Link>
        <span className="min-w-0 flex-1 truncate text-[13px] text-texte-2">{MARQUE.ecole}</span>
        <SIconBtn label="Ouvrir l'assistant" onClick={() => basculerAssistant(true)}><MessageCircle className="size-5" strokeWidth={1.8} /></SIconBtn>
        <Deconnexion />
      </header>

      {/* La page, dans son panneau */}
      <div className="min-h-0 min-w-0 flex-1 pb-[63px] lg:pb-0 print:pb-0">
        <main className="sn-entree h-full min-h-0 overflow-y-auto bg-[rgb(var(--sn-page))] lg:rounded-[24px] lg:border lg:border-[color:var(--h-filet)] print:overflow-visible print:border-0">
          <div className="@container/page px-4 py-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>

      {/* L'assistant : en colonne dès 1280 px (coins de 24 comme la page), en tiroir en dessous. */}
      {assistant && grand && (
        <aside className={`flex shrink-0 flex-col overflow-hidden rounded-[24px] border border-[color:var(--h-filet)] bg-[rgb(var(--sn-page))] print:hidden ${large ? "w-[560px]" : "w-[400px]"}`}>
          <AssistantCantine onClose={() => basculerAssistant(false)} large={large} onToggleLarge={() => setLarge((l) => !l)} />
        </aside>
      )}
      {assistant && !grand && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] print:hidden" onClick={() => basculerAssistant(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,100vw)] flex-col bg-[rgb(var(--sn-page))] shadow-[0_0_0_1px_var(--h-filet)] print:hidden">
            <AssistantCantine onClose={() => basculerAssistant(false)} onNavigate={() => basculerAssistant(false)} />
          </aside>
        </>
      )}

      {/* Onglets en bas (téléphone) */}
      {/* Six colonnes presque égales : chacune prend au moins la largeur de son mot, pour que « Commandes » tienne entier
          dès 360 px, et les autres se partagent le reste. */}
      <nav aria-label="Rubriques" className="fixed inset-x-0 bottom-0 z-30 grid h-[63px] grid-cols-[repeat(6,minmax(max-content,1fr))] border-t border-[color:var(--h-filet)] bg-[rgb(var(--sn-page))] lg:hidden print:hidden">
        {[...RUBRIQUES, { href: "/admin/plus", libelle: "Plus", Icon: MoreVertical }].map(({ href, libelle, Icon }) => {
          const actif = href === "/admin/plus" ? chemin.startsWith("/admin/plus") || AUTRES_RUBRIQUES.some((a) => chemin.startsWith(a.href)) : estActive(chemin, href);
          return (
            <Link key={href} href={href} aria-current={actif ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] leading-4 font-medium ${actif ? "text-encre/95" : "text-encre/65"}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${actif ? "bg-[color:var(--h-surface)]" : ""}`}>
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="max-w-full truncate">{libelle}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
