import type { Metadata } from "next";
import { EnTeteEspace } from "@/components/coque-espace";
import { STitreSection } from "@/components/sneat";
import { soldeDuCompte } from "@/lib/donnees";
import { enfantsDuParent, rechargesEnAttenteDe } from "@/lib/donnees-parent";
import { maintenant } from "@/lib/horloge";
import { exiger, prenomDe } from "@/lib/session";
import { RechargesEnAttente } from "./en-attente";
import { AucunCompte, FormulaireRecharge, type CompteARecharger } from "./formulaire";

export const metadata: Metadata = { title: "Recharger" };

// Recharger un compte : le convive le sien, le parent celui d'un de ses enfants (« ?pour=<id> » le choisit d'avance,
// s'il est bien le sien). On choisit le montant ici ; la page suivante montre le QR de paiement et attend la cantine.
export default async function PageRecharger({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const m = await exiger("convive", "parent");
  const { pour } = await searchParams;
  const parent = m.role === "parent";

  const [comptes, enAttente] = await Promise.all([
    parent
      ? enfantsDuParent(m.id).then((enfants) => enfants.map((e): CompteARecharger => ({ id: e.id, nom: e.nom, prenom: prenomDe(e.nom), classe: e.classe, solde: e.solde })))
      : soldeDuCompte(m.id).then((solde): CompteARecharger[] => [{ id: m.id, nom: m.nom, prenom: prenomDe(m.nom), classe: "", solde }]),
    rechargesEnAttenteDe(m.id),
  ]);
  // On ne présélectionne qu'un compte que cette personne peut recharger : un identifiant d'ailleurs est ignoré.
  const choisi = comptes.find((c) => c.id === pour)?.id ?? (comptes.length === 1 ? comptes[0].id : "");

  return (
    <>
      <EnTeteEspace titre="Recharger" retour={parent ? undefined : { href: "/compte", libelle: "Compte" }}
        sousTitre={comptes.length > 0 ? "Choisis le montant, la cantine confirme dès qu'elle voit ton paiement" : undefined} />

      {comptes.length === 0 ? <AucunCompte /> : (
        <section className="px-4">
          <FormulaireRecharge key={choisi} comptes={comptes} choisi={choisi} pourSoi={!parent} />
        </section>
      )}

      {enAttente.length > 0 && (
        <section className="mt-8 px-4">
          <STitreSection>Recharges en attente</STitreSection>
          <div className="mt-3"><RechargesEnAttente recharges={enAttente} moiId={m.id} maintenant={maintenant()} /></div>
        </section>
      )}
    </>
  );
}
