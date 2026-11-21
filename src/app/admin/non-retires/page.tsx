import type { Metadata } from "next";
import { repasNonRetires } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { exiger } from "@/lib/session";
import { NonRetiresClient } from "./non-retires-client";

export const metadata: Metadata = { title: "Repas non retirés" };

export default async function PageNonRetires() {
  await exiger("admin");
  return <NonRetiresClient {...await repasNonRetires(maintenant())} />;
}
