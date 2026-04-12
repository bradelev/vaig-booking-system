export default function InboxLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 rounded-md bg-muted" />
          <div className="mt-1 h-4 w-48 rounded-md bg-muted" />
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-muted" />
          <div className="h-8 w-24 rounded-lg bg-muted" />
          <div className="h-8 w-24 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-64 rounded-md bg-muted" />
      </div>

      {/* Conversation rows */}
      <div className="divide-y rounded-lg border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-10 rounded bg-muted" />
              </div>
              <div className="h-3 w-48 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
