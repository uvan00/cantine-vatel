"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { envoyerMessage, etatAssistant, repondreQuestion } from "@/app/admin/assistant/actions";
import { ArrowRight, Loader2, Maximize, Minimize, RefreshCw, Send, X } from "@/components/icons";
import MatrixOrb from "@/components/rare-ui/matrix-orb";
import { QUESTIONS, QUESTION_MAX, type Lien, type QuestionGuidee } from "@/lib/assistant";
import { nombre, pluriel } from "@/lib/format";

// Le panneau de l'assistant de la cantine, repris de celui de LinkAfr (demande du propriétaire du 21/11/2026) : l'orbe,
// le bonjour avec le service du jour, le fil, les questions guidées (vrais chiffres, sans IA) et la question libre
// (Claude, dans le plafond du jour). Le fil reste dans ce navigateur (localStorage) : rien n'est écrit en base.

type Bulle = { role: "user" | "assistant"; content: string; lien?: Lien | null };
type Etat = Awaited<ReturnType<typeof etatAssistant>>;

const CLE_FIL = "cantine.assistant.fil";
const FIL_MAX = 40;
const COULEUR_ORBE = "#2475A6";

function lireFil(): Bulle[] {
  try {
    const brut: unknown = JSON.parse(localStorage.getItem(CLE_FIL) ?? "[]");
    return Array.isArray(brut)
      ? brut.filter((b): b is Bulle => !!b && (b.role === "user" || b.role === "assistant") && typeof b.content === "string").slice(-FIL_MAX)
      : [];
  } catch {
    return [];
  }
}

