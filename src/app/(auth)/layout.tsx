import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { MARQUE } from "@/lib/marque";
import { accueilDe, moi } from "@/lib/session";

// Connexion et inscription : une colonne étroite, le logo en haut. Déjà connecté, on file vers son accueil.
export const dynamic = "force-dynamic";

export default async function LayoutEntree({ children }: { children: React.ReactNode }) {
  const m = await moi();
  if (m) redirect(accueilDe(m.role));
  return (
    <main className="min-h-dvh bg-cote">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 py-8">
        <Link href="/" aria-label={`${MARQUE.nom} : accueil`} className="self-start"><Logo className="text-[22px]" /></Link>
        <div className="mt-10 rounded-[24px] bg-surface p-6 shadow-[0_0_0_1px_var(--h-filet)]">{children}</div>
      </div>
    </main>
  );
}
