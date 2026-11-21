import type { Metadata } from "next";
import Link from "next/link";
import { Bascule } from "../bascule";
import { FormulaireInscription } from "../formulaires";

export const metadata: Metadata = { title: "Créer un compte" };

export default function PageInscription() {
  return (
    <>
      <Bascule actif="inscription" />
      <h1 className="text-[36px] leading-[44px] font-semibold text-encre max-lg:sr-only">Créer un compte</h1>
      <p className="mt-1 mb-8 hidden text-[15px] leading-6 text-texte-2 lg:block">Une minute, et tu réserves ton premier repas</p>
      <FormulaireInscription />
      <p className="mt-6 hidden text-[15px] leading-6 text-texte-2 lg:block">
        Déjà un compte ? <Link href="/connexion" className="font-medium text-encre underline-offset-4 hover:underline">Se connecter</Link>
      </p>
    </>
  );
}
