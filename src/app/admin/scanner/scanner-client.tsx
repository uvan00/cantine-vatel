"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EtiquettesAliments } from "@/components/allergene";
import { Avatar } from "@/components/avatar";
import { useRouter } from "next/navigation";
import { EnTetePage, useConfirmation } from "@/components/fenetre";
import { AlertTriangle, Ban, Camera, CheckCircle2 } from "@/components/icons";
import { PhotoPlat } from "@/components/photo-plat";
import { SAlert, SBtn, SChargement } from "@/components/sneat";
import { creneauLisible } from "@/lib/creneaux";
import type { TicketLocal, VueTicket } from "@/lib/donnees-admin";
import type { Etiquette } from "@/lib/listes";
import { fcfa, nombre } from "@/lib/format";
import { jourIso } from "@/lib/jours";
import { MOYENS_COMPTOIR, nomDeLaFile, scanner as verdictScan, type MoyenComptoir } from "@/lib/reservation";
import type { ChiffresService } from "@/lib/statistiques";
import { lireCle, nettoyerCode } from "@/lib/ticket";
import { servirALaBorne } from "@/app/borne/actions";
import { encaisserTicket, servirBadge, servirEnRetard, servirTicket, type ReponseEnRetard, type ReponseService } from "../actions";

// Le scanner du comptoir : la caméra arrière lit le QR du ticket, le serveur répond, la réponse s'affiche en grand.
// Le champ « Code du ticket » reste toujours là : la caméra peut manquer, être refusée, ou demander une adresse en https.
// Sans réseau (le pointage continue hors ligne), il sert d'après sa copie des tickets du
// jour, avec la même règle, et envoie ces services au serveur dès le retour du réseau. En borne (/borne :
// l'élève pointe lui-même à l'entrée), il accueille l'élève par son prénom.
// Les trois files (21/11/2026) : un ticket payé est servi tout de suite (express) ; un ticket réservé sans payer ouvre
// la caisse, qui choisit le moyen (réservation) ; un badge sans repas ouvre le choix du plat, puis la caisse (classique).

/** La copie des tickets du jour et la file des services faits hors ligne, gardées sur l'appareil de la cantine. */
const CLE_TICKETS = "cantine.tickets";
const CLE_FILE = "cantine.file";
type EnAttente = { cle: string; instant: number };

const lireStockage = <T,>(cle: string, defaut: T): T => {
  try { return JSON.parse(localStorage.getItem(cle) ?? "") as T; } catch { return defaut; }
};

/** La file des services hors ligne, lue dans le stockage de l'appareil : la même pour toutes les parties de l'écran. */
const abonnesFile = new Set<() => void>();
const fileStockee = {
  lire: () => localStorage.getItem(CLE_FILE) ?? "[]",
  ecrire: (liste: EnAttente[]) => { localStorage.setItem(CLE_FILE, JSON.stringify(liste)); abonnesFile.forEach((f) => f()); },
  abonner: (f: () => void) => { abonnesFile.add(f); return () => { abonnesFile.delete(f); }; },
};

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
/**
 * lecture : on cherche un QR ; envoi : le serveur vérifie ; reponse : la réponse en grand ; ticket : un ticket ouvert par
 * son adresse ; caisse : un repas à encaisser (ticket à payer, ou badge sans réservation), l'écran attend la caisse.
 */
type Phase = "lecture" | "envoi" | "reponse" | "ticket" | "caisse";
type Reponse = (ReponseService & { horsLigne?: boolean })
  | { genre: "panne"; phrase: string; convive?: undefined; conviveId?: undefined; photo?: undefined; prenom?: undefined; plat?: undefined; service?: undefined; creneau?: undefined; allergies?: undefined; enCause?: undefined; voirLaCantine?: undefined; horsLigne?: undefined; file?: undefined; paiement?: undefined };
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
  a_payer: "attention",
  sans_repas: "attention",
};

