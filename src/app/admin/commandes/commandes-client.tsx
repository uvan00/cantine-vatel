"use client";

import { useState, useTransition } from "react";
import { EtiquettesAliments } from "@/components/allergene";
import { Avatar } from "@/components/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EtatRepas } from "@/components/etat-repas";
import { EnTetePage } from "@/components/fenetre";
import { ChefHat, Clock, Printer, UserPlus } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SAlert, SBtn, SChiffresBande, SChip, SEmpty, STabs } from "@/components/sneat";
import { useDirect } from "@/hooks/use-direct";
import type { CleJour, VueCommandes, VueConvive, VuePlatCommande } from "@/lib/donnees-admin";
import { nombre, pluriel } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { creneauLisible } from "@/lib/creneaux";
import { heureH } from "@/lib/reservation";
import { parRepas, poidsLisible } from "@/lib/restes";
import { servirTicket, type ReponseService } from "../actions";
import { FenetreReserverPour, FenetreRestes } from "./fenetres";

// Ce que la cuisine prépare, aujourd'hui ou demain : une colonne par plat, son nombre de repas en grand, ses convives.
// L'écran se relit toutes les 3 secondes. Aujourd'hui, « Servir » sert un convive sans scanner son ticket, et chaque
// plat se pèse après le service (ses restes). « Réserver pour un convive » sert celui qui n'a pas son téléphone ;
// « Feuille du jour » ouvre la liste à imprimer, le secours si le réseau lâche.

const ONGLETS: { id: CleJour; label: string }[] = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "demain", label: "Demain" },
];

/** L'état de la clôture, en une phrase. */
function phraseCloture(d: VueCommandes) {
  if (d.cle === "demain") return `Réservations ouvertes jusqu'à demain ${d.clotureLisible} : ces nombres peuvent encore monter`;
  return d.cloturee ? `Réservations closes depuis ${d.clotureLisible} : ces nombres ne bougent plus` : `Réservations ouvertes jusqu'à ${d.clotureLisible}`;
}

