import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page introuvable" };

export default function PageIntrouvable() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-[24px] leading-8">Cette page n&apos;existe pas</h1>
        <p className="mt-2 text-[16px] leading-6 text-encre/75">Le menu, lui, est bien là</p>
        <Link href="/" className="hb hb--encre mt-6">Revenir à l&apos;accueil</Link>
      </div>
    </main>
  );
}
