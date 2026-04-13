export default function RecordatoriosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-6 w-36 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-200 mt-1.5" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-2">
            <div className="h-4 w-16 rounded bg-gray-200" />
            <div className="h-24 rounded bg-gray-100" />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="h-4 w-32 rounded bg-gray-200" />
            </div>
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-4 rounded bg-gray-200" />
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-28 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="md:sticky md:top-6">
          <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
          <div className="h-48 rounded-2xl bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
