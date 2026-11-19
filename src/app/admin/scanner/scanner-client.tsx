"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EnTetePage } from "@/components/fenetre";
import { AlertTriangle, Ban, Camera, CheckCircle2 } from "@/components/icons";
import { SBtn, SChargement } from "@/components/sneat";
import type { VueTicket } from "@/lib/donnees-admin";
import { nombre } from "@/lib/format";
import type { ChiffresService } from "@/lib/statistiques";
import { nettoyerCode } from "@/lib/ticket";
import { servirTicket, type ReponseService } from "../actions";

// Le scanner du comptoir : la caméra arrière lit le QR du ticket, le serveur répond, la réponse s'affiche en grand.
// Le champ « Code du ticket » reste toujours là : la caméra peut manquer, être refusée, ou demander une adresse en https.

/** Entre deux lectures de l'image : quelques fois par seconde suffisent, et le téléphone ne chauffe pas. */
const PAUSE_ENTRE_LECTURES_MS = 200;
/** Le même QR n'est pas relu tant qu'il reste devant la caméra, ni dans les 3 secondes après l'avoir quittée. */
const MEME_QR_MS = 3000;
/** La réponse reste affichée 2,5 secondes, puis la lecture reprend toute seule. */
const REPRISE_MS = 2500;
/** jsQR lit une image réduite à ce côté : bien assez pour un QR tenu devant la caméra, et quatre fois plus rapide. */
const COTE_MAX = 640;

/* ── Lire un QR dans l'image de la caméra ──────────────────────────────────── */

type DetecteurQr = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type FabriqueDetecteur = { new (options: { formats: string[] }): DetecteurQr; getSupportedFormats(): Promise<string[]> };
type Lecteur = {
  /** Le lecteur du navigateur (BarcodeDetector) ; null s'il n'existe pas ou ne lit pas les QR ; vide tant qu'on n'a pas regardé. */
  natif?: DetecteurQr | null;
  jsqr?: typeof import("jsqr").default;
  toile?: HTMLCanvasElement;
};

