import type { Metadata } from "next";
import { EnTeteEspace } from "@/components/coque-espace";
import { VideIcone } from "@/components/kit-client";
import { SChip } from "@/components/sneat";
import { mesMessages } from "@/lib/donnees-messages";
import { exiger } from "@/lib/session";
import { MarquerLus } from "./lus";

// Les messages de la cantine (bonus du lot 2) : les épinglés d'abord, puis les plus récents. Les afficher ici les marque
// lus : la cantine voit combien de personnes les ont lus, et la pastille de l'onglet s'éteint.
export const metadata: Metadata = { title: "Messages" };

export default async function PageMessages() {
  const moi = await exiger("convive", "parent");
  const messages = await mesMessages(moi);
  const nonLus = messages.filter((m) => !m.lu).map((m) => m.id);

  return (
    <main>
      <EnTeteEspace titre="Messages" sousTitre="Ce que la cantine t'écrit" />
      {messages.length === 0 ? (
        <VideIcone icone="lettre" title="Aucun message pour l'instant" hint="Quand la cantine t'écrit, son message arrive ici" />
      ) : (
        <ul className="space-y-3 px-4">
          {messages.map((m) => (
            <li key={m.id}>
              <article className="rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4">
                <div className="flex min-h-6 items-center justify-between gap-3">
                  <p className="chiffres text-[13px] leading-5 text-texte-2">{m.quand}</p>
                  <div className="flex gap-2">
                    {!m.lu && <SChip size="sm">Nouveau</SChip>}
                    {m.epingle && <SChip size="sm" tone="secondary">Épinglé</SChip>}
                  </div>
                </div>
                <h2 className="mt-1 text-[17px] leading-6">{m.titre}</h2>
                <p className="mt-1 text-[15px] leading-6 whitespace-pre-line text-encre/90">{m.texte}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
      {nonLus.length > 0 && <MarquerLus ids={nonLus} />}
    </main>
  );
}
