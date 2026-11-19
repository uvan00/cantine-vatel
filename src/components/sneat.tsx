"use client";

import { Children, Fragment, forwardRef, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronRight, ChevronLeft, ChevronDown, Search, CalendarClock, Clock } from "@/components/icons";

/**
 * KIT DU TABLEAU DE BORD — les noms viennent du template Sneat d'origine,
 * les composants sont ceux de Hostinger depuis le 07/11/2026 (relevés sur
 * hpanel.hostinger.com, jetons --h-* en clair et en sombre ; avant : Beacons) :
 *   • carte      : coins de 24, filet à 10 %, sans ombre ; titre 18/600, sous-titre 14 gris
 *   • bouton     : 40 px (32 en petit), coins de 12, 14/700 ; plein à l'orange de LinkAfr
 *                  (à la place de leur violet), à l'encre, à filet, en texte
 *   • champ      : 48 px, coins de 12, filet de 1 px, halo orange de 3 px au focus ;
 *                  menu déroulant maison (liste à coins de 12, lignes à coins de 8)
 *   • tableau    : entête 14/700 en 12 × 16, cellules de 16 px, filets à 10 %
 *   • onglets    : pilule de Hostinger (« segmented control ») ou soulignés à l'orange
 *   • interrupteur : 37 × 22, orange allumé ; case à cocher de 20 px
 *   • chiffre    : libellé 14/500 gris, valeur 24/600
 *
 * Police DM Sans, encre déclinée en opacités. Les jetons et les classes `hb`,
 * `h-champ`, `h-liste`, `h-case` vivent dans `globals.css`.
 *
 * ⚠️ La version LIBRE du template ne contient ni module e-commerce ni module
 * calendrier (ils sont réservés à la version Pro). `SCalendar` et `STimeline`
 * sont donc écrits ici DANS la grammaire de Sneat, à partir de ses primitives.
 */

export type Ton = "primary" | "success" | "error" | "warning" | "info" | "secondary";

const TON: Record<Ton, string> = {
    primary: "var(--sn-primary)",
    success: "var(--sn-success)",
    error: "var(--sn-error)",
    warning: "var(--sn-warning)",
    info: "var(--sn-info)",
    secondary: "var(--sn-secondary)",
};

const rgb = (t: Ton, a?: number) => (a === undefined ? `rgb(${TON[t]})` : `rgb(${TON[t]} / ${a})`);
/** Encre du template, déclinée par emphase. */
export const encre = (a: number) => `rgb(var(--sn-on) / ${a})`;

/* ══════════════════════════════════════════════════════════════════════════
   CARTE  —  VCard / VCardItem / VCardText
   ══════════════════════════════════════════════════════════════════════════ */

export function SCard({ children, className = "", pad = false }: {
    children: React.ReactNode; className?: string;
    /** Rembourrage direct, pour les cartes sans en-tête. */
    pad?: boolean;
}) {
    return <div className={`sn-card ${pad ? "p-6" : ""} ${className}`}>{children}</div>;
}

/** En-tête : titre 18/500, sous-titre, action optionnelle à droite. */
export function SCardItem({ title, subtitle, append, tone, className = "" }: {
    title?: React.ReactNode; subtitle?: React.ReactNode; append?: React.ReactNode;
    /** Sneat colore le titre à l'accent sur ses cartes de mise en avant. */
    tone?: Ton; className?: string;
}) {
    return (
        <div className={`flex items-start justify-between gap-3 px-6 pb-4 pt-6 ${className}`}>
            <div className="min-w-0">
                {title && (
                    <h2 className="text-[18px] leading-6"
                        style={{ color: tone ? rgb(tone) : encre(0.95), fontWeight: 600 }}>
                        {title}
                    </h2>
                )}
                {subtitle && <p className="mt-1 text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{subtitle}</p>}
            </div>
            {append && <div className="shrink-0">{append}</div>}
        </div>
    );
}

/** Corps : le rembourrage du template est 0 24px 24px. */
export function SCardText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-6 pb-6 text-[14px] ${className}`} style={{ color: encre(0.75) }}>{children}</div>;
}

/** Section titrée : regroupe plusieurs cartes sous un même intitulé. */
export function SSection({ title, action, children }: {
    title?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <section className="min-w-0">
            {(title || action) && (
                <div className="mb-4 flex items-center justify-between gap-3">
                    {title && (
                        <h2 className="text-[18px] leading-[1.1]" style={{ color: encre(0.95), fontWeight: 600 }}>{title}</h2>
                    )}
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   BOUTON  —  VBtn
   ══════════════════════════════════════════════════════════════════════════ */

type BtnProps = {
    children: React.ReactNode;
    tone?: Ton;
    /** elevated : plein (orange pour primary, encre pour secondary) ; vif : plein orange ;
     *  outlined : filet gris et texte à l'encre ; tonal : fond gris ; text : lien. */
    variant?: "elevated" | "vif" | "tonal" | "outlined" | "text";
    size?: "sm" | "md";
    block?: boolean;
    className?: string;
};

/**
 * Variante de Hostinger (« h-button-v2 ») pour un ton et une variante du kit : plein à l'orange
 * (« contain-primary »), à l'encre (« contain-neutral »), à filet (« outline-neutral »), gris
 * (surface), en texte. Seule l'erreur garde sa couleur (suppression, refus). Les couleurs et
 * les survols sont les classes `hb--*` de globals.css.
 */
function btnClasse(tone: Ton, variant: NonNullable<BtnProps["variant"]>): string {
    if (variant === "vif") return "hb--plein";
    if (variant === "elevated") {
        if (tone === "secondary") return "hb--encre";
        if (tone === "error") return "hb--danger";
        if (tone === "success") return "hb--succes";
        if (tone === "warning") return "hb--alerte";
        return "hb--plein";
    }
    if (variant === "tonal") return tone === "error" ? "hb--teinte-danger" : "hb--teinte";
    if (variant === "outlined") return tone === "error" ? "hb--filet-danger" : "hb--filet";
    return tone === "error" ? "hb--texte-danger" : tone === "primary" ? "hb--texte-marque" : "hb--texte";
}

const classesBouton = (tone: Ton, variant: NonNullable<BtnProps["variant"]>, size: "sm" | "md", block?: boolean, className = "") =>
    `hb ${btnClasse(tone, variant)} ${size === "sm" ? "hb--petit" : ""} ${block ? "w-full" : ""} ${className}`;

export function SBtn({
    children, tone = "primary", variant = "elevated", size = "md", block, className = "",
    ...rest
}: BtnProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button className={classesBouton(tone, variant, size, block, className)} {...rest}>
            {children}
        </button>
    );
}

/** Même bouton, en lien (interne via next/link, externe via <a>). */
export function SBtnLink({
    children, href, external, tone = "primary", variant = "elevated", size = "md", block, className = "",
}: BtnProps & { href: string; external?: boolean }) {
    const cls = classesBouton(tone, variant, size, block, className);
    if (external) {
        return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
    }
    return <Link href={href} className={cls}>{children}</Link>;
}

/** Bouton icône de Hostinger (« h-icon-button », en texte) : 40 px, coins de 12, gris au survol. */
export function SIconBtn({ children, label, ...rest }: {
    children: React.ReactNode; label: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button type="button" aria-label={label} title={label} {...rest}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] transition-colors hover:bg-[color:var(--h-survol)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] disabled:opacity-40"
            style={{ color: encre(0.9) }}>
            {children}
        </button>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   AVATAR & PASTILLE  —  VAvatar / VChip
   ══════════════════════════════════════════════════════════════════════════ */

/** Avatar carré à coins arrondis, fond teinté à 16 % : la signature de Sneat. */
export function SAvatar({ Icon, src, alt = "", tone = "primary", size = 40, rounded = true }: {
    Icon?: any; src?: string | null; alt?: string; tone?: Ton; size?: number; rounded?: boolean;
}) {
    const s = { width: size, height: size } as React.CSSProperties;
    if (src) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} style={s}
                className={`shrink-0 object-cover ${rounded ? "rounded-[12px]" : "rounded-full"}`} />
        );
    }
    return (
        <span style={{ ...s, background: "var(--h-surface)", color: encre(0.9) }}
            className={`grid shrink-0 place-items-center ${rounded ? "rounded-[12px]" : "rounded-full"}`}>
            {Icon && <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.8} />}
        </span>
    );
}

/** Étiquettes de Hostinger (« h-label », « contain ») : teinte à 10 % (20 % en sombre) et texte
 *  du même ton ; la grise (« grayLight ») sur la surface, texte gris. */
const PASTILLE: Record<Ton, React.CSSProperties> = {
    success: { background: "rgb(var(--h-succes-teinte) / var(--h-teinte))", color: "rgb(var(--h-succes-texte))" },
    warning: { background: "rgb(var(--h-alerte-teinte) / 0.15)", color: "rgb(var(--h-alerte-texte))" },
    error: { background: "rgb(var(--h-danger-teinte) / var(--h-teinte))", color: "rgb(var(--h-danger-texte))" },
    info: { background: "rgb(var(--h-marque-teinte) / var(--h-teinte))", color: "rgb(var(--h-marque-texte))" },
    primary: { background: "rgb(var(--h-marque-teinte) / var(--h-teinte))", color: "rgb(var(--h-marque-texte))" },
    secondary: { background: "var(--h-surface)", color: "var(--h-texte-2)" },
};

export function SChip({ children, tone = "primary", size = "md" }: {
    children: React.ReactNode; tone?: Ton; size?: "sm" | "md";
}) {
    return (
        <span style={PASTILLE[tone]}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] px-2 font-medium ${size === "sm" ? "min-h-5 py-0.5 text-[12px] leading-4" : "min-h-6 py-0.5 text-[14px] leading-5"}`}>
            {children}
        </span>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   LISTE  —  VList / VListItem  (prepend · titre + sous-titre · append)
   ══════════════════════════════════════════════════════════════════════════ */

