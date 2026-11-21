import type { Metadata } from "next";
import Link from "next/link";
import { EssayerComme } from "@/components/essayer-comme";
import { modeDemo } from "@/lib/demo";
import { Bascule } from "../bascule";
import { FormulaireConnexion } from "../formulaires";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <>
      <Bascule actif="connexion" />
      <h1 className="mb-8 text-[36px] leading-[44px] font-semibold text-encre max-lg:sr-only">Connexion</h1>
      <FormulaireConnexion />
      <p className="mt-6 hidden text-[15px] leading-6 text-texte-2 lg:block">
        Pas encore de compte ? <Link href="/inscription" className="font-medium text-encre underline-offset-4 hover:underline">Créer un compte</Link>
      </p>
      {modeDemo() && <EssayerComme className="mt-8 lg:mt-10" />}
    </>
  );
}
