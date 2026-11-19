import type { Metadata } from "next";
import Link from "next/link";
import { EssayerComme } from "@/components/essayer-comme";
import { modeDemo } from "@/lib/demo";
import { FormulaireConnexion } from "../formulaires";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <>
      <h1 className="text-[24px] leading-8">Connexion</h1>
      <p className="mt-1 mb-6 text-[15px] leading-5 text-texte-2">Ton e-mail, ton mot de passe, et à table</p>
      <FormulaireConnexion />
      <p className="mt-6 text-center text-[15px] leading-5 text-texte-2">
        Pas encore de compte ? <Link href="/inscription" className="font-medium text-marque-texte underline-offset-4 hover:underline">Créer un compte</Link>
      </p>
      {modeDemo() && <EssayerComme className="mt-6 border-t border-[color:var(--h-filet)] pt-6" />}
    </>
  );
}