export function SList({ children, gap = 20 }: { children: React.ReactNode; gap?: number }) {
    return <ul className="flex flex-col" style={{ rowGap: gap }}>{children}</ul>;
}

export function SListItem({ prepend, title, subtitle, append, href, onClick }: {
    prepend?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode;
    append?: React.ReactNode; href?: string; onClick?: () => void;
}) {
    const inner = (
        <>
            {prepend}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium" style={{ color: encre(0.95) }}>{title}</span>
                {subtitle && <span className="block truncate text-[13px]" style={{ color: encre(0.62) }}>{subtitle}</span>}
            </span>
            {append && <span className="shrink-0 text-[14px]" style={{ color: encre(0.8) }}>{append}</span>}
            {(href || onClick) && !append && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: encre(0.4) }} />}
        </>
    );
    const cls = "flex w-full items-center gap-3 text-left";
    if (href) return <li><Link href={href} className={`${cls} -mx-2 rounded-[12px] px-2 py-1 transition-colors hover:bg-[color:var(--h-filet-doux)]`}>{inner}</Link></li>;
    if (onClick) return <li><button type="button" onClick={onClick} className={`${cls} -mx-2 rounded-[12px] px-2 py-1 transition-colors hover:bg-[color:var(--h-filet-doux)]`}>{inner}</button></li>;
    return <li className={cls}>{inner}</li>;
}

/* ══════════════════════════════════════════════════════════════════════════
   TABLEAU  —  VTable
   ══════════════════════════════════════════════════════════════════════════ */

