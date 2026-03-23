"use client";

export default function AutomatizacionesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-lg font-semibold text-red-800">Ocurrió un error</p>
        <p className="mt-1 text-sm text-red-600">
          {error.message || "Error inesperado al cargar automatizaciones."}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
