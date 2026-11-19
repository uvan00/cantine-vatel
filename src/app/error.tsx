"use client";

// Une panne au rendu d'une page (la base qui ne répond pas, par exemple) : on le dit simplement, et on propose de réessayer.
export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-[24px] leading-8">Quelque chose a coincé</h1>
        <p className="mt-2 text-[16px] leading-6 text-encre/75">Ce n&apos;est pas toi, c&apos;est nous. Réessaie dans un instant</p>
        <button type="button" onClick={reset} className="hb hb--encre mt-6">Réessayer</button>
      </div>
    </main>
  );
}
