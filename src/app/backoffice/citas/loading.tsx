export default function CitasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-20 rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-lg bg-muted" />
          <div className="h-10 w-32 rounded-lg bg-muted" />
          <div className="h-10 w-24 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-lg bg-muted" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
