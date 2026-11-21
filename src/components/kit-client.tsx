"use client";

import { CheckCircle2, Mail, Star } from "@/components/icons";
import { SAlert, SEmpty, type Ton } from "@/components/sneat";

// Les composants du kit (sneat.tsx) sont des composants client. Une page SERVEUR ne peut pas leur passer une icône,
// qui est une fonction : React refuse, et la page plante (erreur 500). Ces enveloppes reçoivent le NOM de l'icône, une
// simple chaîne, et choisissent l'icône de ce côté-ci. Garde-fou : src/lib/icones-serveur.test.ts.

const ICONES = { etoile: Star, lettre: Mail, coche: CheckCircle2 } as const;
export type NomIcone = keyof typeof ICONES;

/** SAlert du kit, pour une page serveur. */
export function AlerteIcone({ icone, children, tone, action }: {
  icone: NomIcone; children: React.ReactNode; tone?: Ton; action?: React.ReactNode;
}) {
  return <SAlert Icon={ICONES[icone]} tone={tone} action={action}>{children}</SAlert>;
}

/** SEmpty du kit, pour une page serveur. */
export function VideIcone({ icone, title, hint, action }: { icone: NomIcone; title: string; hint?: string; action?: React.ReactNode }) {
  return <SEmpty Icon={ICONES[icone]} title={title} hint={hint} action={action} />;
}
