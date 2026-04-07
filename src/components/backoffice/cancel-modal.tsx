"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { cancelBooking, CancellationReason } from "@/actions/citas";
import Modal from "@/components/backoffice/modal";

const REASON_OPTIONS: { value: CancellationReason; label: string }[] = [
  { value: "client_request", label: "Solicitud del cliente" },
  { value: "professional_unavailable", label: "Profesional no disponible" },
  { value: "scheduling_conflict", label: "Conflicto de horario" },
  { value: "other", label: "Otro motivo" },
];

export default function CancelModal({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancellationReason>("client_request");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await cancelBooking(bookingId, reason, note.trim() || null, "admin");
        setOpen(false);
        toast.success("Reserva cancelada");
      } catch {
        toast.error("Error al cancelar la reserva");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        Cancelar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Cancelar reserva">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-foreground">Motivo</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as CancellationReason)}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm"
          >
            {REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium text-foreground">
            Nota adicional <span className="text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Detalles adicionales..."
            className="w-full rounded-lg border border-input px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Cancelando..." : "Confirmar cancelación"}
          </button>
        </div>
      </Modal>
    </>
  );
}
