export default function BackofficeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Greeting skeleton */}
      <div>
        <div className="h-7 w-44 rounded-md bg-muted" />
        <div className="mt-1.5 h-4 w-56 rounded-md bg-muted" />
      </div>

      {/* Stats row skeleton — 3 cards matching Dashboard */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border border-l-4 border-l-primary/30 bg-card p-6 shadow-sm">
            <div className="flex justify-between">
              <div>
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="mt-3 h-8 w-16 rounded bg-muted" />
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <div className="h-9 w-9 rounded-lg bg-muted" />
            <div>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-1 h-3 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="h-5 w-28 rounded bg-muted" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