export function STable({ head, children, className = "" }: {
    head: React.ReactNode[]; children: React.ReactNode; className?: string;
}) {
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full border-collapse text-[14px]" style={{ color: encre(0.85) }}>
                <thead>
                    <tr>
                        {head.map((h, i) => (
                            <th key={i}
                                className="whitespace-nowrap border-b px-4 py-3 text-left text-[14px] font-bold leading-5 first:pl-6 last:pr-6"
                                style={{ color: encre(0.95), borderColor: "var(--h-filet)" }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

export function STr({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
    return (
        <tr onClick={onClick}
            className={`transition-colors ${onClick ? "cursor-pointer hover:bg-[color:var(--h-filet-doux)]" : ""}`}>
            {children}
        </tr>
    );
}

export function STd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <td className={`border-b px-4 py-4 leading-5 first:pl-6 last:pr-6 ${className}`}
            style={{ borderColor: "var(--h-filet)" }}>
            {children}
        </td>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORMULAIRE  —  VTextField / VSelect / VSwitch / VCheckbox
   ══════════════════════════════════════════════════════════════════════════ */

/** Étiquette au-dessus du champ (« h-input-label ») : 14/600, 8 px d'écart ; aide en 12 gris dessous. */
export function SField({ label, hint, children, className = "" }: {
    label?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
    return (
        <label className={`block ${className}`}>
            {label && <span className="mb-2 block pl-0.5 text-[14px] font-semibold leading-5" style={{ color: encre(0.95) }}>{label}</span>}
            {children}
            {hint && <span className="mt-2 block pl-0.5 text-[12px] leading-4" style={{ color: "var(--h-texte-2)" }}>{hint}</span>}
        </label>
    );
}

/** Champ de Hostinger (« h-input-border ») : 48 px, coins de 12, filet de 1 px, halo orange au focus.
 *  En type date, time ou datetime-local, il ouvre le calendrier et la liste d'heures maison (`SChoixTemps`). */
export function SInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    if (props.type === "date" || props.type === "time" || props.type === "datetime-local") return <SChoixTemps {...props} />;
    const { className = "", ...rest } = props;
    return <input {...rest} className={`h-champ ${className}`} />;
}

/** `forwardRef` : l'appelant a parfois besoin du curseur (insertion de variables). */
export const STextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    function STextarea({ className = "", ...rest }, ref) {
        return <textarea ref={ref} {...rest} className={`h-champ ${className}`} />;
    },
);

/* Menu déroulant de Hostinger (« h-select » et « h-dropdown-list »), qui remplace le <select> natif
   en gardant son mode d'emploi : les pages passent toujours des <option> (et <optgroup>) et reçoivent
   `onChange` avec `e.target.value`. Clavier : flèches, Début, Fin, Entrée, Espace, Échap, Tab et
   frappe des premières lettres. La liste est posée dans <body> : une carte `overflow-hidden` ne la
   coupe pas ; elle s'ouvre vers le haut quand la place manque en bas. */
type OptionChoix = { value: string; label: React.ReactNode; texte: string; disabled: boolean; groupe?: string };

function texteDe(n: React.ReactNode): string {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string" || typeof n === "number") return String(n);
    if (Array.isArray(n)) return n.map(texteDe).join("");
    if (isValidElement(n)) return texteDe((n.props as { children?: React.ReactNode }).children);
    return "";
}

function lireOptions(enfants: React.ReactNode, groupe?: string): OptionChoix[] {
    const liste: OptionChoix[] = [];
    Children.forEach(enfants, (enfant) => {
        if (!isValidElement(enfant)) return;
        const p = enfant.props as { value?: unknown; children?: React.ReactNode; disabled?: boolean; label?: string };
        if (enfant.type === "option") {
            const texte = texteDe(p.children);
            liste.push({ value: p.value === undefined ? texte : String(p.value), label: p.children, texte, disabled: !!p.disabled, groupe });
        } else if (enfant.type === "optgroup") {
            liste.push(...lireOptions(p.children, p.label));
        } else if (enfant.type === Fragment) {
            liste.push(...lireOptions(p.children, groupe));
        }
    });
    return liste;
}

type Placement = { left: number; width: number; maxH: number; top?: number; bottom?: number };

export function SSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    const { className = "", children, value, defaultValue, onChange, disabled, id, name, style, title, required } = props;
    const options = useMemo(() => lireOptions(children), [children]);
    const [interne, setInterne] = useState(defaultValue === undefined ? "" : String(defaultValue));
    const valeur = value === undefined || value === null ? interne : String(value);
    const indexCourant = options.findIndex((o) => o.value === valeur);
    const courant = indexCourant >= 0 ? options[indexCourant] : options[0];
    const [ouvert, setOuvert] = useState(false);
    const [actif, setActif] = useState(-1);
    const [place, setPlace] = useState<Placement | null>(null);
    const bouton = useRef<HTMLButtonElement>(null);
    const liste = useRef<HTMLUListElement>(null);
    const frappe = useRef({ texte: "", t: 0 });
    const idListe = useId();

    const placer = useCallback(() => {
        const el = bouton.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const bas = window.innerHeight - r.bottom - 12;
        const haut = r.top - 12;
        const versHaut = bas < 220 && haut > bas;
        const maxH = Math.max(120, Math.min(320, versHaut ? haut : bas));
        setPlace(versHaut
            ? { left: r.left, width: r.width, maxH, bottom: window.innerHeight - r.top + 4 }
            : { left: r.left, width: r.width, maxH, top: r.bottom + 4 });
    }, []);

    const suivant = useCallback((depuis: number, sens: 1 | -1) => {
        for (let k = 1; k <= options.length; k++) {
            const i = (depuis + sens * k + options.length * 2) % options.length;
            if (!options[i].disabled) return i;
        }
        return depuis;
    }, [options]);

    const ouvrir = () => {
        if (disabled || !options.length) return;
        placer();
        setActif(indexCourant >= 0 ? indexCourant : suivant(-1, 1));
        setOuvert(true);
    };
    const fermer = (focus = true) => {
        setOuvert(false);
        if (focus) bouton.current?.focus();
    };
    const choisir = (i: number) => {
        const o = options[i];
        if (!o || o.disabled) return;
        fermer();
        if (value === undefined) setInterne(o.value);
        if (o.value !== valeur && onChange) {
            const cible = { value: o.value, name: name ?? "", id: id ?? "" };
            onChange({ target: cible, currentTarget: cible } as unknown as React.ChangeEvent<HTMLSelectElement>);
        }
    };

    useEffect(() => {
        if (!ouvert) return;
        const dehors = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!bouton.current?.contains(t) && !liste.current?.contains(t)) setOuvert(false);
        };
        document.addEventListener("mousedown", dehors);
        window.addEventListener("resize", placer);
        window.addEventListener("scroll", placer, true);
        return () => {
            document.removeEventListener("mousedown", dehors);
            window.removeEventListener("resize", placer);
            window.removeEventListener("scroll", placer, true);
        };
    }, [ouvert, placer]);

    useEffect(() => {
        if (ouvert && actif >= 0) liste.current?.querySelector<HTMLElement>(`[data-i="${actif}"]`)?.scrollIntoView({ block: "nearest" });
    }, [ouvert, actif]);

    const clavier = (e: React.KeyboardEvent) => {
        if (!ouvert) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
            return;
        }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); setActif((a) => suivant(a, 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActif((a) => suivant(a, -1)); }
        else if (e.key === "Home") { e.preventDefault(); setActif(suivant(-1, 1)); }
        else if (e.key === "End") { e.preventDefault(); setActif(suivant(options.length, -1)); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisir(actif); }
        else if (e.key === "Tab") setOuvert(false);
        else if (e.key.length === 1) {
            const maintenant = Date.now();
            const f = frappe.current;
            f.texte = (maintenant - f.t > 700 ? "" : f.texte) + e.key.toLocaleLowerCase("fr-FR");
            f.t = maintenant;
            const i = options.findIndex((o) => !o.disabled && o.texte.toLocaleLowerCase("fr-FR").startsWith(f.texte));
            if (i >= 0) setActif(i);
        }
    };

    return (
        <>
            <button ref={bouton} type="button" id={id} disabled={disabled} title={title} style={style}
                aria-haspopup="listbox" aria-expanded={ouvert} aria-controls={ouvert ? idListe : undefined}
                aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]}
                onClick={() => (ouvert ? fermer() : ouvrir())} onKeyDown={clavier}
                className={`h-champ flex items-center gap-2 text-left ${className}`}>
                <span className="min-w-0 flex-1 truncate">{courant ? courant.label : ""}</span>
                <ChevronDown aria-hidden className={`size-5 shrink-0 transition-transform duration-150 ${ouvert ? "rotate-180" : ""}`}
                    strokeWidth={1.8} style={{ color: "var(--h-texte-2)" }} />
            </button>
            {name && <input type="hidden" name={name} value={valeur} required={required} />}
            {ouvert && place && createPortal(
                <ul ref={liste} id={idListe} role="listbox" aria-label={props["aria-label"]} className="h-liste"
                    style={{ left: place.left, top: place.top, bottom: place.bottom, minWidth: Math.max(place.width, 160), maxHeight: place.maxH }}
                    onMouseDown={(e) => e.preventDefault()}>
                    {options.map((o, i) => (
                        <Fragment key={`${o.value}-${i}`}>
                            {o.groupe && o.groupe !== options[i - 1]?.groupe && <li role="presentation" className="h-liste__groupe">{o.groupe}</li>}
                            <li role="option" data-i={i} aria-selected={i === indexCourant} aria-disabled={o.disabled || undefined}
                                data-actif={i === actif ? "true" : undefined} className="h-liste__option"
                                onMouseEnter={() => !o.disabled && setActif(i)}
                                onClick={(e) => { e.preventDefault(); choisir(i); }}>
                                <span className="min-w-0 flex-1">{o.label}</span>
                            </li>
                        </Fragment>
                    ))}
                </ul>,
                document.body,
            )}
        </>
    );
}

/* Date et heure de Hostinger (« h-date-picker », « h-calendar-panel », « h-time-picker »), qui
   remplacent ceux du navigateur (07/11/2026) en gardant le mode d'emploi du champ natif : valeur au
   format du navigateur (2026-11-07, 18:30 ou 2026-11-07T18:30), `min`, `max`, `required`, `step` en
   secondes (un créneau toutes les 15 min sinon) et `onChange` avec `e.target.value`. Le calendrier et
   la liste d'heures sont relevés dans leur feuille de style (classes `h-calendrier` et `h-creneau` de
   globals.css) ; avec l'heure, la liste de 160 px se met à droite du calendrier, dessous sur un
   téléphone. Le focus reste sur le champ, comme pour `SSelect` : flèches, Page précédente et suivante
   (un mois, un an avec Maj), Début et Fin de la semaine, Entrée, Échap, Tab ; dans les heures, haut,
   bas, Début, Fin, les chiffres de l'heure, et la flèche gauche pour revenir aux jours. */
const deux = (n: number) => String(n).padStart(2, "0");

/** AAAA-MM-JJ valide vers une date UTC, sinon null. */
function jourDe(k: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return cleJourUTC(d) === k ? d : null;
}