async function detecteurNatif(): Promise<DetecteurQr | null> {
  const Fabrique = (window as unknown as { BarcodeDetector?: FabriqueDetecteur }).BarcodeDetector;
  if (!Fabrique) return null;
  try {
    return (await Fabrique.getSupportedFormats()).includes("qr_code") ? new Fabrique({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/** Le texte du QR visible dans l'image, ou null. D'abord le lecteur du navigateur, sinon jsQR sur une image réduite. */
async function lireQr(video: HTMLVideoElement, lecteur: Lecteur): Promise<string | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return null;
  if (lecteur.natif === undefined) lecteur.natif = await detecteurNatif();
  if (lecteur.natif) {
    try {
      return (await lecteur.natif.detect(video)).find((c) => c.rawValue)?.rawValue ?? null;
    } catch {
      // Le navigateur annonce un lecteur qu'il ne sait pas faire marcher : jsQR pour la suite.
      lecteur.natif = null;
    }
  }
  lecteur.jsqr ??= (await import("jsqr")).default;
  lecteur.toile ??= document.createElement("canvas");
  const echelle = Math.min(1, COTE_MAX / Math.max(video.videoWidth, video.videoHeight));
  const largeur = Math.max(1, Math.round(video.videoWidth * echelle));
  const hauteur = Math.max(1, Math.round(video.videoHeight * echelle));
  if (lecteur.toile.width !== largeur || lecteur.toile.height !== hauteur) {
    lecteur.toile.width = largeur;
    lecteur.toile.height = hauteur;
  }
  const dessin = lecteur.toile.getContext("2d", { willReadFrequently: true });
  if (!dessin) return null;
  dessin.drawImage(video, 0, 0, largeur, hauteur);
  const image = dessin.getImageData(0, 0, largeur, hauteur);
  return lecteur.jsqr(image.data, largeur, hauteur, { inversionAttempts: "dontInvert" })?.data || null;
}

/* ── Les états de l'écran ──────────────────────────────────────────────────── */

type EtatCamera = "attente" | "prete" | "sans_https" | "refusee" | "absente" | "panne";
/** lecture : on cherche un QR ; envoi : le serveur vérifie ; reponse : la réponse en grand ; ticket : un ticket ouvert par son adresse. */
type Phase = "lecture" | "envoi" | "reponse" | "ticket";
type Reponse = ReponseService | { genre: "panne"; phrase: string; convive?: undefined; prenom?: undefined; plat?: undefined; service?: undefined };
type Ton = "reussite" | "attention" | "erreur";

/** Le ticket désigné par l'adresse de la page (`?cle=`), ou « inconnu » si rien ne correspond. */
export type TicketOuvert = (VueTicket & { quand: string }) | "inconnu";

const TON: Record<Reponse["genre"], Ton> = {
  servi: "reussite",
  deja_servi: "attention",
  autre_jour: "attention",
  annule: "erreur",
  inconnu: "erreur",
  refuse: "erreur",
  panne: "erreur",
};

const HABIT: Record<Ton, { fond: string; encre: string; Icone: typeof CheckCircle2 }> = {
  reussite: { fond: "rgb(var(--h-succes-teinte) / var(--h-teinte))", encre: "rgb(var(--h-succes-texte))", Icone: CheckCircle2 },
  attention: { fond: "rgb(var(--h-alerte-teinte) / 0.15)", encre: "rgb(var(--h-alerte-texte))", Icone: AlertTriangle },
  erreur: { fond: "rgb(var(--h-danger-teinte) / var(--h-teinte))", encre: "rgb(var(--h-danger-texte))", Icone: Ban },
};

const SANS_CAMERA: Record<Exclude<EtatCamera, "attente" | "prete">, string> = {
  sans_https: "La caméra demande une adresse en https : ici, tape le code du ticket",
  refusee: "La caméra est refusée : autorise-la dans ton navigateur, ou tape le code du ticket",
  absente: "Pas de caméra sur cet appareil : tape le code du ticket",
  panne: "La caméra ne répond pas : recharge la page, ou tape le code du ticket",
};

export function ScannerClient({ service: serviceInitial, ticket }: { service: ChiffresService; ticket: TicketOuvert | null }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const lecteur = useRef<Lecteur>({});
  const dernierQr = useRef({ texte: "", quand: 0 });
  const champCode = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<EtatCamera>("attente");
  const [phase, setPhase] = useState<Phase>(ticket ? "ticket" : "lecture");
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [service, setService] = useState(serviceInitial);
  const [code, setCode] = useState("");

  /** Demande au serveur de servir ce ticket, puis montre sa réponse en grand. */
  const envoyer = async (cle: string) => {
    setPhase("envoi");
    let r: Reponse;
    try {
      r = await servirTicket(cle);
    } catch {
      r = { genre: "panne", phrase: "Le réseau ne répond pas, réessaie" };
    }
    // Le serveur n'a rien pu dire de ce ticket : le même QR doit pouvoir être relu tout de suite.
    if (r.genre === "panne" || r.genre === "refuse") dernierQr.current = { texte: "", quand: 0 };
    if (r.service) setService(r.service);
    setReponse(r);
    setPhase("reponse");
  };

  /** Le ticket ouvert par son adresse est traité (servi ou laissé) : l'adresse redevient celle du scanner. */
  const quitterLeTicket = () => router.replace("/admin/scanner", { scroll: false });
  const servirLeTicket = async (cle: string) => { await envoyer(cle); quitterLeTicket(); };
  const laisserLeTicket = () => { setPhase("lecture"); quitterLeTicket(); };
  const suivant = () => { setPhase("lecture"); champCode.current?.focus({ preventScroll: true }); };

  // La caméra arrière, ouverte une fois à l'arrivée sur la page et rendue en la quittant.
  useEffect(() => {
    let quitte = false;
    let flux: MediaStream | null = null;
    const ouvrir = async () => {
      // Hors https (le wifi en développement), le navigateur ne donne même pas accès à la caméra.
      if (!navigator.mediaDevices?.getUserMedia) { setCamera(window.isSecureContext ? "absente" : "sans_https"); return; }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (quitte) { flux.getTracks().forEach((piste) => piste.stop()); return; }
        if (!video.current) return;
        // La caméra peut s'arrêter en cours de service (autorisation retirée, appareil débranché) : on le dit.
        flux.getVideoTracks()[0]?.addEventListener("ended", () => { if (!quitte) setCamera("panne"); });
        video.current.srcObject = flux;
        await video.current.play();
        if (!quitte) setCamera("prete");
      } catch (e) {
        if (quitte) return;
        const nom = e instanceof DOMException ? e.name : "";
        setCamera(nom === "NotAllowedError" || nom === "SecurityError" ? "refusee" : nom === "NotFoundError" || nom === "OverconstrainedError" ? "absente" : "panne");
      }
    };
    void ouvrir();
    return () => { quitte = true; flux?.getTracks().forEach((piste) => piste.stop()); };
  }, []);

  const surQr = useEffectEvent((texte: string) => { void envoyer(texte); });

  // La lecture : une image, une pause, une image. Elle s'arrête dès qu'un QR part au serveur et reprend avec la phase.
  useEffect(() => {
    if (camera !== "prete" || phase !== "lecture") return;
    let arret = false;
    let minuterie = 0;
    const tour = async () => {
      let texte: string | null = null;
      try {
        if (video.current && document.visibilityState === "visible") texte = await lireQr(video.current, lecteur.current);
      } catch {
        texte = null;
      }
      if (arret) return;
      if (texte) {
        const instant = Date.now();
        const deja = texte === dernierQr.current.texte && instant - dernierQr.current.quand < MEME_QR_MS;
        dernierQr.current = { texte, quand: instant };
        if (!deja) { surQr(texte); return; }
      }
      minuterie = window.setTimeout(tour, PAUSE_ENTRE_LECTURES_MS);
    };
    minuterie = window.setTimeout(tour, PAUSE_ENTRE_LECTURES_MS);
    return () => { arret = true; window.clearTimeout(minuterie); };
  }, [camera, phase]);

  // Avec la caméra, la réponse laisse la place au ticket suivant après 2,5 secondes. Sans elle, elle reste.
  useEffect(() => {
    if (phase !== "reponse" || camera !== "prete") return;
    const minuterie = window.setTimeout(() => setPhase("lecture"), REPRISE_MS);
    return () => window.clearTimeout(minuterie);
  }, [phase, camera]);

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || phase === "envoi") return;
    void envoyer(code);
    setCode("");
  };

  const enDirect = camera === "prete" && phase === "lecture";

  return (
    <div className="w-full space-y-6">
      <EnTetePage titre="Scanner" sousTitre={
        <span className="chiffres flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span><span className="text-[20px] leading-7 font-semibold text-encre/95">{nombre(service.servis)}</span> {service.servis > 1 ? "servis" : "servi"}</span>
          <span><span className="text-[20px] leading-7 font-semibold text-marque-texte">{nombre(service.aServir)}</span> à servir aujourd&apos;hui</span>
        </span>
      } />

      <div className="grid grid-cols-1 items-start gap-6 @4xl/page:grid-cols-[minmax(0,520px)_minmax(0,400px)] @4xl/page:gap-8">
        <div>
          {/* L'image de la caméra ne se montre que pendant la lecture : sous une réponse, son fond sombre baverait dans les coins. */}
          <div className={`relative aspect-square overflow-hidden rounded-[24px] @xl/page:aspect-[4/3] ${enDirect ? "bg-[#1c1c1c]" : "bg-[color:var(--h-surface)]"}`}>
            <video ref={video} playsInline muted aria-label="Image de la caméra" className={`absolute inset-0 size-full object-cover ${enDirect ? "" : "invisible"}`} />

            {enDirect && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="aspect-square h-[64%] rounded-[24px] shadow-[inset_0_0_0_3px_rgb(255_255_255/0.85)]" />
              </div>
            )}
            {enDirect && (
              <p className="absolute inset-x-4 bottom-4 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-center text-[14px] leading-5 text-white">Présente le QR du ticket</p>
            )}

            {phase === "lecture" && camera !== "prete" && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div>
                  <Camera className="mx-auto size-8 text-texte-2" strokeWidth={1.8} />
                  <p className="mx-auto mt-4 max-w-[320px] text-[16px] leading-6 text-encre/90">
                    {camera === "attente" ? "On ouvre la caméra : autorise-la si ton téléphone le demande" : SANS_CAMERA[camera]}
                  </p>
                </div>
              </div>
            )}

            {phase === "envoi" && (
              <div className="absolute inset-0 grid place-items-center bg-surface">
                <div className="flex flex-col items-center gap-4">
                  <SChargement taille={32} />
                  <p className="text-[16px] leading-6 text-encre/90">On vérifie le ticket</p>
                </div>
              </div>
            )}

            {/* La réponse, en grand : la zone existe toujours, pour qu'un lecteur d'écran l'annonce quand elle se remplit. */}
            <div aria-live="assertive" aria-atomic="true">
              {phase === "reponse" && reponse && <GrandeReponse reponse={reponse} />}
            </div>

            {phase === "ticket" && ticket && (
              <TicketTrouve ticket={ticket} onServir={(cle) => void servirLeTicket(cle)} onLaisser={laisserLeTicket} />
            )}
          </div>

          {phase === "reponse" && (
            <div className="mt-4 flex justify-center">
              {camera === "prete"
                ? <SBtn tone="secondary" onClick={() => setPhase("lecture")}>Scanner le suivant</SBtn>
                : <SBtn tone="secondary" onClick={suivant}>Ticket suivant</SBtn>}
            </div>
          )}
        </div>

        <form onSubmit={valider} noValidate>
          <label htmlFor="code-ticket" className="mb-2 block pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Code du ticket</label>
          <div className="flex gap-2">
            {/* Le champ du kit (classe h-champ), écrit ici pour pouvoir y remettre le curseur après une réponse. */}
            <input ref={champCode} id="code-ticket" name="code" value={code} onChange={(e) => setCode(nettoyerCode(e.target.value).slice(0, 6))}
              inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="send"
              aria-describedby="aide-code-ticket" className="h-champ min-w-0 flex-1 font-mono text-[18px] tracking-[0.2em]" />
            <SBtn type="submit" tone="secondary" className="h-12" disabled={code.length !== 6 || phase === "envoi"}>Valider</SBtn>
          </div>
          <p id="aide-code-ticket" className="mt-2 pl-0.5 text-[12px] leading-4 text-texte-2">Les 6 caractères écrits sous le QR, quand la caméra ne le lit pas</p>
          {phase === "lecture" && reponse && (
            <p className="mt-6 border-t border-[color:var(--h-filet)] pt-4 text-[14px] leading-5 text-texte-2">
              Juste avant : <span className="font-medium text-encre/90">{reponse.phrase}</span>{reponse.convive ? `, ${reponse.convive}, ${reponse.plat}` : ""}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

/* ── La réponse du comptoir ────────────────────────────────────────────────── */

function GrandeReponse({ reponse }: { reponse: Reponse }) {
  const { fond, encre, Icone } = HABIT[TON[reponse.genre]];
  return (
    <div className="absolute inset-0 bg-surface">
      <div className="absolute inset-0 grid place-items-center p-6 text-center" style={{ background: fond }}>
        <div className="min-w-0">
          <Icone className="mx-auto size-12" strokeWidth={1.8} style={{ color: encre }} />
          <p className="mt-4 text-[32px] leading-10 font-semibold text-encre/95 @xl/page:text-[40px] @xl/page:leading-[48px]">{reponse.phrase}</p>
          {reponse.convive && <p className="mt-3 text-[24px] leading-8 font-semibold text-encre/95">{reponse.genre === "servi" ? reponse.prenom : reponse.convive}</p>}
          {reponse.plat && <p className="mt-1 text-[16px] leading-6 text-encre/75">{reponse.plat}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Le ticket ouvert par son adresse ──────────────────────────────────────── */

function TicketTrouve({ ticket, onServir, onLaisser }: { ticket: TicketOuvert; onServir: (cle: string) => void; onLaisser: () => void }) {
  if (ticket === "inconnu") {
    return (
      <div className="absolute inset-0 bg-surface">
        <div className="absolute inset-0 grid place-items-center p-6 text-center" style={{ background: HABIT.erreur.fond }}>
          <div>
            <Ban className="mx-auto size-12" strokeWidth={1.8} style={{ color: HABIT.erreur.encre }} />
            <p className="mt-4 text-[32px] leading-10 font-semibold text-encre/95">Ticket inconnu</p>
            <p className="mt-2 text-[16px] leading-6 text-encre/75">Cette adresse ne mène à aucun ticket</p>
            <SBtn tone="secondary" className="mt-6" onClick={onLaisser}>Scanner un ticket</SBtn>
          </div>
        </div>
      </div>
    );
  }
  const servable = ticket.apercu.genre === "servi";
  const habit = HABIT[TON[ticket.apercu.genre]];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-surface p-6 text-center shadow-[inset_0_0_0_1px_var(--h-filet)]" style={{ borderRadius: 24 }}>
      <div className="min-w-0">
        <p className="text-[14px] leading-5 text-texte-2">Ticket pour {ticket.quand}</p>
        <p className="mt-2 text-[28px] leading-9 font-semibold text-encre/95">{ticket.convive}</p>
        <p className="mt-1 text-[16px] leading-6 text-encre/75">{ticket.plat}</p>
        <p className="mt-2 font-mono text-[16px] leading-6 tracking-[0.2em] text-encre/80">{ticket.code}</p>
        {servable ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <SBtn tone="secondary" onClick={() => onServir(ticket.cle)}>Servir ce ticket</SBtn>
            <SBtn variant="text" tone="secondary" onClick={onLaisser}>Ne pas servir</SBtn>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-[12px] px-3 py-2 text-[16px] leading-6 font-semibold text-encre/95" style={{ background: habit.fond }}>
              <habit.Icone className="size-5 shrink-0" strokeWidth={1.8} style={{ color: habit.encre }} />
              {ticket.apercu.phrase}
            </p>
            <SBtn tone="secondary" className="mt-6" onClick={onLaisser}>Scanner un autre ticket</SBtn>
          </>
        )}
      </div>
    </div>
  );
}
