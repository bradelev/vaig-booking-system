export default function MetricasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="h-7 w-52 rounded-md bg-muted" />
          <div className="mt-1 h-4 w-32 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-9 w-16 rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      {/* Funnel cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
            <div className="mt-3 h-8 w-12 rounded bg-muted" />
            <div className="mt-2 h-3 w-24 rounded bg-muted" />
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <div className="h-5 w-36 rounded bg-muted" />
            </div>
            <div className="p-6">
              <div className="h-[240px] rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