const decalerJour = (k: string, n: number) => {
    const d = jourDe(k)!;
    return cleJourUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n)));
};
const decalerMois = (k: string, n: number) => {
    const d = jourDe(k)!;
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
    return cleJourUTC(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate()))));
};
/** 0 pour le lundi. */
const rangSemaine = (k: string) => (jourDe(k)!.getUTCDay() + 6) % 7;
const aujourdhuiLocal = () => { const n = new Date(); return `${n.getFullYear()}-${deux(n.getMonth() + 1)}-${deux(n.getDate())}`; };
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const JOURS_COURTS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const FMT_MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const FMT_JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const FMT_JOUR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function SChoixTemps(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const { className = "", value, defaultValue, onChange, disabled, id, name, min, max, step, required, placeholder, style, title } = props;
    const genre = props.type as "date" | "time" | "datetime-local";
    const avecJour = genre !== "time", avecHeure = genre !== "date";
    const [interne, setInterne] = useState(defaultValue === undefined ? "" : String(defaultValue));
    const valeur = value === undefined || value === null ? interne : String(value);
    const date = avecJour && jourDe(valeur.slice(0, 10)) ? valeur.slice(0, 10) : "";
    const heure = avecHeure ? (/^\d{2}:\d{2}/.exec(avecJour ? valeur.slice(11) : valeur)?.[0] ?? "") : "";
    const minJ = typeof min === "string" && jourDe(min.slice(0, 10)) ? min.slice(0, 10) : "";
    const maxJ = typeof max === "string" && jourDe(max.slice(0, 10)) ? max.slice(0, 10) : "";
    const pas = Math.max(1, Math.round(Number(step) / 60)) || 15;
    const creneaux = useMemo(() => {
        const l: string[] = [];
        for (let m = 0; m < 1440; m += pas) l.push(`${deux(Math.floor(m / 60))}:${deux(m % 60)}`);
        // Une heure enregistrée hors de la grille (09:10) reste dans la liste, à sa place.
        if (heure && !l.includes(heure)) { l.push(heure); l.sort(); }
        return l;
    }, [pas, heure]);

    const [ouvert, setOuvert] = useState(false);
    const [place, setPlace] = useState<(Placement & { etroit: boolean }) | null>(null);
    const [vue, setVue] = useState("");
    const [actif, setActif] = useState("");
    const [actifH, setActifH] = useState(-1);
    const [zone, setZone] = useState<"jour" | "heure">("jour");
    // Date et heure : le jour choisi attend son heure quand le champ n'en a pas encore.
    const [enAttente, setEnAttente] = useState("");
    const [clavier, setClavier] = useState(false);
    const bouton = useRef<HTMLButtonElement>(null);
    const panneau = useRef<HTMLElement | null>(null);
    const liste = useRef<HTMLUListElement | null>(null);
    const centrer = useRef(false);
    const frappe = useRef({ texte: "", t: 0 });
    const idPanneau = useId();
    const jourChoisi = enAttente || date;
    const hors = (k: string) => (!!minJ && k < minJ) || (!!maxJ && k > maxJ);
    const borner = (k: string) => (minJ && k < minJ ? minJ : maxJ && k > maxJ ? maxJ : k);

    const placer = useCallback(() => {
        const el = bouton.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const etroit = window.innerWidth < 520;
        const width = Math.min(genre === "time" ? 200 : genre === "date" || etroit ? 296 : 468, window.innerWidth - 24);
        const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
        const bas = window.innerHeight - r.bottom - 12;
        const haut = r.top - 12;
        const voulue = genre === "time" ? 300 : genre === "date" || !etroit ? 380 : 580;
        const versHaut = bas < voulue && haut > bas;
        const maxH = Math.max(160, versHaut ? haut : bas);
        setPlace(versHaut
            ? { left, width, maxH, etroit, bottom: window.innerHeight - r.top + 4 }
            : { left, width, maxH, etroit, top: r.bottom + 4 });
    }, [genre]);

    const ouvrir = (parClavier: boolean) => {
        if (disabled) return;
        const depart = jourChoisi || borner(aujourdhuiLocal());
        setVue(`${depart.slice(0, 8)}01`);
        setActif(depart);
        setZone(avecJour ? "jour" : "heure");
        setEnAttente("");
        setClavier(parClavier);
        // Sans heure, la liste s'ouvre sur l'heure qu'il est.
        const n = new Date();
        const ici = heure || `${deux(n.getHours())}:${deux(n.getMinutes())}`;
        const i = creneaux.findIndex((c) => c >= ici);
        setActifH(heure ? creneaux.indexOf(heure) : i < 0 ? creneaux.length - 1 : i);
        centrer.current = true;
        placer();
        setOuvert(true);
        // Safari ne donne pas le focus à un bouton cliqué : sans lui, Échap et les flèches n'arriveraient pas.
        bouton.current?.focus();
    };
    const fermer = () => {
        setOuvert(false);
        bouton.current?.focus();
    };
    const emettre = (v: string) => {
        if (value === undefined) setInterne(v);
        if (v !== valeur && onChange) {
            const cible = { value: v, name: name ?? "", id: id ?? "" };
            onChange({ target: cible, currentTarget: cible } as unknown as React.ChangeEvent<HTMLInputElement>);
        }
    };
    const choisirJour = (k: string) => {
        if (hors(k)) return;
        setActif(k);
        if (k.slice(0, 7) !== vue.slice(0, 7)) setVue(`${k.slice(0, 8)}01`);
        if (!avecHeure) { fermer(); emettre(k); return; }
        if (heure) emettre(`${k}T${heure}`); else setEnAttente(k);
        setZone("heure");
    };
    const choisirHeure = (h: string) => {
        const k = enAttente || date || borner(aujourdhuiLocal());
        fermer();
        emettre(avecJour ? `${k}T${h}` : h);
    };
    const changerMois = (n: number) => {
        setVue((v) => decalerMois(v, n));
        setActif((a) => decalerMois(a, n));
    };

    useEffect(() => {
        if (!ouvert) return;
        const dehors = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!bouton.current?.contains(t) && !panneau.current?.contains(t)) setOuvert(false);
        };
        document.addEventListener("mousedown", dehors);
        window.addEventListener("resize", placer);
        window.addEventListener("scroll", placer, true);
        return () => {
            document.removeEventListener("mousedown", dehors);
            window.removeEventListener("resize", placer);
            window.removeEventListener("scroll", placer, true);
        };
    }, [ouvert, placer]);

    // À l'ouverture, l'heure choisie au milieu de la liste ; ensuite, la ligne suivie au clavier reste visible.
    useLayoutEffect(() => {
        if (!ouvert) return;
        const l = liste.current;
        const el = l?.querySelector<HTMLElement>(`[data-h="${actifH}"]`);
        if (!l || !el) return;
        if (centrer.current) {
            l.scrollTop = el.offsetTop - (l.clientHeight - el.offsetHeight) / 2;
            centrer.current = false;
        } else if (clavier) el.scrollIntoView({ block: "nearest" });
    }, [ouvert, actifH, clavier, place]);

    const toucheJour = (e: React.KeyboardEvent) => {
        const ecart: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        let k = "";
        if (e.key in ecart) k = decalerJour(actif, ecart[e.key]);
        else if (e.key === "PageUp" || e.key === "PageDown") k = decalerMois(actif, (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1));
        else if (e.key === "Home") k = decalerJour(actif, -rangSemaine(actif));
        else if (e.key === "End") k = decalerJour(actif, 6 - rangSemaine(actif));
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisirJour(actif); return; }
        if (!k) return;
        e.preventDefault();
        setActif(k);
        setVue(`${k.slice(0, 8)}01`);
    };
    const toucheHeure = (e: React.KeyboardEvent) => {
        const der = creneaux.length - 1;
        if (e.key === "ArrowDown") { e.preventDefault(); setActifH((i) => Math.min(der, i + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActifH((i) => Math.max(0, i - 1)); }
        else if (e.key === "Home") { e.preventDefault(); setActifH(0); }
        else if (e.key === "End") { e.preventDefault(); setActifH(der); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (creneaux[actifH]) choisirHeure(creneaux[actifH]); }
        else if (e.key === "ArrowLeft" && avecJour) { e.preventDefault(); setZone("jour"); }
        else if (/^[0-9]$/.test(e.key)) {
            // « 18 » mène à 18:00, « 183 » à 18:30, « 9 » à 09:00.
            const t = Date.now();
            const f = frappe.current;
            f.texte = (t - f.t > 900 ? "" : f.texte) + e.key;
            f.t = t;
            const i = creneaux.findIndex((c) => { const s = c.replace(":", ""); return s.startsWith(f.texte) || s.startsWith(`0${f.texte}`); });
            if (i >= 0) setActifH(i);
        }
    };
    const clavierChamp = (e: React.KeyboardEvent) => {
        if (!ouvert) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(true); }
            return;
        }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); return; }
        if (e.key === "Tab") { setOuvert(false); return; }
        setClavier(true);
        if (zone === "jour") toucheJour(e); else toucheHeure(e);
    };

    const Icone = avecJour ? CalendarClock : Clock;
    const texte = !avecJour ? heure
        : date && (!avecHeure || heure) ? `${FMT_JOUR.format(jourDe(date)!)}${avecHeure ? ` à ${heure}` : ""}` : "";
    const auj = ouvert ? aujourdhuiLocal() : "";
    const jours = useMemo(() => {
        const d0 = jourDe(vue);
        if (!d0) return [];
        const y = d0.getUTCFullYear(), m = d0.getUTCMonth();
        const decalage = (d0.getUTCDay() + 6) % 7;
        const nb = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        return Array.from({ length: Math.ceil((decalage + nb) / 7) * 7 }, (_, i) => cleJourUTC(new Date(Date.UTC(y, m, 1 - decalage + i))));
    }, [vue]);

    const listeHeures = (cls: string) => (
        <ul ref={(n) => { liste.current = n; if (!avecJour) panneau.current = n; }} role="listbox" aria-label="Heures" className={cls}
            {...(!avecJour && place ? {
                id: idPanneau,
                style: { left: place.left, top: place.top, bottom: place.bottom, width: place.width, maxHeight: Math.min(300, place.maxH) },
                onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
            } : {})}>
            {creneaux.map((c, i) => (
                <li key={c} role="option" data-h={i} aria-selected={c === heure}
                    data-actif={(clavier && zone === "heure" && i === actifH) || undefined}
                    className="h-creneau" onClick={() => choisirHeure(c)}>
                    {c}
                </li>
            ))}
        </ul>
    );

    const calendrier = (
        <div>
            <div className="h-calendrier__tete">
                <span className="h-calendrier__titre">{vue && majuscule(FMT_MOIS.format(jourDe(vue)!))}</span>
                <span className="flex items-center gap-1">
                    <button type="button" tabIndex={-1} aria-label="Mois précédent" className="h-calendrier__nav" onClick={() => changerMois(-1)}>
                        <ChevronLeft className="size-4" strokeWidth={1.8} />
                    </button>
                    <button type="button" tabIndex={-1} aria-label="Mois suivant" className="h-calendrier__nav" onClick={() => changerMois(1)}>
                        <ChevronRight className="size-4" strokeWidth={1.8} />
                    </button>
                </span>
            </div>
            <div className="h-calendrier__grille">
                {JOURS_COURTS.map((j) => <span key={j} aria-hidden className="h-calendrier__semaine">{j}</span>)}
                {jours.map((k) => (
                    <button key={k} type="button" tabIndex={-1} className="h-calendrier__jour" disabled={hors(k)}
                        aria-label={majuscule(FMT_JOUR_LONG.format(jourDe(k)!))} aria-pressed={k === jourChoisi}
                        data-voisin={k.slice(0, 7) !== vue.slice(0, 7) || undefined}
                        data-auj={k === auj || undefined}
                        data-actif={(clavier && zone === "jour" && k === actif) || undefined}
                        onClick={() => choisirJour(k)}>
                        {Number(k.slice(8))}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <>
            <button ref={bouton} type="button" id={id} disabled={disabled} title={title} style={style}
                aria-haspopup={avecJour ? "dialog" : "listbox"} aria-expanded={ouvert} aria-controls={ouvert ? idPanneau : undefined}
                aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]}
                onClick={() => (ouvert ? fermer() : ouvrir(false))} onKeyDown={clavierChamp}
                className={`h-champ flex items-center gap-2 text-left ${className}`}>
                <span className="min-w-0 flex-1 truncate tabular-nums" style={texte ? undefined : { color: "var(--h-texte-2)" }}>
                    {texte || placeholder || (avecJour ? "Aucune date" : "Aucune heure")}
                </span>
                <Icone aria-hidden className="size-5 shrink-0" strokeWidth={1.8} style={{ color: "var(--h-texte-2)" }} />
            </button>
            {name && <input type="hidden" name={name} value={valeur} required={required} />}
            {ouvert && place && createPortal(
                !avecJour ? listeHeures("h-liste h-creneaux") : (
                    <div ref={(n) => { panneau.current = n; }} id={idPanneau} role="dialog" aria-label={avecHeure ? "Date et heure" : "Calendrier"}
                        className="h-liste" onMouseDown={(e) => e.preventDefault()}
                        style={{ left: place.left, top: place.top, bottom: place.bottom, width: place.width, maxHeight: place.maxH, padding: 16 }}>
                        {!avecHeure ? calendrier : (
                            <div className={place.etroit ? "flex flex-col gap-3" : "relative pr-[172px]"}>
                                {calendrier}
                                <div className={place.etroit ? "h-[184px]" : "absolute inset-y-0 right-0 w-[160px]"}
                                    style={{ borderRadius: 12, boxShadow: "inset 0 0 0 1px var(--h-filet)", overflow: "hidden" }}>
                                    {listeHeures("h-creneaux relative h-full")}
                                </div>
                            </div>
                        )}
                        {!required && valeur && (
                            <div className="flex justify-end pt-4">
                                <button type="button" tabIndex={-1} className="hb hb--texte hb--petit" onClick={() => { fermer(); emettre(""); }}>
                                    Effacer
                                </button>
                            </div>
                        )}
                    </div>
                ),
                document.body,
            )}
        </>
    );
}