/** Après « Servi », pour la caisse : comment le repas a été payé. */
const PAYE: Record<string, string> = { solde: "payé sur son solde", especes: "payé en espèces", mobile_money: "payé par Mobile Money" };

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

export function ScannerClient({ service: serviceInitial, ticket, borne = false, badge = null }: {
  service: ChiffresService;
  ticket: TicketOuvert | null;
  /** L'écran de la borne d'entrée (/borne). */
  borne?: boolean;
  /** Un badge désigné par l'adresse de la page, sans repas réservé aujourd'hui : la caisse s'ouvre dessus. */
  badge?: string | null;
}) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const lecteur = useRef<Lecteur>({});
  const dernierQr = useRef({ texte: "", quand: 0 });
  const champCode = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<EtatCamera>("attente");
  // Chaque demande d'accès rouvre la caméra : le bouton « Demander l'accès à la caméra », ou l'autorisation donnée
  // ensuite dans les réglages du navigateur. `refusDefinitif` : le navigateur a gardé un refus et ne reposera pas la question.
  const [essaiCamera, setEssaiCamera] = useState(0);
  const [refusDefinitif, setRefusDefinitif] = useState(false);
  const redemanderCamera = () => { setCamera("attente"); setEssaiCamera((n) => n + 1); };
  const [phase, setPhase] = useState<Phase>(ticket ? "ticket" : badge && !borne ? "envoi" : "lecture");
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [service, setService] = useState(serviceInitial);
  const [code, setCode] = useState("");
  const tickets = useRef<{ jour: string; liste: TicketLocal[] }>({ jour: "", liste: [] });
  const fileBrute = useSyncExternalStore(fileStockee.abonner, fileStockee.lire, () => "[]");
  const file = useMemo<EnAttente[]>(() => { try { return JSON.parse(fileBrute) as EnAttente[]; } catch { return []; } }, [fileBrute]);
  const [horsLigne, setHorsLigne] = useState(false);
  const [aVerifier, setAVerifier] = useState<ReponseEnRetard[]>([]);
  // La caisse ouverte : la clé lue (le ticket ou le badge), ce que le serveur en a dit, et la raison d'un refus.
  const [caisse, setCaisse] = useState<{ cle: string; reponse: ReponseService; erreur: string | null } | null>(null);
  const [enCaisse, setEnCaisse] = useState(false);

  // La copie des tickets du jour : relue sur l'appareil à l'arrivée, puis rafraîchie chaque minute tant que le réseau répond.
  useEffect(() => {
    // La borne ne garde aucune copie des tickets : tournée vers la file, elle n'a ni les jetons ni les allergies des
    // autres sur l'appareil, et elle attend le réseau. Une copie laissée là par le scanner s'en va.
    if (borne) { localStorage.removeItem(CLE_TICKETS); return; }
    tickets.current = lireStockage(CLE_TICKETS, { jour: "", liste: [] as TicketLocal[] });
    const rafraichir = async () => {
      try {
        const r = await fetch("/api/admin/tickets-du-jour", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { jour: string; tickets: TicketLocal[] };
        // Un service fait hors ligne et pas encore envoyé reste « servi » sur l'appareil.
        const enAttente = new Set(lireStockage<EnAttente[]>(CLE_FILE, []).map((e) => e.cle));
        const liste = d.tickets.map((t) => (enAttente.has(t.jeton) || enAttente.has(t.code) ? { ...t, etat: "servie", serviLe: t.serviLe ?? new Date().toISOString() } : t));
        tickets.current = { jour: d.jour, liste };
        localStorage.setItem(CLE_TICKETS, JSON.stringify(tickets.current));
      } catch {
        // Pas de réseau : on garde la copie qu'on a.
      }
    };
    void rafraichir();
    const minuterie = window.setInterval(() => { if (navigator.onLine) void rafraichir(); }, 60_000);
    return () => window.clearInterval(minuterie);
  }, [borne]);

  /** Servir d'après la copie du jour, quand le serveur ne répond pas. null : rien à dire sans réseau. */
  const servirHorsLigne = (cle: string): Reponse | null => {
    const lue = lireCle(cle);
    const copie = tickets.current;
    if (!lue || copie.jour !== jourIso(Date.now())) return null;
    // Une carte de cantine désigne le repas du jour de son élève (un ticket non annulé).
    const t = copie.liste.find((x) => ("jeton" in lue ? x.jeton === lue.jeton : "carte" in lue ? x.carte === lue.carte && x.etat !== "annulee" : x.code === lue.code));
    if (!t) return { genre: "inconnu", phrase: "carte" in lue ? "Pas de repas aujourd'hui pour cette carte, d'après cet appareil" : "Ticket inconnu de cet appareil", horsLigne: true };
    const v = verdictScan({ etat: t.etat, jour: t.jour, serviLe: t.serviLe, paiement: t.paiement, prix: t.prix }, Date.now());
    // Sans réseau, on ne note pas un paiement : le ticket à payer attend.
    if (v.genre === "a_payer") v.phrase = `${v.phrase}, au retour du réseau`;
    if (v.genre === "servi") {
      t.etat = "servie";
      t.serviLe = new Date().toISOString();
      localStorage.setItem(CLE_TICKETS, JSON.stringify(copie));
      // La file garde toujours le jeton du ticket : le serveur le relit sans ambiguïté, même lu par une carte.
      fileStockee.ecrire([...lireStockage<EnAttente[]>(CLE_FILE, []), { cle: t.jeton, instant: Date.now() }]);
    }
    const prenom = t.convive.split(/\s+/)[0];
    return { genre: v.genre, phrase: v.phrase, convive: t.convive, conviveId: t.conviveId, photo: t.photo, prenom, plat: t.plat, creneau: t.creneau, code: t.code, allergies: t.allergies ?? [], enCause: t.enCause ?? [], horsLigne: true };
  };

  // Le retour du réseau : les services faits hors ligne partent au serveur ; ce qu'il refuse est à vérifier.
  const envoyerLaFile = useEffectEvent(async () => {
    // La file des services hors ligne est celle du scanner de la cantine : la borne ne l'envoie pas.
    if (borne || file.length === 0 || !navigator.onLine) return;
    const lot = file;
    let res: ReponseEnRetard[] | null;
    try { res = await servirEnRetard(lot); } catch { return; }
    if (res === null) return;
    setHorsLigne(false);
    fileStockee.ecrire(lireStockage<EnAttente[]>(CLE_FILE, []).slice(lot.length));
    const refus = res.filter((x) => x.genre !== "servi");
    if (refus.length > 0) setAVerifier((avant) => [...avant, ...refus]);
  });
  useEffect(() => {
    const essayer = () => { void envoyerLaFile(); };
    window.addEventListener("online", essayer);
    const minuterie = window.setInterval(essayer, 10_000);
    return () => { window.removeEventListener("online", essayer); window.clearInterval(minuterie); };
  }, []);

  /** Demande au serveur de servir ce ticket, puis montre sa réponse en grand. Sans réseau : d'après la copie du jour. */
  const envoyer = async (cle: string) => {
    setPhase("envoi");
    let r: Reponse;
    try {
      if (!navigator.onLine) throw new Error("hors ligne");
      r = borne ? await servirALaBorne(cle) : await servirTicket(cle);
      setHorsLigne(false);
    } catch {
      setHorsLigne(true);
      r = borne
        ? { genre: "panne", phrase: "Pas de réseau, passe au comptoir avec ton ticket" }
        : servirHorsLigne(cle) ?? { genre: "panne", phrase: "Le réseau ne répond pas, réessaie" };
    }
    recevoir(cle, r);
  };

  /** Ce que le serveur (ou la copie hors ligne) a répondu pour cette clé : la caisse s'ouvre, ou la réponse s'affiche. */
  const recevoir = (cle: string, r: Reponse) => {
    // Le serveur n'a rien pu dire de ce ticket : le même QR doit pouvoir être relu tout de suite.
    if (r.genre === "panne" || r.genre === "refuse") dernierQr.current = { texte: "", quand: 0 };
    if (r.service) setService(r.service);
    // Un ticket à payer, ou un badge sans repas réservé : la caisse s'ouvre et attend (pas à la borne, pas sans réseau).
    if (!borne && !r.horsLigne && (r.genre === "a_payer" || r.genre === "sans_repas")) {
      setCaisse({ cle, reponse: r, erreur: null });
      setPhase("caisse");
      return;
    }
    setReponse(r);
    setPhase("reponse");
  };

  /** La caisse a choisi : le serveur encaisse et sert. Refusé (solde trop court, plat complet), elle reste ouverte et dit pourquoi. */
  const encaisser = async (geste: () => Promise<ReponseService>) => {
    if (!caisse || enCaisse) return;
    setEnCaisse(true);
    let r: ReponseService | null;
    try { r = await geste(); } catch { r = null; }
    setEnCaisse(false);
    if (!r) { setCaisse({ ...caisse, erreur: "Le réseau ne répond pas, réessaie" }); return; }
    if (r.service) setService(r.service);
    if (r.genre === "a_payer" || r.genre === "sans_repas") {
      setCaisse({ cle: caisse.cle, reponse: { ...caisse.reponse, ...r, plats: r.plats ?? caisse.reponse.plats }, erreur: r.phrase });
      return;
    }
    setCaisse(null);
    setReponse(r);
    setPhase("reponse");
  };
  const laisserLaCaisse = () => { setCaisse(null); dernierQr.current = { texte: "", quand: 0 }; setPhase("lecture"); };

  // Le badge désigné par l'adresse : on demande au serveur ce qu'il peut prendre (une lecture), et la caisse s'ouvre
  // quand il répond. L'adresse redevient celle du scanner.
  const surBadge = useEffectEvent((cle: string, r: Reponse) => {
    recevoir(cle, r);
    router.replace("/admin/scanner", { scroll: false });
  });
  useEffect(() => {
    if (!badge || borne) return;
    let quitte = false;
    servirTicket(badge)
      .then((r) => { if (!quitte) surBadge(badge, r); })
      .catch(() => { if (!quitte) surBadge(badge, { genre: "panne", phrase: "Le réseau ne répond pas, réessaie" }); });
    return () => { quitte = true; };
  }, [badge, borne]);

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
  }, [essaiCamera]);

  // Le navigateur garde un refus : redemander ne rouvre pas sa question. On le dit, et la caméra se rouvre toute seule
  // dès que l'autorisation est donnée dans ses réglages.
  const surAutorisation = useEffectEvent((etat: PermissionState) => {
    setRefusDefinitif(etat === "denied");
    if (etat === "granted" && camera !== "prete") redemanderCamera();
  });
  useEffect(() => {
    let statut: PermissionStatus | null = null;
    const suivre = () => { if (statut) surAutorisation(statut.state); };
    navigator.permissions?.query({ name: "camera" as PermissionName })
      .then((s) => { statut = s; setRefusDefinitif(s.state === "denied"); s.addEventListener("change", suivre); })
      .catch(() => { /* Navigateur sans cette question : le bouton suffit. */ });
    return () => statut?.removeEventListener("change", suivre);
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

  // Avec la caméra, la réponse laisse la place au ticket suivant après 2,5 secondes (4 à la borne). Sans elle, elle
  // reste, sauf à la borne : l'élève suivant tape son code.
  useEffect(() => {
    if (phase !== "reponse" || (camera !== "prete" && !borne)) return;
    const minuterie = window.setTimeout(() => setPhase("lecture"), borne ? 4000 : REPRISE_MS);
    return () => window.clearTimeout(minuterie);
  }, [phase, camera, borne]);

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || phase === "envoi") return;
    void envoyer(code);
    setCode("");
  };

  const enDirect = camera === "prete" && phase === "lecture";

  return (
    <div className="w-full space-y-6">
      {borne ? (
        <EnTetePage titre="Bon appétit à la cantine" sousTitre="Présente le QR de ton ticket devant la caméra, ou tape son code" />
      ) : (
        <EnTetePage titre="Scanner" sousTitre={
          <span className="chiffres flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span><span className="text-[20px] leading-7 font-semibold text-encre/95">{nombre(service.servis)}</span> {service.servis > 1 ? "servis" : "servi"}</span>
            <span><span className="text-[20px] leading-7 font-semibold text-marque-texte">{nombre(service.aServir)}</span> à servir aujourd&apos;hui</span>
          </span>
        } />
      )}

      {(horsLigne || file.length > 0) && (
        <p role="status" className="chiffres rounded-[12px] bg-[rgb(var(--h-alerte-teinte)/0.15)] px-4 py-3 text-[14px] leading-5 text-encre/95">
          {horsLigne ? (borne ? "Pas de réseau : la borne attend, passe au comptoir avec ton ticket" : "Hors ligne : le scanner sert d'après sa copie des tickets du jour") : "Le réseau est revenu"}
          {file.length > 0 && `, ${file.length} ${file.length > 1 ? "services partiront" : "service partira"} au serveur dès que possible`}
        </p>
      )}
      {aVerifier.length > 0 && (
        <div className="rounded-[12px] border border-[color:var(--h-filet)] px-4 py-3 text-[14px] leading-5">
          <p className="font-semibold text-encre/95">À vérifier : servis hors ligne, refusés par le serveur</p>
          <ul className="mt-1 space-y-1 text-texte-2">
            {aVerifier.map((x, i) => <li key={`${x.cle}-${i}`}>{x.convive ?? x.cle} : {x.phrase}</li>)}
          </ul>
          <SBtn size="sm" variant="text" tone="secondary" className="mt-1" onClick={() => setAVerifier([])}>C&apos;est vu</SBtn>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 @4xl/page:grid-cols-[minmax(0,520px)_minmax(0,400px)] @4xl/page:gap-8">
        <div>
          {/* L'image de la caméra ne se montre que pendant la lecture : sous une réponse, son fond sombre baverait dans les coins. */}
          <div className={`relative aspect-square overflow-clip rounded-[24px] @xl/page:aspect-[4/3] ${enDirect ? "bg-[#1c1c1c]" : "bg-[color:var(--h-surface)]"}`}>
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
                  {(camera === "refusee" || camera === "panne") && (
                    <>
                      <button type="button" onClick={redemanderCamera} className="hb hb--filet hb--petit mt-4">Demander l&apos;accès à la caméra</button>
                      {camera === "refusee" && refusDefinitif && (
                        <p className="mx-auto mt-3 max-w-[320px] text-[13px] leading-5 text-texte-2">
                          Le navigateur a gardé ton refus : touche le cadenas ou l&apos;icône de caméra à côté de l&apos;adresse, autorise la caméra, et elle s&apos;ouvre toute seule
                        </p>
                      )}
                    </>
                  )}
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
              {phase === "reponse" && reponse && <GrandeReponse reponse={reponse} borne={borne} />}
            </div>

            {phase === "ticket" && ticket && (
              <TicketTrouve ticket={ticket} onServir={(cle) => void servirLeTicket(cle)} onLaisser={laisserLeTicket} />
            )}

            {phase === "caisse" && caisse && (
              <Caisse key={caisse.cle} reponse={caisse.reponse} erreur={caisse.erreur} enCours={enCaisse} onLaisser={laisserLaCaisse}
                onEncaisser={(moyen) => void encaisser(() => encaisserTicket(caisse.cle, moyen))}
                onPrendre={(menuJourId, moyen) => void encaisser(() => servirBadge(caisse.cle, menuJourId, moyen))} />
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
          <label htmlFor="code-ticket" className="mb-2 block pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">{borne ? "Ou tape le code de ton ticket" : "Code du ticket"}</label>
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

function GrandeReponse({ reponse, borne }: { reponse: Reponse; borne: boolean }) {
  const { fond, encre, Icone } = HABIT[TON[reponse.genre]];
  // À la borne, l'élève servi est accueilli par son prénom.
  const phrase = borne && reponse.genre === "servi" && reponse.prenom ? `Bon appétit, ${reponse.prenom}` : reponse.phrase;
  return (
    // Dans le flux, à la même proportion que le cadre : si la réponse est plus haute (un convive aux nombreuses
    // allergies, sur un téléphone), le cadre grandit au lieu de la couper.
    <div className="relative bg-surface">
      <div className="grid aspect-square place-items-center p-6 text-center @xl/page:aspect-[4/3]" style={{ background: fond }}>
        <div className="min-w-0">
          <Icone className="mx-auto size-12" strokeWidth={1.8} style={{ color: encre }} />
          <p className="mt-4 text-[32px] leading-10 font-semibold text-encre/95 @xl/page:text-[40px] @xl/page:leading-[48px]">{phrase}</p>
          {reponse.convive && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {reponse.conviveId && <Avatar id={reponse.conviveId} nom={reponse.convive} photo={reponse.photo} taille={72} />}
              <p className="text-[24px] leading-8 font-semibold text-encre/95">{reponse.genre === "servi" ? reponse.prenom : reponse.convive}</p>
            </div>
          )}
          {reponse.plat && <p className="mt-1 text-[16px] leading-6 text-encre/75">{reponse.plat}{reponse.creneau ? `, passage à ${creneauLisible(reponse.creneau)}` : ""}</p>}
          {/* Pas à la borne : elle est tournée vers la file, et l'allergie d'un élève ne regarde que lui et la cantine. */}
          {!borne && reponse.convive && <Allergies etiquettes={reponse.allergies ?? []} enCause={reponse.enCause ?? []} />}
          {borne && reponse.voirLaCantine && <p className="mt-3 text-[20px] leading-7 font-semibold text-encre/95">Passe d&apos;abord voir la cantine avec ton ticket</p>}
          {!borne && reponse.genre === "servi" && reponse.file && (
            <p className="mt-2 text-[14px] leading-5 text-encre/75">{nomDeLaFile(reponse.file)}{PAYE[reponse.paiement ?? ""] ? `, ${PAYE[reponse.paiement ?? ""]}` : ""}</p>
          )}
          {reponse.horsLigne && reponse.genre === "servi" && <p className="mt-2 text-[13px] leading-5 text-encre/60">Hors ligne : envoyé au serveur dès le retour du réseau</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Ce à quoi ce convive est allergique, posé calmement sous son plat. Rien s'il n'a déclaré aucun allergène.
 * `enCause` : ce que CE plat contient et qu'il ne mange pas. Réserver l'aurait refusé ; si le cas se présente quand
 * même (profil réglé après, plat modifié), il passe devant, encadré : à vérifier avant de servir.
 */
function Allergies({ etiquettes, enCause = [] }: { etiquettes: Etiquette[]; enCause?: Etiquette[] }) {
  if (etiquettes.length === 0 && enCause.length === 0) return null;
  return (
    <div className="mx-auto mt-4 w-fit max-w-full space-y-2">
      {enCause.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[16px] bg-surface px-4 py-3" style={{ boxShadow: `inset 0 0 0 2px ${HABIT.attention.encre}` }}>
          <span className="flex items-center gap-2 text-[15px] leading-6 font-semibold text-encre/95">
            <AlertTriangle className="size-5 shrink-0" strokeWidth={1.8} style={{ color: HABIT.attention.encre }} aria-hidden="true" />
            Ce plat ne convient pas à son profil, vérifie avant de servir
          </span>
          <EtiquettesAliments etiquettes={enCause} taille={28} className="justify-center text-[15px] leading-6 text-encre/90" />
        </div>
      )}
      {etiquettes.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[16px] bg-surface px-4 py-3 shadow-[inset_0_0_0_1px_var(--h-filet)]">
          <span className="text-[15px] leading-6 font-semibold text-encre/95">Allergique</span>
          <EtiquettesAliments etiquettes={etiquettes} taille={28} className="justify-center text-[15px] leading-6 text-encre/90" />
        </div>
      )}
    </div>
  );
}

/* ── La caisse : encaisser un ticket à payer, servir un badge sans réservation ── */

/**
 * La file réservation (un ticket réservé sans payer) : le montant, puis le moyen. La file classique (un badge sans
 * repas réservé) : les plats du jour, celui que le convive choisit, puis le moyen. Dans les deux cas, le serveur
 * encaisse et sert dans le même geste, et note qui a encaissé.
 */
function Caisse({ reponse, erreur, enCours, onEncaisser, onPrendre, onLaisser }: {
  reponse: ReponseService;
  /** Pourquoi le dernier geste n'a pas servi (solde trop court, plat complet), ou null. */
  erreur: string | null;
  enCours: boolean;
  onEncaisser: (moyen: MoyenComptoir) => void;
  onPrendre: (menuJourId: string, moyen: MoyenComptoir) => void;
  onLaisser: () => void;
}) {
  const [platId, setPlatId] = useState<string | null>(null);
  const sansRepas = reponse.genre === "sans_repas";
  const plats = reponse.plats ?? [];
  const plat = plats.find((p) => p.id === platId && p.refus === null) ?? null;
  const prix = sansRepas ? plat?.prix ?? null : reponse.prix ?? null;
  const solde = reponse.solde ?? 0;
  const { confirmer, fenetre } = useConfirmation();
  // Espèces et Mobile Money : un geste. Le solde de l'élève se débite pour de bon et un repas servi ne se défait plus :
  // la caisse le confirme d'abord (un bouton voisin touché par erreur ferait payer deux fois).
  const payer = async (moyen: MoyenComptoir) => {
    if (sansRepas && !plat) return;
    if (moyen === "solde" && prix !== null) {
      const oui = await confirmer({
        titre: "Débiter son solde ?",
        message: `${reponse.convive ?? "Ce convive"} paie ${fcfa(prix)} avec son solde, et son repas sera noté servi. Ce geste ne se défait pas.`,
        libelle: "Débiter et servir",
        corbeille: false,
      });
      if (!oui) return;
    }
    if (sansRepas) { if (plat) onPrendre(plat.id, moyen); } else onEncaisser(moyen);
  };
  return (
    // Dans le flux, à la proportion du cadre, comme la grande réponse : une courte caisse le remplit, une longue liste
    // de plats le fait grandir au lieu d'être coupée.
    <div className="relative grid aspect-square place-items-center bg-surface p-5 text-center shadow-[inset_0_0_0_1px_var(--h-filet)] @xl/page:aspect-[4/3]" style={{ borderRadius: 24 }}>
      <div className="w-full min-w-0">
      <p className="mx-auto w-fit rounded-full px-3 py-1 text-[13px] leading-5 font-semibold" style={{ background: HABIT.attention.fond, color: HABIT.attention.encre }}>
        {nomDeLaFile(sansRepas ? "classique" : "reservation")}
      </p>
      {reponse.convive && (
        <div className="mt-3 flex flex-col items-center gap-2">
          {reponse.conviveId && <Avatar id={reponse.conviveId} nom={reponse.convive} photo={reponse.photo} taille={64} />}
          <p className="text-[22px] leading-7 font-semibold text-encre/95">{reponse.convive}</p>
        </div>
      )}
      {sansRepas
        ? <p className="mt-1 text-[15px] leading-6 text-encre/75">Pas de repas réservé aujourd&apos;hui : quel plat prend-il ?</p>
        : reponse.plat && <p className="mt-1 text-[16px] leading-6 text-encre/75">{reponse.plat}{reponse.creneau ? `, passage à ${creneauLisible(reponse.creneau)}` : ""}</p>}
      {reponse.convive && <Allergies etiquettes={reponse.allergies ?? []} enCause={sansRepas ? [] : reponse.enCause ?? []} />}

      {sansRepas && (plats.length === 0 ? (
        <p className="mt-4 rounded-[16px] border border-dashed border-[color:var(--h-surface-forte)] px-4 py-6 text-[14px] leading-5 text-texte-2">Rien au menu aujourd&apos;hui</p>
      ) : (
        <ul className="mt-4 space-y-2 text-left">
          {plats.map((p) => {
            const choisi = p.id === plat?.id;
            return (
              <li key={p.id}>
                <button type="button" disabled={p.refus !== null || enCours} aria-pressed={choisi} onClick={() => setPlatId(p.id)}
                  className={`flex w-full items-center gap-3 rounded-[16px] border p-2 pr-3 text-left transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${choisi ? "border-[rgb(var(--h-marque-texte))] bg-[rgb(var(--h-marque-teinte)/var(--h-teinte))]" : "border-[color:var(--h-filet)] bg-surface hover:bg-[color:var(--h-filet-doux)]"}`}>
                  <span className="w-20 shrink-0 overflow-hidden rounded-[10px]"><PhotoPlat photo={p.photo} nom="" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-5 font-semibold text-encre/95">{p.nom}</span>
                    <span className="chiffres block text-[13px] leading-5 text-texte-2">{p.refus ?? (p.restantes !== null ? `Il en reste ${nombre(p.restantes)}` : "Disponible")}</span>
                  </span>
                  <span className="chiffres shrink-0 text-[15px] leading-5 font-semibold text-encre/95">{fcfa(p.prix)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ))}

      <div aria-live="assertive" className="mt-4 empty:hidden">{erreur && <SAlert tone="warning" Icon={AlertTriangle}>{erreur}</SAlert>}</div>

      {prix !== null && (
        <>
          <p className="mt-4 text-[14px] leading-5 text-texte-2">À encaisser</p>
          <p className="chiffres text-[36px] leading-[44px] font-semibold text-encre/95">{fcfa(prix)}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 @md/page:grid-cols-3">
            {MOYENS_COMPTOIR.map((m) => {
              const court = m.id === "solde" && solde < prix;
              return (
                <SBtn key={m.id} tone="secondary" variant={m.id === "solde" ? "outlined" : "elevated"} className="min-h-12" disabled={enCours || court} onClick={() => void payer(m.id)}>
                  {m.id !== "solde" ? m.libelle : <span className="chiffres">{court ? `Solde trop court, ${fcfa(solde)}` : `Son solde, ${fcfa(solde)}`}</span>}
                </SBtn>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] leading-5 text-texte-2">Choisis comment il paie : le repas est noté payé et servi à ton nom</p>
        </>
      )}
      <SBtn variant="text" tone="secondary" className="mt-3" disabled={enCours} onClick={onLaisser}>Ne pas servir</SBtn>
      </div>
      {fenetre}
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
  // Réservé sans payer : le geste ouvre la caisse, qui encaisse avant de servir.
  const aEncaisser = ticket.apercu.genre === "a_payer";
  const habit = HABIT[TON[ticket.apercu.genre]];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-surface p-6 text-center shadow-[inset_0_0_0_1px_var(--h-filet)]" style={{ borderRadius: 24 }}>
      <div className="min-w-0">
        <p className="text-[14px] leading-5 text-texte-2">Ticket pour {ticket.quand}</p>
        <p className="mt-2 text-[28px] leading-9 font-semibold text-encre/95">{ticket.convive}</p>
        <p className="mt-1 text-[16px] leading-6 text-encre/75">{ticket.plat}</p>
        <Allergies etiquettes={ticket.allergies} enCause={ticket.enCause} />
        <p className="mt-2 font-mono text-[16px] leading-6 tracking-[0.2em] text-encre/80">{ticket.code}</p>
        {servable || aEncaisser ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            {aEncaisser && <p className="chiffres text-[16px] leading-6 font-semibold text-encre/95">{ticket.apercu.phrase}</p>}
            <SBtn tone="secondary" onClick={() => onServir(ticket.cle)}>{aEncaisser ? "Encaisser ce ticket" : "Servir ce ticket"}</SBtn>
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
