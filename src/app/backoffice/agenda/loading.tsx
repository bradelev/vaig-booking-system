export default function AgendaLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="h-10 w-36 rounded-lg bg-muted" />
          <div className="h-10 w-10 rounded-lg bg-muted" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      {/* Professional chips */}
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-muted" />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="px-2 py-3 border-r border-border last:border-r-0">
              <div className="h-4 w-16 mx-auto rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Time slots */}
        <div className="h-[600px] bg-muted/30" />
      </div>
    </div>
  );
}
