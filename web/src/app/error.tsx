"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="label">Deu ruim</p>
      <h1 className="text-2xl">Alguma coisa quebrou aqui.</h1>
      <p className="text-sm text-ink-soft">
        Não foi você. Tenta de novo — se continuar, espera alguns minutos e volta.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-clay px-6 py-2.5 font-medium text-paper"
        >
          Tentar de novo
        </button>
        <a href="/" className="rounded-full bg-paper-2 px-6 py-2.5 font-medium text-ink">
          Início
        </a>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-[10px] text-ink-soft">ref {error.digest}</p>
      )}
    </div>
  );
}
