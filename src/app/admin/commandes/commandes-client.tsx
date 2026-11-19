"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EtatRepas } from "@/components/etat-repas";
import { EnTetePage } from "@/components/fenetre";
import { ChefHat, Clock } from "@/components/icons";
import { SAlert, SBtn, SChiffresBande, SChip, SEmpty, STabs } from "@/components/sneat";
import { useDirect } from "@/hooks/use-direct";
import type { CleJour, VueCommandes, VueConvive, VuePlatCommande } from "@/lib/donnees-admin";
import { nombre, pluriel } from "@/lib/format";
import { HEURE_CLOTURE_LISIBLE, jourLong } from "@/lib/jours";
import { heureH } from "@/lib/reservation";
import { servirTicket, type ReponseService } from "../actions";

// Ce que la cuisine prépare, aujourd'hui ou demain : une colonne par plat, son nombre de repas en grand, ses convives.
// L'écran se relit toutes les 3 secondes. Aujourd'hui, « Servir » sert un convive sans scanner son ticket.

const ONGLETS: { id: CleJour; label: string }[] = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "demain", label: "Demain" },
];

/** L'état de la clôture, en une phrase. */
function phraseCloture(d: VueCommandes) {
  if (d.cle === "demain") return `Réservations ouvertes jusqu'à demain ${HEURE_CLOTURE_LISIBLE} : ces nombres peuvent encore monter`;
  return d.cloturee ? `Réservations closes depuis ${HEURE_CLOTURE_LISIBLE} : ces nombres ne bougent plus` : `Réservations ouvertes jusqu'à ${HEURE_CLOTURE_LISIBLE}`;
}

