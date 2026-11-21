import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScannerClient } from "@/app/admin/scanner/scanner-client";
import { Logo } from "@/components/brand";
import { SBtn, SBtnLink } from "@/components/sneat";
import { borneLancee } from "@/lib/borne-serveur";
import { serviceDuJour } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { jourIso } from "@/lib/jours";
import { autorise } from "@/lib/session";
import { lancerBorne, quitterBorne } from "./actions";

export const metadata: Metadata = { title: "Borne d'entrée" };
export const dynamic = "force-dynamic";

// La borne d'entrée (l'élève pointe lui-même à l'entrée) : une tablette posée à l'entrée. L'élève présente le QR de son
// ticket ou tape son code ; l'écran l'accueille par son prénom. Elle ne tourne PAS sur la session de la cantine : la
// cantine la lance ici, sa session se ferme sur l'appareil, et il ne garde qu'un laissez-passer qui valide des tickets
// (src/lib/borne.ts). Elle a besoin du réseau : sans lui, l'élève passe au comptoir.
export default async function PageBorne() {
  if (await borneLancee()) {
    const service = await serviceDuJour(jourIso(maintenant()));
    return (
      <main className="min-h-dvh bg-[rgb(var(--sn-page))]">
        <div className="@container/page mx-auto max-w-[1100px] px-4 py-6 lg:px-8">
          <ScannerClient service={service} ticket={null} borne />
          <form action={quitterBorne} className="mt-10 text-center">
            <button type="submit" className="text-[13px] text-texte-2 underline-offset-4 hover:underline">Arrêter la borne</button>
          </form>
        </div>
      </main>
    );
  }
  // Pas encore lancée : seule la cantine peut la lancer sur cet appareil.
  if (!(await autorise("admin"))) redirect("/connexion");
  return (
    <main className="grid min-h-dvh place-items-center bg-[rgb(var(--sn-page))] px-4 py-10">
      <div className="w-full max-w-[440px] rounded-[24px] border border-[color:var(--h-filet)] bg-surface p-6">
        <Logo className="text-[18px]" />
        <h1 className="mt-6 text-[24px] leading-8 font-semibold text-encre/95">Borne d&apos;entrée</h1>
        <p className="mt-2 text-[15px] leading-6 text-texte-2">
          Cet appareil va devenir la borne de l&apos;entrée : les élèves y valident leur ticket eux-mêmes, et il ne peut rien faire d&apos;autre.
          Ta session de cantine se ferme ici. Pour retrouver ton espace sur cet appareil, arrête la borne et reconnecte-toi
        </p>
        <form action={lancerBorne} className="mt-6 flex flex-wrap items-center gap-3">
          <SBtn type="submit" tone="secondary">Lancer la borne</SBtn>
          <SBtnLink href="/admin" variant="text" tone="secondary">Pas maintenant</SBtnLink>
        </form>
      </div>
    </main>
  );
}