export function AssistantCantine({ onClose, large, onToggleLarge, onNavigate }: {
  onClose: () => void;
  large?: boolean;
  /** Agrandir ou réduire le panneau posé en colonne (grand écran). */
  onToggleLarge?: () => void;
  /** Ferme le tiroir (téléphone, tablette) quand on suit un lien. */
  onNavigate?: () => void;
}) {
  const [etat, setEtat] = useState<Etat | null>(null);
  // Le panneau ne s'ouvre qu'après le premier rendu du navigateur : localStorage est là.
  const [fil, setFil] = useState<Bulle[]>(lireFil);
  const [occupe, setOccupe] = useState<QuestionGuidee | "libre" | null>(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  // « réfléchit » au départ, puis « écrit » tant que la réponse n'est pas arrivée, comme dans LinkAfr.
  const [phase, setPhase] = useState<"reflechit" | "ecrit">("reflechit");
  const bas = useRef<HTMLDivElement>(null);

  const lire = () => etatAssistant().catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas" }));
  const charger = async () => { setEtat(null); setEtat(await lire()); };
  useEffect(() => {
    let vivant = true;
    void lire().then((r) => { if (vivant) setEtat(r); });
    return () => { vivant = false; };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(CLE_FIL, JSON.stringify(fil.slice(-FIL_MAX))); } catch { /* navigation privée : le fil ne se garde pas */ }
  }, [fil]);
  useEffect(() => { bas.current?.scrollIntoView({ block: "end" }); }, [fil, occupe]);
  // La phase repart à « réfléchit » à chaque question (dans le geste), puis passe à « écrit » au bout de 1,8 s.
  useEffect(() => {
    if (!occupe) return;
    const t = setTimeout(() => setPhase("ecrit"), 1800);
    return () => clearTimeout(t);
  }, [occupe]);

  const demander = async (id: QuestionGuidee) => {
    if (occupe) return;
    setErreur(null);
    setPhase("reflechit");
    setOccupe(id);
    const r = await repondreQuestion(id).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    setOccupe(null);
    if (!r.ok) { setErreur(r.erreur); return; }
    setFil((f) => [...f, { role: "user", content: r.question }, { role: "assistant", content: r.reponse, lien: r.lien }]);
  };

  const envoyer = async () => {
    const q = texte.trim();
    if (!q || occupe) return;
    setErreur(null);
    setPhase("reflechit");
    setOccupe("libre");
    const avant = fil;
    setFil([...avant, { role: "user", content: q }]);
    setTexte("");
    const r = await envoyerMessage(q, avant.map(({ role, content }) => ({ role, content })))
      .catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    setOccupe(null);
    if (!r.ok) {
      setErreur(r.erreur);
      setFil(avant);
      setTexte(q);
      return;
    }
    setFil([...avant, { role: "user", content: q }, { role: "assistant", content: r.reponse, lien: r.lien }]);
    setEtat((e) => (e && e.ok ? { ...e, ia: { ...e.ia, restantes: r.restantes } } : e));
  };

  const ia = etat?.ok ? etat.ia : null;
  const s = etat?.ok ? etat.service : null;

  return (
    <section aria-label="Assistant de la cantine" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        {/* L'orbe de Rare UI (comme dans LinkAfr), au bleu de Vatel : au repos, à l'écoute pendant la frappe, en
            réflexion pendant la réponse. */}
        <MatrixOrb size={40} dots={7} color={COULEUR_ORBE} state={occupe ? "thinking" : texte.trim() ? "listening" : "idle"}
          className="shrink-0 gap-0 [&_[role=status]]:sr-only" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-[1.1] font-semibold text-encre/95">Assistant de la cantine</p>
          <p className="mt-0.5 truncate text-[12px] text-texte-2">Ton équipier en cuisine</p>
        </div>
        {onToggleLarge && (
          <button type="button" onClick={onToggleLarge} aria-label={large ? "Réduire le panneau" : "Agrandir le panneau"}
            className="grid size-8 place-items-center rounded-[8px] bg-[color:var(--h-filet-doux)] text-encre/80 transition-colors hover:bg-[color:var(--h-survol)]">
            {large ? <Minimize className="size-4" strokeWidth={1.8} /> : <Maximize className="size-4" strokeWidth={1.8} />}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Fermer l'assistant"
          className="grid size-8 place-items-center rounded-[8px] text-encre/80 transition-colors hover:bg-[color:var(--h-survol)]">
          <X className="size-[18px]" strokeWidth={1.8} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {!etat ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-10 w-3/4 animate-pulse rounded-[14px] bg-[color:var(--h-filet-doux)]" />
            <div className="h-24 w-2/3 animate-pulse rounded-[14px] bg-[color:var(--h-filet-doux)]" />
          </div>
        ) : !etat.ok ? (
          <BulleAssistant>
            {etat.erreur}{" "}
            <button type="button" onClick={() => void charger()} className="font-medium underline">Réessayer</button>
          </BulleAssistant>
        ) : (
          <>
            <BulleAssistant>
              <span className="block">
                Bonjour{etat.prenom ? ` ${etat.prenom}` : ""}.{" "}
                {s && s.reserves > 0
                  ? <>Aujourd&apos;hui : {pluriel(s.reserves, "repas réservé", "repas réservés")}, {pluriel(s.servis, "servi")}, {nombre(s.aServir)} à servir.</>
                  : <>Personne n&apos;a réservé pour aujourd&apos;hui.</>}
              </span>
              {etat.rechargesEnAttente > 0 && (
                <Link href="/admin/recharges" onClick={onNavigate} className="mt-2 flex w-fit items-center gap-1 text-[14px] font-medium text-encre/95 hover:underline">
                  {pluriel(etat.rechargesEnAttente, "recharge attend", "recharges attendent")} ta confirmation <ArrowRight className="size-4" strokeWidth={1.8} />
                </Link>
              )}
            </BulleAssistant>

            {fil.length > 0 && (
              <div className="flex justify-center pt-1">
                <button type="button" onClick={() => setFil([])} className="inline-flex items-center gap-1 text-[12px] font-medium text-texte-2 hover:underline">
                  <RefreshCw className="size-3.5" strokeWidth={1.8} /> Effacer la conversation
                </button>
              </div>
            )}
            {fil.map((b, i) => (b.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[82%] rounded-[22px] bg-[rgb(var(--sn-cta))] px-5 py-3.5 text-[15px] leading-[1.45] whitespace-pre-line text-white">{b.content}</p>
              </div>
            ) : (
              <BulleAssistant key={i}>
                <span className="whitespace-pre-line">{b.content}</span>
                {b.lien && (
                  <Link href={b.lien.href} onClick={onNavigate} className="mt-2 flex w-fit items-center gap-1 text-[14px] font-medium text-encre/95 hover:underline">
                    {b.lien.libelle} <ArrowRight className="size-4" strokeWidth={1.8} />
                  </Link>
                )}
              </BulleAssistant>
            )))}
            {occupe && (
              <p className="flex items-center gap-2 px-1 text-[13px] text-texte-2">
                <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-marque" />
                {phase === "reflechit" ? "L'assistant réfléchit" : "L'assistant écrit"}
              </p>
            )}
            <div ref={bas} />
          </>
        )}
      </div>

      {etat?.ok && (
        <footer className="space-y-3 px-4 pt-2 pb-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
            {QUESTIONS.map((q) => (
              <button key={q.id} type="button" onClick={() => void demander(q.id)} disabled={!!occupe}
                className="min-w-[150px] shrink-0 rounded-[8px] border border-[color:var(--h-filet)] bg-surface p-2 text-left text-[12px] leading-4 font-medium text-marque-texte transition-colors hover:bg-[color:var(--h-filet-doux)] disabled:opacity-50">
                {q.libelle}
              </button>
            ))}
          </div>
          {erreur && <p role="alert" className="px-1 text-[13px] leading-5 text-erreur-texte">{erreur}</p>}
          <div className="rounded-[26px] border border-[color:var(--h-filet)] bg-surface px-4 pt-2 pb-2.5 shadow-[0_1px_3px_rgb(0_0_0/0.08)]">
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={1} maxLength={QUESTION_MAX}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void envoyer(); } }}
              placeholder="Écris à l'assistant" aria-label="Ta question à l'assistant"
              className="block w-full resize-none bg-transparent py-1 text-[14px] leading-6 text-encre/95 outline-none placeholder:text-texte-2" />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="chiffres truncate text-[12px] text-texte-2">
                {ia?.branchee ? pluriel(ia.restantes, "question libre restante", "questions libres restantes") + " aujourd'hui" : "Sans clé d'IA : les questions guidées répondent"}
              </span>
              <button type="button" onClick={() => void envoyer()} disabled={!texte.trim() || !!occupe} aria-label="Envoyer"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgb(var(--sn-cta))] text-white transition-opacity disabled:opacity-30">
                {occupe === "libre" ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} /> : <Send className="size-4" strokeWidth={1.8} />}
              </button>
            </div>
          </div>
        </footer>
      )}
    </section>
  );
}

function BulleAssistant({ children }: { children: React.ReactNode }) {
  return <div className="w-fit max-w-[82%] rounded-[22px] bg-[rgb(var(--sn-on)/0.04)] px-5 py-3.5 text-[15px] leading-[1.45] text-encre/95">{children}</div>;
}