export function CommandesClient({ initial }: { initial: VueCommandes }) {
  const [donnees, recharger] = useDirect<VueCommandes>(`/api/admin/commandes?jour=${initial.cle}`, initial, 3000);
  const router = useRouter();
  const [choisi, setChoisi] = useState<CleJour>(initial.cle);
  const [enRoute, demarrer] = useTransition();
  const [refus, setRefus] = useState<{ convive: string; phrase: string } | null>(null);
  const [annonce, setAnnonce] = useState("");
  const aujourdhui = donnees.cle === "aujourdhui";

  const changer = (cle: CleJour) => {
    setChoisi(cle);
    demarrer(() => router.replace(cle === "demain" ? "/admin/commandes?jour=demain" : "/admin/commandes", { scroll: false }));
  };

  /** Ce que le serveur a répondu à « Servir » : dit à voix haute, et montré seulement si le repas n'a pas été servi. */
  const apresService = async (convive: VueConvive, reponse: ReponseService) => {
    setRefus(reponse.genre === "servi" ? null : { convive: convive.nom, phrase: reponse.phrase });
    setAnnonce(`${convive.nom} : ${reponse.phrase}`);
    await recharger();
  };

  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Commandes" sousTitre={<span className="block first-letter:uppercase">{jourLong(donnees.jour)}</span>}
        actions={<STabs value={choisi} onChange={changer} tabs={ONGLETS} />} />

      <div className={`space-y-6 transition-opacity ${enRoute ? "opacity-50" : ""}`} aria-busy={enRoute}>
        <div className="space-y-3">
          <SChiffresBande items={aujourdhui ? [
            { titre: "Réservés", valeur: nombre(donnees.service.reserves) },
            { titre: "Servis", valeur: nombre(donnees.service.servis) },
            { titre: "À servir", valeur: <span className="text-marque-texte">{nombre(donnees.service.aServir)}</span> },
          ] : [
            { titre: "Réservés pour demain", valeur: nombre(donnees.service.reserves) },
            { titre: "Plats au menu", valeur: nombre(donnees.plats.length) },
          ]} />
          <p className="flex items-start gap-2 text-[14px] leading-5 text-texte-2">
            <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <span>{phraseCloture(donnees)}</span>
          </p>
        </div>

        <p className="sr-only" role="status">{annonce}</p>
        {refus && (
          <SAlert tone="warning" action={<SBtn size="sm" variant="text" tone="secondary" onClick={() => setRefus(null)}>Fermer</SBtn>}>
            <span className="font-semibold">{refus.convive}</span> : {refus.phrase}
          </SAlert>
        )}

        {donnees.plats.length === 0 ? (
          <div className="sn-card">
            <SEmpty Icon={ChefHat} title={aujourdhui ? "Rien au menu aujourd'hui" : "Rien au menu demain"}
              hint="Dès qu'un plat est au menu de ce jour, ses réservations arrivent ici"
              action={<Link href="/admin/menus" className="hb hb--encre">Planifier les menus</Link>} />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 @2xl/page:grid-cols-2 @5xl/page:grid-cols-3">
            {donnees.plats.map((p) => <ColonnePlat key={p.id} plat={p} aujourdhui={aujourdhui} apresService={apresService} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Une colonne par plat ──────────────────────────────────────────────────── */

function ColonnePlat({ plat, aujourdhui, apresService }: {
  plat: VuePlatCommande; aujourdhui: boolean; apresService: (convive: VueConvive, reponse: ReponseService) => Promise<void>;
}) {
  return (
    <section aria-label={plat.nom} className="flex min-w-0 flex-col rounded-[20px] p-3" style={{ background: "var(--colonne)" }}>
      <header className="px-2 pt-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-[16px] leading-6">{plat.nom}</h2>
          {plat.epuise ? <SChip tone="warning" size="sm">Épuisé</SChip> : plat.complet ? <SChip tone="secondary" size="sm">Complet</SChip> : null}
        </div>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="chiffres text-[40px] leading-[44px] font-semibold text-encre/95">{nombre(plat.reserves)}</span>
          <span className="text-[14px] leading-5 text-texte-2">{plat.reserves > 1 ? "repas réservés" : "repas réservé"}</span>
        </p>
        {aujourdhui && <p className="chiffres mt-1 text-[14px] leading-5 text-texte-2">{pluriel(plat.servis, "servi")}, {nombre(plat.aServir)} à servir</p>}
        {plat.portions !== null && plat.restantes !== null && (
          <p className="chiffres mt-1 text-[14px] leading-5 text-texte-2">{pluriel(plat.portions, "portion prévue", "portions prévues")}, il en reste {nombre(plat.restantes)}</p>
        )}
      </header>
      {plat.convives.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">Personne ne l&apos;a encore réservé</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {plat.convives.map((c) => <LigneConvive key={c.id} convive={c} aujourdhui={aujourdhui} apresService={apresService} />)}
        </ul>
      )}
    </section>
  );
}

function LigneConvive({ convive, aujourdhui, apresService }: {
  convive: VueConvive; aujourdhui: boolean; apresService: (convive: VueConvive, reponse: ReponseService) => Promise<void>;
}) {
  const [enCours, demarrer] = useTransition();
  const servir = () => demarrer(async () => { await apresService(convive, await servirTicket(convive.code)); });
  return (
    <li className="rounded-[16px] px-4 py-3" style={{ background: "var(--carte)", boxShadow: "inset 0 0 0 1px var(--h-filet-doux)" }}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] leading-5 font-semibold text-encre/95">{convive.nom}</p>
        <EtatRepas etat={convive.etat} taille="sm" />
      </div>
      <div className="mt-1 flex h-8 items-center justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-3 text-[13px] leading-5 text-texte-2">
          <span className="shrink-0 font-mono text-encre/80">{convive.code}</span>
          <span className="truncate">{convive.groupe}</span>
        </p>
        {aujourdhui && convive.etat === "reservee" ? (
          <SBtn size="sm" variant="tonal" tone="secondary" disabled={enCours} onClick={servir} aria-label={`Servir ${convive.nom}`}>{enCours ? "Un instant" : "Servir"}</SBtn>
        ) : convive.serviLe ? (
          <span className="chiffres shrink-0 text-[13px] leading-5 text-texte-2">à {heureH(convive.serviLe)}</span>
        ) : null}
      </div>
    </li>
  );
}
