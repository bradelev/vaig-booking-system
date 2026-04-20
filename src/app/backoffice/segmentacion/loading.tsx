export default function SegmentacionLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-md bg-muted" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="flex flex-wrap gap-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-7 w-16 rounded-full bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="h-8 w-32 rounded-lg bg-muted mt-2" />
      </div>

      <div className="rounded-lg border border-gray-200 p-10 flex justify-center">
        <div className="h-4 w-64 rounded bg-muted" />
      </div>
    </div>
  );
}
