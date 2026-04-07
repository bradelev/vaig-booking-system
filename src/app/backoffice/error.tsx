"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function BackofficeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">Ocurrió un error</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "Error inesperado al cargar esta sección."}
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    </div>
  );
}
