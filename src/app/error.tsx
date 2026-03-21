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
        <p className="text-4xl font-bold text-gray-900">Error</p>
        <p className="mt-2 text-sm text-gray-500">Ocurrió un error inesperado.</p>
        <button
          onClick={reset}
          className="mt-6 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
