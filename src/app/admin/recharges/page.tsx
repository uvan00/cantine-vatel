import type { Metadata } from "next";
import { vueRecharges } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { CANTINE, exiger } from "@/lib/session";
import { RechargesClient } from "./recharges-client";

export const metadata: Metadata = { title: "Recharges" };

export default async function PageRecharges() {
  await exiger(...CANTINE);
  return <RechargesClient initial={await vueRecharges(maintenant())} />;
}
