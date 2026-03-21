"use client";

import { useTransition } from "react";
import { toast } from "sonner";

export default function ConfirmPaymentButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          try {
            await action();
            toast.success("Pago confirmado");
          } catch {
            toast.error("Error al confirmar el pago");
          }
        })
      }
      disabled={isPending}
      className="rounded border border-green-300 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
    >
      {isPending ? "Confirmando..." : "Confirmar pago"}
    </button>
  );
}
