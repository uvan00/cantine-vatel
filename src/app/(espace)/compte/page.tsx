import type { Metadata } from "next";
import Link from "next/link";
import { deconnexion } from "@/app/actions";
import { BandeauSoldeBas } from "@/components/bandeau-solde-bas";
import { EnTeteEspace } from "@/components/coque-espace";
import { STitreSection } from "@/components/sneat";
import { profilDe, soldeDuCompte } from "@/lib/donnees";
import { journalDe } from "@/lib/donnees-convive";
import { dateLongue, fcfa } from "@/lib/format";
import { heureH } from "@/lib/reservation";
import { exiger } from "@/lib/session";
import { SEUIL_ALERTE_DEFAUT, soldeBas } from "@/lib/solde";
import { CodeFamille, ProfilAlimentaire, SeuilAlerte } from "./reglages";

// Le compte du convive : son solde en grand, ce qu'il ne mange pas, son seuil d'alerte, le code à donner à son parent,
// et son journal. Le solde est la somme du journal (src/lib/solde.ts) : rien d'autre ne le calcule.
export const metadata: Metadata = { title: "Compte" };

/** L'historique montre les 30 derniers mouvements. */
const MOUVEMENTS = 30;

const CARTE = "rounded-[16px] border border-[color:var(--h-filet)] bg-surface";

export default async function PageCompte() {
  const moi = await exiger("convive");
  const [solde, profil, journal] = await Promise.all([soldeDuCompte(moi.id), profilDe(moi.id), journalDe(moi.id, MOUVEMENTS)]);
  const seuil = profil?.seuilAlerte ?? SEUIL_ALERTE_DEFAUT;
  const bas = soldeBas(solde, seuil);

  return (
    <main>
      <EnTeteEspace titre="Compte" sousTitre={<>{moi.nom}<span className="block break-all">{moi.email}</span></>} />

      <div className="space-y-8 px-4">
        <div className="space-y-4">
          <section aria-label="Ton solde" className={`${CARTE} p-4`}>
            <p className="text-[14px] leading-5 text-texte-2">Ton solde</p>
            <p className="chiffres mt-1 text-[36px] leading-[44px] font-medium text-encre/95">{fcfa(solde)}</p>
            {/* Solde bas : le bandeau dessous porte déjà le geste principal, celui-ci se fait discret. */}
            <Link href="/recharger" className={`hb mt-4 w-full ${bas ? "hb--filet" : "hb--encre"}`}>Recharger</Link>
          </section>
          <BandeauSoldeBas solde={solde} seuil={seuil} href="/recharger" />
        </div>

        {profil && (
          <>
            <section>
              <STitreSection>Profil alimentaire</STitreSection>
              <p className="mt-2 mb-4 text-[15px] leading-5 text-texte-2">Coche ce que tu ne manges pas : au menu, un plat qui ne te convient pas est signalé et ne se réserve pas</p>
              <ProfilAlimentaire allergenes={profil.allergenes} regimes={profil.regimes} />
            </section>

            <section>
              <STitreSection>Seuil d&apos;alerte</STitreSection>
              <div className="mt-4"><SeuilAlerte seuil={profil.seuilAlerte} /></div>
            </section>

            <section>
              <STitreSection>Code famille</STitreSection>
              <div className="mt-4"><CodeFamille code={profil.codeFamille} /></div>
            </section>
          </>
        )}

        <section>
          <STitreSection>Historique</STitreSection>
          {journal.length === 0 ? (
            <p className="mt-2 text-[15px] leading-5 text-texte-2">Aucun mouvement pour l&apos;instant : ta première recharge s&apos;affichera ici</p>
          ) : (
            <ul className={`${CARTE} mt-4 divide-y divide-[color:var(--h-filet)]`}>
              {journal.map((l) => (
                <li key={l.id} className="flex h-[76px] items-center justify-between gap-3 px-4">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[14px] leading-5 text-encre/95">{l.libelle}</p>
                    <p className="chiffres text-[13px] leading-4 text-texte-2">{dateLongue(l.quand)} à {heureH(l.quand)}</p>
                  </div>
                  <p className={`chiffres shrink-0 text-[15px] leading-5 font-medium ${l.montant > 0 ? "text-marque-texte" : "text-encre/95"}`}>
                    {l.montant > 0 ? "+" : ""}{fcfa(l.montant)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={deconnexion}>
          <button type="submit" className="hb hb--filet w-full">Se déconnecter</button>
        </form>
      </div>
    </main>
  );
}
