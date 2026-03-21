import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <p className="mt-2 text-xl font-semibold text-gray-900">Página no encontrada</p>
        <p className="mt-1 text-sm text-gray-500">
          La página que buscás no existe o fue movida.
        </p>
        <Link
          href="/backoffice"
          className="mt-6 inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
