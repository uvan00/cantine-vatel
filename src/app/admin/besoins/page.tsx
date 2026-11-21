import type { Metadata } from "next";
import { z } from "zod";
import { vueBesoins } from "@/lib/donnees-admin";
import { vueAchats, vueCouts, vueReserve } from "@/lib/donnees-stock";
import { aujourdhui, maintenant } from "@/lib/horloge";
import { exiger } from "@/lib/session";
import { AchatsClient } from "./achats-client";
import { BesoinsClient } from "./besoins-client";
import { CoutsClient } from "./couts-client";
import { ReserveClient } from "./reserve-client";

export const metadata: Metadata = { title: "Besoins de la cuisine" };

// Quatre vues, par `?vue=` : le jour (par défaut), la réserve, les achats, les coûts (lot 2 des besoins, 21/11/2026).
const Vue = z.enum(["jour", "reserve", "achats", "couts"]).catch("jour");
/** Demain par défaut (la cuisine prépare la veille) ; `?jour=aujourdhui` pour aujourd'hui. */
const Jour = z.enum(["aujourdhui", "demain"]).catch("demain");
/** Le bon de commande de demain par défaut ; `?periode=semaine` pour les sept jours qui viennent. */
const Periode = z.enum(["demain", "semaine"]).catch("demain");

export default async function PageBesoins({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const sp = await searchParams;
  const vue = Vue.parse(sp.vue);
  if (vue === "reserve") return <ReserveClient vue={await vueReserve(maintenant())} aujourdhui={aujourdhui()} />;
  if (vue === "achats") {
    const periode = Periode.parse(sp.periode);
    return <AchatsClient key={periode} vue={await vueAchats(periode, maintenant())} aujourdhui={aujourdhui()} />;
  }
  if (vue === "couts") return <CoutsClient vue={await vueCouts()} />;
  const cle = Jour.parse(sp.jour);
  return <BesoinsClient key={cle} vue={await vueBesoins(cle, maintenant())} />;
}
