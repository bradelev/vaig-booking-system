"use client";

export default function Error({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-4xl font-bold text-foreground">Error</p>
        <p className="mt-2 text-sm text-muted-foreground">Ocurrió un error inesperado.</p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
