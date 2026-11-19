"use client";

import { useState } from "react";
import { ArrowDownToLine } from "@/components/icons";
import { SBtn } from "@/components/sneat";

// Le QR universel de paiement d'une recharge, dans sa carte blanche, avec la marche à suivre. Le SVG vient du serveur
// (src/lib/pispi.ts, bibliothèque officielle de la BCEAO) : on le montre tel quel, sans rien y ajouter.
// Un téléphone ne scanne pas son propre écran : « Enregistrer l'image » dessine ce SVG dans un canvas et en fait un
// PNG, à ouvrir depuis son application de paiement ou à montrer sur un autre écran.

/** Le PNG enregistré : un carré assez grand pour être scanné de loin, le QR au milieu de sa marge blanche. */
const COTE = 1024;
const MARGE = 96;

function pngDuQr(svg: string): Promise<Blob> {
  return new Promise((ok, non) => {
    // La bibliothèque n'écrit pas la taille du SVG : sans elle, certains navigateurs ne le dessinent pas dans un canvas.
    const racine = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
    racine.setAttribute("width", String(COTE - 2 * MARGE));
    racine.setAttribute("height", String(COTE - 2 * MARGE));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(racine)], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const toile = document.createElement("canvas");
      toile.width = COTE;
      toile.height = COTE;
      const dessin = toile.getContext("2d");
      if (!dessin) { URL.revokeObjectURL(url); non(new Error("Canvas indisponible")); return; }
      dessin.fillStyle = "#FFFFFF";
      dessin.fillRect(0, 0, COTE, COTE);
      dessin.drawImage(image, MARGE, MARGE, COTE - 2 * MARGE, COTE - 2 * MARGE);
      URL.revokeObjectURL(url);
      toile.toBlob((png) => (png ? ok(png) : non(new Error("Image vide"))), "image/png");
    };
    image.onerror = () => { URL.revokeObjectURL(url); non(new Error("QR illisible")); };
    image.src = url;
  });
}

const annule = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * Remet le PNG à la personne. Sur iPhone, un téléchargement part dans « Fichiers », où les applications de paiement
 * ne vont pas chercher : on passe par la feuille de partage, dont « Enregistrer l'image » range le QR dans Photos.
 * Partout ailleurs, et si le partage est refusé, on télécharge.
 */
async function remettre(png: Blob, nom: string) {
  const fichier = new File([png], nom, { type: "image/png" });
  const iphone = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (iphone && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
      return;
    } catch (e) {
      if (annule(e)) throw e;
    }
  }
  const url = URL.createObjectURL(png);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function QrRecharge({ svg, reference, montantATaper }: {
  svg: string;
  reference: string;
  /** Le montant, déjà écrit en francs, quand le QR ne le porte pas : le payeur le tape lui-même. */
  montantATaper?: string;
}) {
  const [suite, setSuite] = useState<"" | "en_cours" | "fait" | "echec">("");

  const enregistrer = async () => {
    setSuite("en_cours");
    try {
      await remettre(await pngDuQr(svg), `recharge-${reference}.png`);
      setSuite("fait");
    } catch (e) {
      // La personne a refermé la feuille de partage : rien à dire.
      setSuite(annule(e) ? "" : "echec");
    }
  };

  const etapes: React.ReactNode[] = [
    "Ouvre ton application Mobile Money",
    montantATaper ? <>Scanne ce QR, puis tape le montant : <span className="chiffres font-medium text-encre/95">{montantATaper}</span></> : "Scanne ce QR",
    "Vérifie le nom et le montant avant de valider",
  ];

  return (
    <div>
      <figure className="mx-auto w-full max-w-[296px] rounded-[16px] bg-white p-6" style={{ boxShadow: "0 0 0 1px var(--h-filet), var(--h-ombre-1)" }}>
        <div role="img" aria-label={`QR de paiement de la recharge ${reference}`} className="aspect-square [&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption className="mt-4 text-center text-[13px] leading-4 text-texte-2">QR universel PI-SPI</figcaption>
      </figure>

      <ol className="mt-6 space-y-3">
        {etapes.map((etape, i) => (
          <li key={i} className="flex items-start gap-3 text-[15px] leading-6 text-encre/90">
            <span aria-hidden="true" className="chiffres grid size-6 shrink-0 place-items-center rounded-full bg-surface text-[13px] leading-4 font-medium text-encre/90 shadow-[0_0_0_1px_var(--h-filet)]">{i + 1}</span>
            <span className="min-w-0">{etape}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-[color:var(--h-filet)] pt-5">
        <p className="text-[14px] leading-5 text-texte-2">
          Un téléphone ne scanne pas son propre écran : enregistre l&apos;image pour l&apos;ouvrir depuis ton application, ou montre ce QR sur un autre écran
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SBtn type="button" tone="secondary" variant="outlined" onClick={enregistrer} disabled={suite === "en_cours"}>
            <ArrowDownToLine className="size-5" strokeWidth={1.8} />
            {suite === "en_cours" ? "Un instant" : "Enregistrer l'image"}
          </SBtn>
          <span aria-live="polite" className="text-[14px] leading-5 text-texte-2">
            {suite === "fait" && "Image prête, ouvre-la depuis ton application"}
            {suite === "echec" && "L'image n'a pas pu se faire : prends plutôt une capture d'écran"}
          </span>
        </div>
      </div>
    </div>
  );
}
