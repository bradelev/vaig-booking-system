export default function ServiciosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-md bg-muted" />
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>

      {/* Category groups */}
      {[...Array(3)].map((_, g) => (
        <div key={g} className="rounded-lg border border-border bg-card shadow-sm">
          <div className="px-4 py-3 border-b border-border">
            <div className="h-5 w-40 rounded bg-muted" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
