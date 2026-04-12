export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 space-y-3 px-4 py-3">
        {/* Inbound message */}
        <div className="flex justify-start">
          <div className="h-12 w-48 rounded-2xl rounded-bl-md bg-muted" />
        </div>
        {/* Outbound message */}
        <div className="flex justify-end">
          <div className="h-16 w-56 rounded-2xl rounded-br-md bg-muted" />
        </div>
        {/* Inbound */}
        <div className="flex justify-start">
          <div className="h-10 w-40 rounded-2xl rounded-bl-md bg-muted" />
        </div>
        {/* Outbound */}
        <div className="flex justify-end">
          <div className="h-20 w-52 rounded-2xl rounded-br-md bg-muted" />
        </div>
        {/* Inbound */}
        <div className="flex justify-start">
          <div className="h-14 w-44 rounded-2xl rounded-bl-md bg-muted" />
        </div>
      </div>

      {/* Reply box */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <div className="h-10 flex-1 rounded-md bg-muted" />
          <div className="h-10 w-10 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
