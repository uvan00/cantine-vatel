import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireInscription } from "../formulaires";

export const metadata: Metadata = { title: "Créer un compte" };

export default function PageInscription() {
  return (
    <>
      <h1 className="text-[24px] leading-8">Créer un compte</h1>
      <p className="mt-1 mb-6 text-[15px] leading-5 text-texte-2">Une minute, et tu réserves ton premier repas</p>
      <FormulaireInscription />
      <p className="mt-6 text-center text-[15px] leading-5 text-texte-2">
        Déjà un compte ? <Link href="/connexion" className="font-medium text-marque-texte underline-offset-4 hover:underline">Se connecter</Link>
      </p>
    </>
  );
}
