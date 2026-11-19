"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Trash2, ChevronRight } from "@/components/icons";
import { SBtn, SChargement, SSquelette, SStatSquelette, encre } from "@/components/sneat";

/**
 * Fenêtre façon Hostinger (« h-dialog », relevée le 07/11/2026) : fond noir à 75 %,
 * fenêtre de 600 px à coins de 24, filet discret et ombre longue, en fondu de 225 ms ;
 * titre 20/600, sous-titre 14 gris, bouton icône de 40 px en haut à droite. Feuille du
 * bas sur téléphone. Fermée par Échap ou un clic à côté. `large` pour les formulaires longs.
 */
export function Fenetre({ titre, sousTitre, onClose, children, large = false }: {
    titre: React.ReactNode; sousTitre?: React.ReactNode; onClose: () => void; children: React.ReactNode; large?: boolean;
}) {
    useEffect(() => {
        // Échap déjà pris par un menu ou un calendrier ouvert dans la fenêtre : il ne ferme que celui-ci.
        const echap = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onClose(); };
        document.addEventListener("keydown", echap);
        const avant = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.removeEventListener("keydown", echap); document.body.style.overflow = avant; };
    }, [onClose]);
    return (
        <div className="sn-fondu fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-8"
            style={{ background: "rgb(0 0 0 / 0.75)" }} onClick={onClose}>
            <div role="dialog" aria-modal="true"
                className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] md:rounded-[24px] ${large ? "md:max-w-[720px]" : "md:max-w-[600px]"}`}
                style={{
                    background: "rgb(var(--sn-surface))",
                    boxShadow: "inset 0 0 0 1px var(--h-filet-doux), var(--h-ombre-3)",
                }}
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3 pb-2 pl-6 pr-4 pt-4">
                    <div className="min-w-0 flex-1 pt-2">
                        <h2 className="text-[20px] leading-7" style={{ color: encre(0.95), fontWeight: 600 }}>{titre}</h2>
                        {sousTitre && <p className="mt-2 text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{sousTitre}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fermer" title="Fermer"
                        className="grid size-10 shrink-0 place-items-center rounded-[12px] transition-colors hover:bg-[color:var(--h-survol)]"
                        style={{ color: encre(0.95) }}>
                        <X className="size-5" strokeWidth={1.8} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2 text-[14px]" style={{ color: encre(0.8) }}>{children}</div>
            </div>
        </div>
    );
}

/** Entrée du panneau de côté : de la droite sur ordinateur, du bas sur téléphone. */
const TIROIR_CSS = `
@keyframes sn-tiroir-bas { from { transform: translateY(32px); opacity: 0 } }
@keyframes sn-tiroir-droite { from { transform: translateX(32px); opacity: 0 } }
.sn-tiroir { animation: sn-tiroir-bas .25s cubic-bezier(.2,.8,.2,1) both }
@media (min-width: 768px) { .sn-tiroir { animation-name: sn-tiroir-droite } }
@media (prefers-reduced-motion: reduce) { .sn-tiroir { animation: none } }
`;

/**
 * Panneau de côté façon Hostinger (« Subscription details » de leur facturation, relevé le 08/11/2026) : collé à
 * droite sur ordinateur, 520 px, marges de 24, titre 20/600, bouton rond de 40 px pour fermer posé à sa gauche ;
 * feuille du bas sur téléphone. Fond noir à 75 %, fermé par Échap ou un clic à côté.
 */
export function Tiroir({ titre, onClose, children }: { titre: string; onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const echap = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onClose(); };
        document.addEventListener("keydown", echap);
        const avant = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.removeEventListener("keydown", echap); document.body.style.overflow = avant; };
    }, [onClose]);
    return (
        <div className="sn-fondu fixed inset-0 z-50 flex items-end justify-end md:items-stretch"
            style={{ background: "rgb(0 0 0 / 0.75)" }} onClick={onClose}>
            <style>{TIROIR_CSS}</style>
            <div className="sn-tiroir relative flex max-h-[92vh] w-full flex-col md:max-h-none md:w-[520px]" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={onClose} aria-label="Fermer" title="Fermer"
                    className="absolute -left-14 top-4 hidden size-10 place-items-center rounded-full md:grid"
                    style={{ background: "rgb(var(--sn-surface))", color: encre(0.95), boxShadow: "var(--h-ombre-3)" }}>
                    <X className="size-5" strokeWidth={1.8} />
                </button>
                <div role="dialog" aria-modal="true" aria-label={titre}
                    className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[24px] p-6 md:rounded-none"
                    style={{ background: "rgb(var(--sn-surface))", boxShadow: "inset 0 0 0 1px var(--h-filet-doux)" }}>
                    <div className="flex items-start gap-3">
                        <h2 className="min-w-0 flex-1 text-[20px] leading-7" style={{ color: encre(0.95), fontWeight: 600 }}>{titre}</h2>
                        <button type="button" onClick={onClose} aria-label="Fermer" title="Fermer"
                            className="-mr-2 -mt-1.5 grid size-10 shrink-0 place-items-center rounded-[12px] transition-colors hover:bg-[color:var(--h-survol)] md:hidden"
                            style={{ color: encre(0.95) }}>
                            <X className="size-5" strokeWidth={1.8} />
                        </button>
                    </div>
                    <div className="mt-4 text-[14px]" style={{ color: encre(0.8) }}>{children}</div>
                </div>
            </div>
        </div>
    );
}

/** Option d'une fenêtre de choix (Beacons, « Upload a CSV file ») : carte à
 *  filet, tuile grise de 40 px avec l'icône, titre 14/600 et ligne grise. */
export function OptionFenetre({ Icon, titre, texte, onClick, href }: {
    Icon: any; titre: React.ReactNode; texte?: React.ReactNode; onClick?: () => void; href?: string;
}) {
    const contenu = (
        <>
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--h-surface)", color: encre(0.9) }}>
                <Icon className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-5" style={{ color: encre(0.95) }}>{titre}</span>
                {texte && <span className="block text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{texte}</span>}
            </span>
            <ChevronRight className="size-4 shrink-0" style={{ color: encre(0.4) }} strokeWidth={1.8} />
        </>
    );
    const cls = "flex w-full items-center gap-4 rounded-[16px] border p-4 text-left transition-colors hover:bg-[color:var(--h-filet-doux)]";
    if (href) return <a href={href} className={cls} style={{ borderColor: "var(--h-filet)" }}>{contenu}</a>;
    return <button type="button" onClick={onClick} className={cls} style={{ borderColor: "var(--h-filet)" }}>{contenu}</button>;
}

/** En-tête de page de Hostinger (« h-subheader ») : titre 24/400 sur 32 px, sous-titre 14 gris. */
export function EnTetePage({ titre, sousTitre, actions }: { titre: string; sousTitre?: React.ReactNode; actions?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
                <h1 className="text-[24px] leading-8" style={{ color: encre(0.95), fontWeight: 400 }}>{titre}</h1>
                {sousTitre && <p className="mt-1 max-w-[640px] text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{sousTitre}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

/**
 * Chargement d'une page, comme chez Beacons :
 *  - sans titre : le rond qui tourne au milieu de la page ;
 *  - avec un titre : le titre tout de suite, puis des blocs gris qui pulsent
 *    à la place des chiffres (`chiffres` cartes) et du contenu (`bloc`).
 */
export function PageEnChargement({ titre, chiffres = 0, bloc = true }: { titre?: string; chiffres?: number; bloc?: boolean } = {}) {
    if (!titre) {
        return <div className="grid min-h-[60vh] w-full place-items-center"><SChargement /></div>;
    }
    return (
        <div className="w-full space-y-6" aria-busy="true">
            <h1 className="text-[24px] leading-8" style={{ color: encre(0.95), fontWeight: 400 }}>{titre}</h1>
            {chiffres > 0 && (
                <div className={`grid grid-cols-2 gap-4 ${chiffres >= 4 ? "lg:grid-cols-4" : chiffres === 3 ? "lg:grid-cols-3" : ""}`}>
                    {Array.from({ length: chiffres }, (_, i) => <SStatSquelette key={i} />)}
                </div>
            )}
            {bloc && (
                <div className="sn-card p-5">
                    <SSquelette className="h-96 w-full" />
                </div>
            )}
        </div>
    );
}

/**
 * Confirmation dans une fenêtre du kit (jamais `window.confirm` : un navigateur
 * les bloque en silence après plusieurs boîtes). Utilisation :
 *   const { confirmer, fenetre } = useConfirmation();
 *   if (!(await confirmer({ titre, message, libelle: "Supprimer" }))) return;
 *   ... puis rendre {fenetre} dans la page.
 * `refus` nomme l'autre bouton quand « Annuler » prêterait à confusion ; `corbeille: false`
 * quand le geste n'est pas une suppression.
 */
type Demande = { titre: string; message: string; libelle: string; refus: string; corbeille: boolean; resolve: (ok: boolean) => void };

export function useConfirmation() {
    const [demande, setDemande] = useState<Demande | null>(null);
    const confirmer = useCallback((o: { titre: string; message: string; libelle?: string; refus?: string; corbeille?: boolean }) =>
        new Promise<boolean>((resolve) => setDemande({ titre: o.titre, message: o.message, libelle: o.libelle || "Confirmer", refus: o.refus || "Annuler", corbeille: o.corbeille !== false, resolve })), []);
    const fermer = (ok: boolean) => { demande?.resolve(ok); setDemande(null); };
    const fenetre = demande ? (
        <Fenetre titre={demande.titre} onClose={() => fermer(false)}>
            <p className="text-[14px] leading-[1.4]" style={{ color: encre(0.75) }}>{demande.message}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <SBtn variant="outlined" onClick={() => fermer(false)}>{demande.refus}</SBtn>
                <SBtn tone="error" onClick={() => fermer(true)}>{demande.corbeille && <Trash2 className="h-4 w-4" strokeWidth={1.8} />} {demande.libelle}</SBtn>
            </div>
        </Fenetre>
    ) : null;
    return { confirmer, fenetre };
}