/** Interrupteur de Hostinger (« h-switch ») : piste de 37 × 22, pastille blanche de 18 px, orange
 *  allumé. Une zone invisible de 12 px tout autour le rend facile à toucher au doigt. */
export function SSwitch({ checked, onChange, label, hint, disabled }: {
    checked: boolean; onChange: (v: boolean) => void;
    label?: React.ReactNode; hint?: React.ReactNode; disabled?: boolean;
}) {
    return (
        <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
            <button type="button" role="switch" aria-checked={checked} disabled={disabled}
                onClick={() => onChange(!checked)}
                className="relative h-[22px] w-[37px] shrink-0 rounded-full transition-colors duration-150 before:absolute before:-inset-3 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]"
                style={{ background: checked ? "rgb(var(--h-marque))" : "var(--h-surface-forte)" }}>
                <span className="absolute left-[2px] top-[2px] size-[18px] rounded-full transition-transform duration-[180ms]"
                    style={{ background: "#fff", boxShadow: "0 1px 2px rgb(0 0 0 / 0.2)", transform: `translateX(${checked ? 15 : 0}px)` }} />
            </button>
            {(label || hint) && (
                <span className="min-w-0">
                    {label && <span className="block text-[14px] font-medium leading-5" style={{ color: encre(0.95) }}>{label}</span>}
                    {hint && <span className="mt-0.5 block text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{hint}</span>}
                </span>
            )}
        </label>
    );
}

/** Case à cocher de Hostinger (« h-checkbox ») : 20 px, coins de 4, cochée à l'orange. */
export function SCheckbox({ checked, onChange, label }: {
    checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-case" />
            {label && <span className="text-[14px] leading-5" style={{ color: encre(0.9) }}>{label}</span>}
        </label>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   ONGLETS  —  VTabs (variante « pilule » du template)
   ══════════════════════════════════════════════════════════════════════════ */

export function STabs<T extends string>({ tabs, value, onChange, variant = "pilule" }: {
    tabs: { id: T; label: React.ReactNode; badge?: React.ReactNode }[];
    value: T; onChange: (v: T) => void;
    /** pilule : fond gris sous l'onglet actif ; souligne : trait de 4 px sous l'onglet actif, glissant. */
    variant?: "pilule" | "souligne";
}) {
    if (variant === "souligne") return <STabsSoulignes tabs={tabs} value={value} onChange={onChange} />;
    // « Segmented control » de Hostinger : fond de surface en pilule (coins de 32, 2 px de marge),
    // segment actif blanc avec une ombre légère, les autres en gris ; 14/600, 8 × 16 px.
    return (
        <div className="max-w-full overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div role="tablist" className="inline-flex gap-0.5 rounded-[32px] p-0.5" style={{ background: "var(--h-surface)" }}>
                {tabs.map((t) => {
                    const on = t.id === value;
                    return (
                        <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.id)}
                            className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[32px] px-4 text-[14px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${on ? "" : "text-[color:var(--h-texte-2)] hover:text-[rgb(var(--sn-on))]"}`}
                            style={on ? { background: "#fff", color: "#101011", boxShadow: "var(--h-ombre-1), inset 0 0 0 1px var(--h-filet-doux)" } : undefined}>
                            {t.label}
                            {t.badge !== undefined && t.badge !== null && (
                                <span className="rounded-[8px] px-1.5 text-[12px] font-medium leading-4 tabular-nums"
                                    style={on ? { background: "rgb(0 0 0 / 0.06)", color: "#58585e" } : { background: "var(--h-surface)" }}>
                                    {t.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Onglets soulignés de Hostinger (« h-tabs ») : 48 px, 16/500, gris ; l'actif à l'orange avec un
 *  trait de 2 px qui glisse sous son texte ; pilule grise au survol ; filet sous toute la rangée. */
function STabsSoulignes<T extends string>({ tabs, value, onChange }: {
    tabs: { id: T; label: React.ReactNode; badge?: React.ReactNode }[];
    value: T; onChange: (v: T) => void;
}) {
    const boite = useRef<HTMLDivElement>(null);
    const [trait, setTrait] = useState<{ left: number; width: number } | null>(null);
    useLayoutEffect(() => {
        const el = boite.current?.querySelector<HTMLElement>(`[data-onglet="${value}"] [data-corps]`);
        const tab = boite.current?.querySelector<HTMLElement>(`[data-onglet="${value}"]`);
        if (el && tab) setTrait({ left: tab.offsetLeft + el.offsetLeft, width: el.offsetWidth });
    }, [value, tabs.length]);
    return (
        <div ref={boite} role="tablist" className="relative flex overflow-x-auto border-b" style={{ scrollbarWidth: "none", borderColor: "var(--h-filet)" }}>
            {tabs.map((t) => {
                const on = t.id === value;
                return (
                    <button key={t.id} type="button" role="tab" aria-selected={on} data-onglet={t.id} onClick={() => onChange(t.id)}
                        className="group relative flex h-12 shrink-0 items-center whitespace-nowrap px-4 text-[16px] font-medium leading-6 focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))]"
                        style={{ color: on ? "rgb(var(--h-marque-texte))" : "var(--h-texte-2)" }}>
                        <span aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 h-8 -translate-y-1/2 rounded-[16px] transition-colors group-hover:bg-[color:var(--h-surface)]" />
                        <span data-corps className={`relative flex items-center gap-2 ${on ? "" : "group-hover:text-[rgb(var(--sn-on))]"}`}>
                            {t.label}
                            {t.badge !== undefined && t.badge !== null && (
                                <span className="rounded-[8px] px-1.5 text-[12px] font-medium leading-4 tabular-nums" style={{ background: "var(--h-surface)", color: "var(--h-texte-2)" }}>{t.badge}</span>
                            )}
                        </span>
                    </button>
                );
            })}
            {trait && (
                <span aria-hidden className="pointer-events-none absolute bottom-0 h-[2px] rounded-full transition-[left,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                    style={{ left: trait.left, width: trait.width, background: "rgb(var(--h-marque-texte))" }} />
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHARGEMENT  —  le rond qui tourne et les blocs qui pulsent de Beacons
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Rond de chargement de Beacons (relevé le 20/10/2026) : 24 px, anneau fin à
 * l'encre dont la queue s'efface, un tour par seconde. Dessiné ici par un
 * dégradé conique masqué en anneau.
 */
export function SChargement({ taille = 24, className = "" }: { taille?: number; className?: string }) {
    const epaisseur = Math.max(1.5, taille / 16);
    return (
        <span role="status" aria-label="Chargement" className={`inline-block shrink-0 animate-spin rounded-full motion-reduce:animate-none ${className}`}
            style={{
                width: taille, height: taille,
                background: "conic-gradient(from 90deg, rgb(var(--sn-on) / 0) 0deg, rgb(var(--sn-on) / 0.5) 180deg, rgb(var(--sn-on)) 360deg)",
                WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${epaisseur}px), #000 calc(100% - ${epaisseur}px))`,
                mask: `radial-gradient(farthest-side, transparent calc(100% - ${epaisseur}px), #000 calc(100% - ${epaisseur}px))`,
            }} />
    );
}

/** Bloc qui pulse (squelette de Beacons) : gris #eeeeee, coins de 8, 2 s par battement. */
export function SSquelette({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return <div aria-hidden className={`animate-pulse rounded-[8px] ${className}`} style={{ background: "var(--h-surface)", ...style }} />;
}

/** Carte de chiffre en chargement : libellé et valeur remplacés par deux blocs. */
export function SStatSquelette() {
    return (
        <div className="sn-card p-5" style={{ borderRadius: 16 }}>
            <SSquelette className="h-5 w-28 max-w-full" />
            <SSquelette className="mt-2 h-8 w-40 max-w-full" />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   RETOURS  —  VAlert / VProgressLinear / état vide
   ══════════════════════════════════════════════════════════════════════════ */

/** Message de Hostinger : coins de 16, 16 px de marge, texte à l'encre sur une teinte du ton
 *  (neutre pour une information), icône du ton. */
const ALERTE: Record<Ton, { fond: string; icone: string }> = {
    success: { fond: "rgb(var(--h-succes-teinte) / var(--h-teinte))", icone: "rgb(var(--h-succes-texte))" },
    warning: { fond: "rgb(var(--h-alerte-teinte) / 0.15)", icone: "rgb(var(--h-alerte-texte))" },
    error: { fond: "rgb(var(--h-danger-teinte) / var(--h-teinte))", icone: "rgb(var(--h-danger-texte))" },
    info: { fond: "var(--h-surface)", icone: encre(0.75) },
    primary: { fond: "var(--h-surface)", icone: encre(0.75) },
    secondary: { fond: "var(--h-surface)", icone: encre(0.75) },
};

export function SAlert({ children, tone = "info", Icon, action }: {
    children: React.ReactNode; tone?: Ton; Icon?: any; action?: React.ReactNode;
}) {
    const a = ALERTE[tone];
    return (
        <div className="flex items-start gap-3 rounded-[16px] p-4 text-[14px] leading-5" style={{ background: a.fond, color: encre(0.9) }}>
            {Icon && <Icon className="size-5 shrink-0" strokeWidth={1.8} style={{ color: a.icone }} />}
            <span className="min-w-0 flex-1">{children}</span>
            {action}
        </div>
    );
}

export function SProgress({ value, tone = "primary" }: { value: number; tone?: Ton }) {
    return (
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--h-surface)" }}>
            <div className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone === "primary" ? "rgb(var(--h-marque))" : rgb(tone) }} />
        </div>
    );
}

export function SEmpty({ Icon, title, hint, action }: {
    Icon?: any; title: string; hint?: string; action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center px-6 py-16 text-center">
            {Icon && (
                <span className="mb-6 grid h-14 w-14 place-items-center rounded-[16px]"
                    style={{ background: "var(--h-surface)", color: encre(0.9) }}>
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
            )}
            <p className="text-[20px] font-semibold leading-7" style={{ color: encre(0.95) }}>{title}</p>
            {hint && <p className="mt-3 max-w-[480px] text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{hint}</p>}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHIFFRES  —  CardStatisticsVertical / CardStatisticsHorizontal
   ══════════════════════════════════════════════════════════════════════════ */

/** Chiffre clé (`CardStatisticsVertical` à l'origine), à la manière de Beacons. */
/**
 * Valeur d'une carte de chiffre (28 px). Si elle ne tient pas dans sa carte (montant long, carte
 * étroite sur téléphone ou à côté de l'assistant), elle rapetisse jusqu'à 16 px au lieu d'être
 * coupée : un montant ne se lit jamais à moitié.
 */
function ChiffreAjuste({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLParagraphElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ajuster = () => {
            el.style.fontSize = "";
            let taille = 24;
            while (el.scrollWidth > el.clientWidth + 0.5 && taille > 16) {
                taille -= 1;
                el.style.fontSize = `${taille}px`;
            }
        };
        ajuster();
        const ro = new ResizeObserver(ajuster);
        ro.observe(el);
        // La police de l'interface arrive après le premier affichage, plus large que celle de secours :
        // on remesure quand elle est là.
        let actif = true;
        document.fonts?.ready.then(() => { if (actif) ajuster(); }).catch(() => { });
        return () => { actif = false; ro.disconnect(); };
    }, [children]);
    return <p ref={ref} className="mt-1 truncate text-[24px] font-semibold leading-8 tabular-nums" style={{ color: encre(0.95) }}>{children}</p>;
}

export function SStatVertical({ title, value, Icon, tone = "primary", change, hint, href, onClick }: {
    title: string; value: React.ReactNode; Icon?: any; tone?: Ton;
    change?: number | null; hint?: React.ReactNode; href?: string; onClick?: () => void;
}) {
    // Chiffre de Hostinger (« h-metric ») dans une carte à coins de 16 : libellé 14/500 gris,
    // valeur 24/600, variation en vert ou en rouge, sans pastille d'icône ni ombre.
    void Icon; void tone;
    const positif = (change ?? 0) >= 0;
    const inner = (
        <div className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-medium leading-5" style={{ color: "var(--h-texte-2)" }}>{title}</p>
                {(href || onClick) && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--h-texte-2)" }} />}
            </div>
            <ChiffreAjuste>{value}</ChiffreAjuste>
            {typeof change === "number" ? (
                <p className="mt-1 text-[14px] font-medium leading-5" style={{ color: positif ? "rgb(var(--h-succes-texte))" : "rgb(var(--h-danger-texte))" }}>
                    {positif ? "↑" : "↓"} {Math.abs(change)}%
                </p>
            ) : hint ? (
                <div className="mt-1 text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{hint}</div>
            ) : null}
        </div>
    );
    const cls = "sn-card text-left transition-shadow hover:shadow-[var(--h-ombre-1)]";
    if (href) return <Link href={href} className={cls} style={{ borderRadius: 16 }}>{inner}</Link>;
    if (onClick) return <button type="button" onClick={onClick} className={cls} style={{ borderRadius: 16 }}>{inner}</button>;
    return <div className="sn-card" style={{ borderRadius: 16 }}>{inner}</div>;
}

/** Chiffre en ligne : tuile grise à gauche, libellé et valeur à droite. */
export function SStatHorizontal({ title, value, Icon, tone = "primary", change }: {
    title: string; value: React.ReactNode; Icon?: any; tone?: Ton; change?: number | null;
}) {
    const positif = (change ?? 0) >= 0;
    return (
        <div className="sn-card flex items-center gap-4 p-5" style={{ borderRadius: 16 }}>
            <SAvatar Icon={Icon} tone={tone} size={44} />
            <div className="min-w-0">
                <span className="block truncate text-[14px] font-medium leading-5" style={{ color: "var(--h-texte-2)" }}>{title}</span>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[20px] font-semibold leading-7 tabular-nums" style={{ color: encre(0.95) }}>{value}</span>
                    {typeof change === "number" && (
                        <span className="text-[14px] font-medium"
                            style={{ color: positif ? "rgb(var(--h-succes-texte))" : "rgb(var(--h-danger-texte))" }}>
                            {positif ? "↑" : "↓"} {Math.abs(change)}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   MOTIFS DE PAGE DE BEACONS (relevés le 20/10/2026)
   ══════════════════════════════════════════════════════════════════════════ */

/** Titre de section des pages de Beacons (« Payout history », « Traffic overview ») : 18/600. */
export function STitreSection({ children, action, className = "" }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
    return (
        <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
            <h2 className="text-[18px] leading-5" style={{ color: encre(0.95), fontWeight: 600 }}>{children}</h2>
            {action}
        </div>
    );
}

/** Champ de recherche des tableaux de Beacons : 40 px, loupe à gauche, texte 16. */
export function SRecherche({ value, onChange, placeholder, label, className = "" }: {
    value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string;
}) {
    return (
        <div className={`relative ${className}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] size-5 -translate-y-1/2" strokeWidth={1.8} style={{ color: "var(--h-texte-2)" }} />
            <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder}
                className="h-champ h-champ--moyen pl-10" />
        </div>
    );
}

/** Bande de chiffres de Beacons (« Traffic overview ») : une seule carte, les
 *  chiffres côte à côte séparés par un filet ; libellé 14/600, valeur 28/500. */
export function SChiffresBande({ items }: { items: { titre: string; valeur: React.ReactNode; detail?: React.ReactNode; href?: string }[] }) {
    return (
        <div className="sn-card grid grid-cols-2 overflow-hidden sm:flex">
            {items.map((it, i) => {
                const contenu = (
                    <>
                        <p className="text-[14px] font-medium leading-5" style={{ color: "var(--h-texte-2)" }}>{it.titre}</p>
                        <ChiffreAjuste>{it.valeur}</ChiffreAjuste>
                        {it.detail && <div className="mt-1 text-[14px] leading-5" style={{ color: "var(--h-texte-2)" }}>{it.detail}</div>}
                    </>
                );
                // Sur téléphone, deux par ligne ; un dernier chiffre seul prend toute la ligne.
                const seul = i === items.length - 1 && items.length % 2 === 1 ? "col-span-2" : "";
                const cls = `min-w-0 flex-1 p-5 ${seul} ${i > 0 ? "sm:border-l" : ""} ${i % 2 === 1 ? "border-l sm:border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""}`;
                const st = { borderColor: "var(--h-filet)" };
                return it.href
                    ? <Link key={it.titre} href={it.href} className={`${cls} hover:bg-[color:var(--h-filet-doux)]`} style={st}>{contenu}</Link>
                    : <div key={it.titre} className={cls} style={st}>{contenu}</div>;
            })}
        </div>
    );
}

/** Tableau vide de Beacons (« Your orders will show here. ») : la phrase, puis
 *  des rangées grises immobiles qui dessinent le tableau à venir. */
export function SVideTableau({ titre, texte, action, colonnes = 5 }: {
    titre: string; texte?: string; action?: React.ReactNode; colonnes?: number;
}) {
    const largeurs = ["w-40", "w-28", "w-24", "w-16", "w-20", "w-24"];
    return (
        <div className="px-6 pb-6 pt-8">
            <div className="text-center">
                <p className="text-[16px] font-semibold" style={{ color: encre(0.95) }}>{titre}</p>
                {texte && <p className="mx-auto mt-1 max-w-[480px] text-[14px] leading-[1.4]" style={{ color: encre(0.6) }}>{texte}</p>}
                {action && <div className="mt-4 flex justify-center">{action}</div>}
            </div>
            <div aria-hidden className="mt-8">
                <div className="mb-3 h-3 w-16 rounded-full" style={{ background: encre(0.06) }} />
                {[0, 1, 2].map((r) => (
                    <div key={r} className="flex items-center gap-8 border-t py-4" style={{ borderColor: encre(0.06) }}>
                        <span className="size-6 shrink-0 rounded-full" style={{ background: encre(0.06) }} />
                        {Array.from({ length: Math.max(2, colonnes - 1) }, (_, c) => (
                            <span key={c} className={`h-3 rounded-full ${largeurs[c % largeurs.length]} ${c > 1 ? "hidden sm:block" : ""}`} style={{ background: encre(0.06) }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Présentation d'une rubrique encore vide (Beacons : « Turn your favorite
 *  brands into earnings ») : tuile bleue de 64 px, titre 36/700, texte 18
 *  gris, bouton bleu de 44 px. */
export function SIntro({ Icon, titre, texte, action, children }: {
    Icon: any; titre: React.ReactNode; texte?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode;
}) {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-2 py-10 text-center">
            <span className="grid size-16 place-items-center rounded-[16px]" style={{ background: "rgb(var(--h-marque-teinte) / var(--h-teinte))", color: "rgb(var(--h-marque-texte))" }}>
                <Icon className="size-7" strokeWidth={1.8} />
            </span>
            <h1 className="mt-6 max-w-[520px] text-[28px] leading-9 md:text-[32px] md:leading-10" style={{ color: encre(0.95), fontWeight: 400 }}>{titre}</h1>
            {texte && <p className="mb-6 mt-3 max-w-[720px] text-[16px] leading-6" style={{ color: "var(--h-texte-2)" }}>{texte}</p>}
            {action}
            {children && <div className="mt-12 w-full">{children}</div>}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   GRAPHIQUES  —  équivalents SVG des cartes ApexCharts du template
   ══════════════════════════════════════════════════════════════════════════ */

/** Barres de `AnalyticsTotalRevenue`, en SVG (aucune dépendance ajoutée). */
export function SBars({ data, tone = "primary", height = 180, format, fill }: {
    data: { label: string; value: number }[]; tone?: Ton; height?: number;
    format?: (v: number) => string;
    /** Occupe toute la hauteur disponible plutôt qu'une hauteur fixe. */
    fill?: boolean;
}) {
    const max = Math.max(1, ...data.map((d) => d.value));
    // Au-delà de 15 barres les libellés se chevauchent : on n'en garde qu'un
    // sur N, comme le fait l'axe des abscisses du template.
    const pas = Math.ceil(data.length / 12);
    const espace = data.length > 20 ? 2 : data.length > 12 ? 4 : 8;
    return (
        <div className={fill ? "flex h-full flex-col" : ""}>
            <div className={`flex items-end ${fill ? "min-h-0 flex-1" : ""}`}
                style={{ gap: espace, height: fill ? undefined : height }}>
                {data.map((d, i) => (
                    <div key={i} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        style={{ height: "100%" }}
                        title={format ? `${d.label} : ${format(d.value)}` : `${d.label} : ${d.value}`}>
                        <span className="text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                            style={{ color: encre(0.7) }}>
                            {format ? format(d.value) : d.value}
                        </span>
                        <span className="w-full rounded-[6px] transition-[filter]"
                            style={{
                                height: `${Math.max(2, (d.value / max) * 100)}%`,
                                background: d.value ? rgb(tone) : encre(0.08),
                            }} />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex" style={{ gap: espace }}>
                {data.map((d, i) => (
                    <span key={i} className="min-w-0 flex-1 truncate text-center text-[12px]" style={{ color: encre(0.5) }}>
                        {i % pas === 0 ? d.label : ""}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Anneau de `AnalyticsOrderStatistics` : trous de 75 %, segments séparés. */
export function SDonut({ parts, size = 130, centerLabel, centerValue }: {
    parts: { value: number; tone: Ton }[]; size?: number;
    centerLabel?: string; centerValue?: React.ReactNode;
}) {
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    const r = size / 2 - 8;
    const C = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={encre(0.06)} strokeWidth={13} />
                {parts.map((p, i) => {
                    const len = (p.value / total) * C;
                    const el = (
                        <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                            stroke={rgb(p.tone)} strokeWidth={13} strokeLinecap="butt"
                            strokeDasharray={`${Math.max(0, len - 4)} ${C - Math.max(0, len - 4)}`}
                            strokeDashoffset={-offset} />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {centerValue !== undefined && (
                    <span className="text-[18px] font-medium leading-none" style={{ color: encre(0.9) }}>{centerValue}</span>
                )}
                {centerLabel && <span className="mt-1 text-[12px]" style={{ color: encre(0.6) }}>{centerLabel}</span>}
            </div>
        </div>
    );
}

/** Courbe lissée de `AnalyticsProfitReport`, avec le point de fin marqué. */
export function SSpark({ data, tone = "primary", width = 220, height = 70 }: {
    data: number[]; tone?: Ton; width?: number; height?: number;
}) {
    if (data.length < 2) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => [
        (i / (data.length - 1)) * (width - 8) + 4,
        height - 6 - ((v - min) / span) * (height - 16),
    ] as [number, number]);
    // Courbe de Catmull-Rom convertie en Bézier : le tracé « smooth » d'Apex.
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C ${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6}`
            + ` ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    const fin = pts[pts.length - 1];
    return (
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
            <path d={d} fill="none" stroke={rgb(tone)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={fin[0]} cy={fin[1]} r={4.5} fill="#fff" stroke={rgb(tone)} strokeWidth={3} />
        </svg>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CALENDRIER  —  absent de la version libre du template (module Pro).
   Écrit ici avec les primitives de Sneat : carte, avatar teinté, pastille.
   ══════════════════════════════════════════════════════════════════════════ */

/** Clé de jour AAAA-MM-JJ en UTC (heure murale du projet, voir bookings.ts). */
export const cleJourUTC = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export type JourCalendrier = {
    /** Nombre d'évènements ce jour-là : dicte la pastille. */
    n?: number;
    /** Journée fermée : grisée, non proposée. */
    ferme?: boolean;
};

/**
 * Grille mensuelle, semaine commençant le LUNDI. Tout est calculé en UTC.
 * `aujourdHui` est passé par l'appelant (calculé après montage) : un
 * `new Date()` au rendu serveur ferait diverger l'hydratation à minuit.
 */
export function SCalendar({ mois, jours, selection, aujourdHui, onSelect, onMois }: {
    mois: Date;
    jours: Record<string, JourCalendrier>;
    selection: string | null;
    aujourdHui: string;
    onSelect: (k: string | null) => void;
    onMois: (delta: number) => void;
}) {
    // Allure du 07/10/2026, sur le modèle du calendrier de réservation de la vitrine : mois en gras et année à côté,
    // jours de la semaine en trois lettres, jours ouverts en gras sur une pastille ronde, jours fermés pâles.
    const y = mois.getUTCFullYear(), m = mois.getUTCMonth();
    const decalage = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
    const nb = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cases: (Date | null)[] = [
        ...Array(decalage).fill(null),
        ...Array.from({ length: nb }, (_, i) => new Date(Date.UTC(y, m, i + 1))),
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <div className="flex shrink-0 items-baseline gap-1.5">
                    <p className="whitespace-nowrap text-[16px] font-bold capitalize leading-6 tracking-[-0.02em]" style={{ color: encre(0.9) }}>
                        {new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(mois)}
                    </p>
                    <span className="shrink-0 text-[14px] font-medium tabular-nums" style={{ color: encre(0.5) }}>{y}</span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                    <SIconBtn label="Mois précédent" onClick={() => onMois(-1)}>
                        <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
                    </SIconBtn>
                    <button type="button" onClick={() => onMois(0)}
                        className="h-8 rounded-full px-3 text-[12.5px] font-bold transition-colors hover:bg-[rgb(var(--sn-on)/0.06)]"
                        style={{ color: encre(0.7) }}>
                        Aujourd&apos;hui
                    </button>
                    <SIconBtn label="Mois suivant" onClick={() => onMois(1)}>
                        <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                    </SIconBtn>
                </div>
            </div>

            <div className="grid grid-cols-7 pb-3 pt-5">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => (
                    <span key={j} className="text-center text-[12px] font-bold uppercase leading-4" style={{ color: encre(0.9) }}>{j}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-x-1 gap-y-1.5">
                {cases.map((d, i) => {
                    if (!d) return <span key={`v${i}`} aria-hidden="true" />;
                    const k = cleJourUTC(d);
                    const info = jours[k] || {};
                    const n = info.n || 0;
                    const auj = k === aujourdHui;
                    const choisi = selection === k;
                    const ouvert = !info.ferme;
                    const rond = choisi || auj || ouvert;
                    return (
                        <button key={k} type="button" onClick={() => onSelect(choisi ? null : k)} aria-pressed={choisi}
                            aria-label={`${d.getUTCDate()}, ${n} rendez-vous${ouvert ? "" : ", fermé"}`}
                            className={`relative flex items-center justify-center px-0.5 py-2.5 text-center text-[14px] leading-5 tabular-nums transition-[box-shadow] hover:shadow-[0_0_0_1px_rgb(var(--sn-on)/0.18)] ${rond ? "rounded-full font-bold" : "rounded-[8px] font-medium"}`}
                            style={
                                choisi ? { background: "rgb(var(--h-marque))", color: "#fff" }
                                    : auj ? { background: "rgb(var(--h-marque-teinte) / var(--h-teinte))", color: "rgb(var(--h-marque-texte))" }
                                        : ouvert ? { background: "var(--h-surface)", color: encre(0.9) }
                                            : { color: encre(0.3) }
                            }>
                            {d.getUTCDate()}
                            {n > 0 && (
                                <span className="absolute bottom-1 h-1 w-1 rounded-full"
                                    style={{ background: choisi ? "#fff" : rgb("primary") }} />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4 text-[12.5px]"
                style={{ borderColor: encre(0.12), color: encre(0.6) }}>
                <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: rgb("primary") }} /> rendez-vous
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: rgb("primary", 0.16) }} /> aujourd&apos;hui
                </span>
                <span style={{ color: encre(0.35) }}>jours pâles = fermés</span>
            </div>
        </div>
    );
}