export function CommandesClient({ initial, encart = null }: { initial: VueCommandes; /** Sous les chiffres : les demandes hors délai. */ encart?: React.ReactNode }) {
  const [donnees, recharger] = useDirect<VueCommandes>(`/api/admin/commandes?jour=${initial.cle}`, initial, 3000);
  const router = useRouter();
  const [choisi, setChoisi] = useState<CleJour>(initial.cle);
  const [enRoute, demarrer] = useTransition();
  const [refus, setRefus] = useState<{ convive: string; phrase: string } | null>(null);
  const [annonce, setAnnonce] = useState("");
  const [reserverPour, setReserverPour] = useState(false);
  const [aPeser, setAPeser] = useState<string | null>(null);
  const aujourdhui = donnees.cle === "aujourdhui";
  const platAPeser = donnees.plats.find((p) => p.id === aPeser) ?? null;

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
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <STabs value={choisi} onChange={changer} tabs={ONGLETS} />
            {donnees.plats.length > 0 && (
              <>
                {/* Après la clôture, plus de réservation directe : le convive passe par une demande hors délai. */}
                {!donnees.cloturee && (
                  <SBtn size="sm" variant="outlined" tone="secondary" onClick={() => setReserverPour(true)}>
                    <UserPlus className="size-4" strokeWidth={1.8} />Réserver pour un convive
                  </SBtn>
                )}
                <a href={`/feuille/${donnees.cle}`} target="_blank" rel="noopener" className="hb hb--filet hb--petit">
                  <Printer className="size-4" strokeWidth={1.8} />Feuille du jour
                </a>
              </>
            )}
          </div>
        )} />

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
          {donnees.creneaux.length > 0 && (
            <ul aria-label="Passages par créneau" className="chiffres flex flex-wrap gap-2 text-[13px] leading-5">
              {donnees.creneaux.map((c) => (
                <li key={c.heure} className={`rounded-full px-3 py-1 ${c.complet ? "bg-[rgb(var(--h-alerte-teinte)/0.15)] text-encre/95" : "bg-[color:var(--h-surface)] text-encre/90"}`}>
                  {creneauLisible(c.heure)} <span className="text-texte-2">{c.pris}/{c.pris + c.libres}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {encart}

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
          // La photo de chaque plat déborde de 44 px au-dessus de sa colonne : la place est gardée en haut (pt-12) et
          // entre deux rangées (gap-y-14), pour qu'elle ne touche ni la ligne du dessus ni la colonne d'au-dessus.
          <div className="grid grid-cols-1 items-start gap-x-4 gap-y-14 pt-12 @2xl/page:grid-cols-2 @5xl/page:grid-cols-3">
            {donnees.plats.map((p) => <ColonnePlat key={p.id} plat={p} aujourdhui={aujourdhui} apresService={apresService} onPeser={() => setAPeser(p.id)} />)}
          </div>
        )}
      </div>

      {reserverPour && <FenetreReserverPour plats={donnees.plats} aujourdhui={aujourdhui} onClose={() => setReserverPour(false)} onFait={recharger} />}
      {platAPeser && <FenetreRestes plat={platAPeser} onClose={() => setAPeser(null)} onFait={recharger} />}
    </div>
  );
}

/* ── Une colonne par plat ──────────────────────────────────────────────────── */

function ColonnePlat({ plat, aujourdhui, apresService, onPeser }: {
  plat: VuePlatCommande; aujourdhui: boolean; apresService: (convive: VueConvive, reponse: ReponseService) => Promise<void>; onPeser: () => void;
}) {
  const auRepas = plat.restes === null ? null : parRepas(plat.restes, plat.servis);
  return (
    <section aria-label={plat.nom} className="flex min-w-0 flex-col rounded-[20px] p-3" style={{ background: "var(--colonne)" }}>
      {/* La photo du plat en haut, qui déborde du bord de la colonne (demande du propriétaire du 21/11/2026). Les
          photos sont détourées sur du blanc : `mix-blend-multiply` fond ce blanc dans le gris de la colonne et le
          blanc de la page (la cantine n'a pas de mode sombre), et seule l'assiette dépasse. */}
      {plat.photo && (
        <div aria-hidden="true" className="-mt-14 mb-1 flex justify-center">
          <div className="w-[min(100%,240px)] mix-blend-multiply">
            <PhotoPlat photo={plat.photo} nom="" />
          </div>
        </div>
      )}
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
        {aujourdhui && (
          <div className="mt-3 flex min-h-8 items-center justify-between gap-3 rounded-[12px] px-3 py-1.5" style={{ background: "var(--carte)", boxShadow: "inset 0 0 0 1px var(--h-filet-doux)" }}>
            <p className="chiffres min-w-0 text-[13px] leading-5 text-texte-2">
              {plat.restes === null ? "Restes pas encore pesés" : (
                <>Restes : <span className="font-semibold text-encre/90">{poidsLisible(plat.restes)}</span>{auRepas !== null && <>, {poidsLisible(auRepas)} par repas servi</>}</>
              )}
            </p>
            <SBtn size="sm" variant="text" tone="secondary" onClick={onPeser} aria-label={`Peser les restes : ${plat.nom}`}>{plat.restes === null ? "Peser" : "Modifier"}</SBtn>
          </div>
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
        <p className="flex min-w-0 items-center gap-2 text-[15px] leading-5 font-semibold text-encre/95">
          <Avatar id={convive.personneId} nom={convive.nom} photo={convive.photo} taille={28} />
          <span className="truncate">{convive.nom}</span>
        </p>
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
      {/* Son plat réservé contient ce qu'il ne mange pas (profil réglé après la réservation, ou plat modifié) : à vérifier. */}
      {convive.enCause.length > 0 && convive.etat !== "servie" && (
        <div role="alert" className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] bg-[rgb(var(--h-alerte-teinte)/0.15)] px-2 py-1.5 text-[13px] leading-5">
          <span className="font-semibold text-encre/95">Ce plat ne lui convient pas, vérifie avant de servir</span>
          <EtiquettesAliments etiquettes={convive.enCause} taille={20} className="text-encre/90" />
        </div>
      )}
      {convive.allergies.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[color:var(--h-filet-doux)] pt-2 text-[13px] leading-5">
          <span className="font-semibold text-encre/90">Allergique</span>
          <EtiquettesAliments etiquettes={convive.allergies} taille={20} className="text-encre/80" />
        </div>
      )}
    </li>
  );
}
