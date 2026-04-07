export default function ClientesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-md bg-muted" />
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-56 rounded-lg bg-muted" />
        <div className="h-10 w-44 rounded-lg bg-muted" />
        <div className="h-10 w-40 rounded-lg bg-muted" />
        <div className="h-10 w-20 rounded-lg bg-muted" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="hidden md:block">
          <div className="bg-muted/50 px-4 py-3 flex gap-4">
            {[80, 64, 120, 48, 72, 56, 40].map((w, i) => (
              <div key={i} className="h-3 rounded bg-muted" style={{ width: w }} />
            ))}
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-4 border-t border-border">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-4 w-12 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-between">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-muted" />
          <div className="h-8 w-20 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
