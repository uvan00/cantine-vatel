import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EtiquettesAliments } from "@/components/allergene";
import { commandesDuJour } from "@/lib/donnees-admin";
import { nombre, pluriel } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourLong } from "@/lib/jours";
import { MARQUE } from "@/lib/marque";
import { heureH } from "@/lib/reservation";
import { exiger } from "@/lib/session";
import { BoutonImprimer } from "./bouton-imprimer";

// La feuille du jour, à imprimer : par plat, les convives qui ont réservé, avec une case à cocher. C'est le secours du
// comptoir si le réseau ou un téléphone lâche. Hors de la coque de la cantine pour sortir propre sur papier ; réservée
// à la cantine comme le reste (`exiger("admin")`).

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feuille du jour" };

const Cle = z.enum(["aujourdhui", "demain"]);
const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, "fr");

export default async function PageFeuille({ params }: { params: Promise<{ cle: string }> }) {
  await exiger("admin");
  const cle = Cle.safeParse((await params).cle);
  if (!cle.success) notFound();
  const instant = maintenant();
  const d = await commandesDuJour(cle.data, instant);
  const plats = [...d.plats].sort(parNom);
  // Les convives allergiques du jour, tous plats confondus : la cuisine les a sous les yeux avant de servir.
  const allergiques = plats.flatMap((p) => p.convives.filter((c) => c.allergies.length > 0).map((c) => ({ ...c, plat: p.nom }))).sort(parNom);
  // Ceux dont le plat réservé contient ce qu'ils ne mangent pas : réserver l'aurait refusé, mais un profil réglé après la
  // réservation, ou un plat modifié, laisse le cas. La cuisine le lit en premier.
  // Ceux qui sont déjà servis n'y sont plus : il n'y a plus rien à vérifier pour eux.
  const aVerifier = plats.flatMap((p) => p.convives.filter((c) => c.enCause.length > 0 && c.etat !== "servie").map((c) => ({ ...c, plat: p.nom }))).sort(parNom);

  return (
    <main className="mx-auto max-w-[780px] bg-white px-6 py-8 text-encre print:max-w-none print:px-0 print:py-0">
      <header className="flex items-start justify-between gap-6 border-b border-[color:var(--h-filet)] pb-4">
        <div className="min-w-0">
          <p className="text-[13px] leading-5 text-texte-2">{MARQUE.nom}, feuille du jour</p>
          <h1 className="mt-1 text-[24px] leading-8 font-semibold first-letter:uppercase">{jourLong(d.jour)}</h1>
          <p className="chiffres mt-1 text-[14px] leading-5 text-texte-2">
            {pluriel(d.service.reserves, "repas réservé", "repas réservés")}, imprimée à {heureH(new Date(instant))}
            {d.cloturee ? "" : `, avant la clôture de ${d.clotureLisible} : d'autres repas peuvent encore arriver`}
          </p>
        </div>
        <BoutonImprimer />
      </header>

      {aVerifier.length > 0 && (
        <section aria-labelledby="a-verifier" className="mt-7 break-inside-avoid-page rounded-[12px] border-2 border-encre/70 px-4 py-3">
          <h2 id="a-verifier" className="flex items-baseline justify-between gap-4 text-[17px] leading-6 font-semibold">
            <span>À vérifier avant de servir</span>
            <span className="chiffres text-[14px] font-normal text-texte-2">{pluriel(aVerifier.length, "convive")}</span>
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-texte-2">Leur plat réservé ne convient pas à ce qu&apos;ils ont déclaré. Vois avec eux, ou propose un autre plat</p>
          <table className="mt-2 w-full table-fixed border-collapse text-[14px] leading-5">
            <colgroup><col className="w-[28%]" /><col className="w-[28%]" /><col /></colgroup>
            <thead>
              <tr className="text-left text-[12px] leading-4 text-texte-2">
                <th className="py-1.5 font-normal">Convive</th>
                <th className="py-1.5 font-normal">Plat réservé</th>
                <th className="py-1.5 font-normal">En cause</th>
              </tr>
            </thead>
            <tbody>
              {aVerifier.map((c) => (
                <tr key={c.id} className="border-t border-[color:var(--h-filet-doux)] align-top">
                  <td className="py-2 pr-2 font-medium">{c.nom}</td>
                  <td className="py-2 pr-2 text-texte-2">{c.plat}</td>
                  <td className="py-2"><EtiquettesAliments etiquettes={c.enCause} taille={20} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {allergiques.length > 0 && (
        <section aria-labelledby="allergiques" className="mt-7 break-inside-avoid-page rounded-[12px] border border-[color:var(--h-filet)] px-4 py-3">
          <h2 id="allergiques" className="flex items-baseline justify-between gap-4 text-[17px] leading-6 font-semibold">
            <span>Convives allergiques</span>
            <span className="chiffres text-[14px] font-normal text-texte-2">{pluriel(allergiques.length, "convive")}</span>
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-texte-2">Ce qu&apos;ils ont déclaré dans leur profil. Un doute sur un plat : demande en cuisine avant de servir</p>
          <table className="mt-2 w-full table-fixed border-collapse text-[14px] leading-5">
            <colgroup><col className="w-[28%]" /><col className="w-[28%]" /><col /></colgroup>
            <thead>
              <tr className="text-left text-[12px] leading-4 text-texte-2">
                <th className="py-1.5 font-normal">Convive</th>
                <th className="py-1.5 font-normal">Plat réservé</th>
                <th className="py-1.5 font-normal">Allergique</th>
              </tr>
            </thead>
            <tbody>
              {allergiques.map((c) => (
                <tr key={c.id} className="border-t border-[color:var(--h-filet-doux)] align-top">
                  <td className="py-2 pr-2 font-medium">{c.nom}</td>
                  <td className="py-2 pr-2 text-texte-2">{c.plat}</td>
                  <td className="py-2"><EtiquettesAliments etiquettes={c.allergies} taille={20} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {/* Personne d'allergique : la feuille le dit, pour que la cuisine n'ait pas à le déduire d'un bloc absent. */}
      {allergiques.length === 0 && d.service.reserves > 0 && (
        <p className="mt-7 rounded-[12px] border border-[color:var(--h-filet)] px-4 py-3 text-[14px] leading-5 text-texte-2">Aucune allergie déclarée parmi les convives de ce jour</p>
      )}

      {plats.length === 0 ? (
        <p className="mt-8 text-[15px] leading-6 text-texte-2">Rien au menu ce jour-là</p>
      ) : plats.map((p) => (
        <section key={p.id} className="mt-7 break-inside-avoid-page">
          <h2 className="flex items-baseline justify-between gap-4 text-[17px] leading-6 font-semibold">
            <span>{p.nom}</span>
            <span className="chiffres text-[14px] font-normal text-texte-2">{pluriel(p.reserves, "repas", "repas")}</span>
          </h2>
          {p.convives.length === 0 ? (
            <p className="mt-2 text-[14px] leading-5 text-texte-2">Personne ne l&apos;a réservé</p>
          ) : (
            <table className="mt-2 w-full table-fixed border-collapse text-[14px] leading-5">
              <colgroup><col className="w-14" /><col /><col className="w-[34%]" /><col className="w-24" /></colgroup>
              <thead>
                <tr className="text-left text-[12px] leading-4 text-texte-2">
                  <th className="py-1.5 font-normal">Servi</th>
                  <th className="py-1.5 font-normal">Convive</th>
                  <th className="py-1.5 font-normal">Classe ou service</th>
                  <th className="py-1.5 text-right font-normal">Code</th>
                </tr>
              </thead>
              <tbody>
                {[...p.convives].sort(parNom).map((c) => (
                  <tr key={c.id} className="border-t border-[color:var(--h-filet-doux)]">
                    <td className="py-2">
                      {c.etat === "servie" ? (
                        <span className="chiffres text-[12px] text-texte-2">{c.serviLe ? heureH(c.serviLe) : "oui"}</span>
                      ) : (
                        <span aria-label="À cocher" className="inline-block size-4 rounded-[3px] border border-encre/50 align-middle" />
                      )}
                    </td>
                    <td className="truncate py-2 font-medium">{c.nom}</td>
                    <td className="truncate py-2 text-texte-2">{c.groupe}</td>
                    <td className="py-2 text-right font-mono">{c.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {plats.length > 0 && (
        <p className="chiffres mt-8 border-t border-[color:var(--h-filet)] pt-3 text-[12px] leading-4 text-texte-2">
          {nombre(d.service.reserves)} réservés, {nombre(d.service.servis)} déjà servis à l&apos;impression. Les repas cochés à la main se reportent ensuite dans Commandes
        </p>
      )}
    </main>
  );
}
