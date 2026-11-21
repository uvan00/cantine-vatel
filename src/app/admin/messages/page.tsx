import type { Metadata } from "next";
import { messagesEnvoyes } from "@/lib/donnees-messages";
import { exiger } from "@/lib/session";
import { MessagesClient } from "./messages-client";

export const metadata: Metadata = { title: "Messages" };

export default async function PageMessages() {
  await exiger("admin");
  return <MessagesClient messages={await messagesEnvoyes()} />;
}
