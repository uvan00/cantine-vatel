import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/brand";

// Le badge de cantine (demande du propriétaire du 21/11/2026, d'après son modèle de badge à cordon) : le recto porte la
// marque Vatel, « Élève » ou « Personnel », le visage, le nom et la classe ; le verso porte le QR de la carte de
// cantine, celui que le scanner lit avec ou sans réservation. Les deux faces sont côte à côte, à plier sur le
// pointillé, au format d'une carte bancaire debout (54 mm sur 85,6 mm) : il entre dans un porte-badge.
// Marine et bleu Vatel unis (pas de dégradé : règle du projet). Les mesures sont en millimètres pour l'impression.

export type DonneesBadge = {
  id: string;
  nom: string;
  /** Sa classe ou son service ; vide s'il ne l'a pas dit. */
  classe: string;
  /** eleve | employe */
  genre: string;
  photo: string | null;
  /** Le QR de sa carte de cantine, en SVG, fabriqué par le serveur. */
  qr: string;
};

const FACE = { width: "54mm", height: "85.6mm" } as const;
/** Les fonds doivent sortir à l'impression : sans cela le navigateur les retire pour économiser l'encre. */
const ENCRE = { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as React.CSSProperties;

/** La fente du cordon, en haut de chaque face. */
const Fente = ({ sombre = false }: { sombre?: boolean }) => (
  <span aria-hidden="true" className={`mt-[3.5mm] block h-[3mm] w-[14mm] shrink-0 rounded-full ${sombre ? "bg-[#072A5D]/15" : "bg-white"}`} />
);

export function BadgeCantine({ badge }: { badge: DonneesBadge }) {
  return (
    <div className="flex break-inside-avoid" style={{ width: "108mm", height: "85.6mm", ...ENCRE }}>
      {/* Le recto : qui c'est. */}
      <div className="relative flex shrink-0 flex-col items-center overflow-hidden rounded-l-[3mm] bg-[#072A5D] text-white"
        style={{ ...FACE, ...ENCRE, "--sn-on": "255 255 255" } as React.CSSProperties}>
        <Fente />
        <Logo className="mt-[3mm] text-[9pt]" />
        <p className="mt-[3mm] text-[20pt] leading-none font-medium tracking-[0.06em] uppercase text-[#67B2E8]"
          style={{ fontFamily: "var(--police-vatel), var(--font-sneat), sans-serif" }}>
          {badge.genre === "employe" ? "Personnel" : "Élève"}
        </p>
        <div className="mt-[3.5mm] rounded-full bg-white p-[0.8mm]" style={ENCRE}>
          <Avatar id={badge.id} nom={badge.nom} photo={badge.photo} taille={98} />
        </div>
        <p className="mt-[3mm] line-clamp-2 px-[3mm] text-center text-[12pt] leading-[1.15] font-semibold">{badge.nom}</p>
        {badge.classe && <p className="mt-[1.5mm] max-w-[46mm] truncate rounded-full bg-white px-[3mm] py-[0.6mm] text-[8pt] leading-[1.3] font-medium text-[#072A5D]" style={ENCRE}>{badge.classe}</p>}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3.5mm] bg-[#67B2E8]" style={ENCRE} />
      </div>

      {/* Le verso : ce que le comptoir scanne. Le pointillé à gauche est le pli. */}
      <div className="relative flex shrink-0 flex-col items-center overflow-hidden rounded-r-[3mm] border-l border-dashed border-[#072A5D]/40 bg-white text-[#072A5D] shadow-[inset_0_0_0_0.25mm_rgb(7_42_93/0.3)]"
        style={{ ...FACE, ...ENCRE }}>
        <Fente sombre />
        <p className="mt-[3mm] text-[9pt] leading-none font-semibold tracking-[0.04em] uppercase">Badge de cantine</p>
        <div className="mt-[3mm] size-[40mm] [&>svg]:size-full" role="img" aria-label={`Le QR du badge de ${badge.nom}`} dangerouslySetInnerHTML={{ __html: badge.qr }} />
        <p className="mt-[2mm] max-w-[48mm] truncate text-[10pt] leading-[1.2] font-semibold">{badge.nom}</p>
        <p className="mt-[1.5mm] px-[4mm] text-center text-[7.5pt] leading-[1.3]">Un scan au comptoir, avec ou sans réservation</p>
        <p className="mt-auto mb-[5.5mm] px-[4mm] text-center text-[7pt] leading-[1.3] opacity-70">Trouvé ? Rapporte-le à la cantine</p>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3.5mm] bg-[#072A5D]" style={ENCRE} />
      </div>
    </div>
  );
}
