export default function AutomatizacionesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-9 w-32 rounded bg-gray-200" />
      </div>
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-3 hidden md:flex gap-8">
          {["Nombre", "Estado", "Programada", "Destinatarios", "Enviados", "Acciones"].map((h) => (
            <div key={h} className="h-3 w-20 rounded bg-gray-200" />
          ))}
        </div>
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-6">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="h-4 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
