"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SegmentationClient, SegmentationFilterCriteria } from "@/actions/segmentacion";
import {
  createCampaignFromSegmentation,
  checkDuplicateCampaignName,
  getCooldownOverlapCount,
} from "@/actions/campaigns";
import { formatFilterCriteria } from "@/lib/campaigns/format-filter-criteria";
import { MAX_DAILY_SEND, MIN_COPY_LENGTH, DEFAULT_COOLDOWN_DAYS } from "@/lib/campaigns/constants";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface CreateCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClients: SegmentationClient[];
  criteria: SegmentationFilterCriteria;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("598")) return `+${digits}`;
  if (digits.startsWith("09") || digits.startsWith("0")) return `+598${digits.slice(1)}`;
  return `+598${digits}`;
}

export default function CreateCampaignModal({
  open,
  onOpenChange,
  selectedClients,
  criteria,
}: CreateCampaignModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState("");
  const [showAllClients, setShowAllClients] = useState(false);

  const [duplicateWarning, setDuplicateWarning] = useState<{ exists: boolean; createdAt?: string }>({ exists: false });
  const [overlapCount, setOverlapCount] = useState(0);

  const count = selectedClients.length;
  const filterRows = formatFilterCriteria(criteria);

  // Suggestion for campaign name
  const today = new Date();
  const week = Math.ceil(today.getDate() / 7);
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  const namePlaceholder = `${year}-${month}-W${week}-tipo-servicio`;

  // Check cooldown overlap on open
  useEffect(() => {
    if (!open || selectedClients.length === 0) return;
    const ids = selectedClients.map((c) => c.id);
    getCooldownOverlapCount(ids).then(setOverlapCount).catch(() => {});
  }, [open, selectedClients]);

  // Check duplicate name (debounced); clears warning immediately when name is empty
  useEffect(() => {
    const trimmed = name.trim();
    const timer = setTimeout(() => {
      if (!trimmed) {
        setDuplicateWarning({ exists: false });
        return;
      }
      checkDuplicateCampaignName(trimmed).then(setDuplicateWarning).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [name]);

  const bodyTooShort = body.trim().length > 0 && body.trim().length < MIN_COPY_LENGTH;
  const bodyEmpty = body.trim().length === 0;
  const isValid = name.trim().length > 0 && body.trim().length >= MIN_COPY_LENGTH && count > 0;

  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!isValid) return;
    startTransition(async () => {
      try {
        const result = await createCampaignFromSegmentation({
          name: name.trim(),
          body: body.trim(),
          notes: notes.trim() || undefined,
          clientIds: selectedClients.map((c) => c.id),
          filterCriteria: criteria as Record<string, unknown>,
        });
        toast.success(`Campaña creada — ${count} envío${count !== 1 ? "s" : ""} registrado${count !== 1 ? "s" : ""}`);
        onOpenChange(false);
        router.push(`/backoffice/automatizaciones/${result.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear la campaña");
      }
    });
  }

  // Effort estimation: ~4 seconds per recipient
  const estimatedMinutes = Math.ceil(count * 4 / 60);

  const cooldownDays = criteria.cooldownDias ?? DEFAULT_COOLDOWN_DAYS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear campaña</DialogTitle>
          <DialogDescription>
            {count === 0
              ? "No hay clientas seleccionadas"
              : `Vas a crear una campaña para ${count} clienta${count !== 1 ? "s" : ""} seleccionada${count !== 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Daily limit warning */}
          {count > MAX_DAILY_SEND && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Esta campaña tiene <strong>{count} envíos</strong>. El máximo recomendado por día es{" "}
                <strong>{MAX_DAILY_SEND}</strong> para no afectar la reputación del número.
                Considerá dividir en {Math.ceil(count / MAX_DAILY_SEND)} días o reducir la selección.
              </span>
            </div>
          )}

          {/* Cooldown overlap warning */}
          {overlapCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{overlapCount} clienta{overlapCount !== 1 ? "s" : ""}</strong> de la selección recibió{overlapCount !== 1 ? "ron" : ""} una campaña en los últimos{" "}
                <strong>{cooldownDays} días</strong>. Esto puede afectar la tasa de respuesta y quemar el canal.
              </span>
            </div>
          )}

          {/* Client preview */}
          {count > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">Clientas seleccionadas</p>
              <ul className="text-sm text-gray-600 space-y-0.5">
                {selectedClients.slice(0, showAllClients ? undefined : 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-gray-400 shrink-0" />
                    {c.first_name} {c.last_name}
                    <span className="text-gray-400 text-xs">{normalizePhone(c.phone)}</span>
                  </li>
                ))}
              </ul>
              {count > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllClients((p) => !p)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showAllClients ? (
                    <><ChevronUp className="h-3 w-3" /> Ver menos</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> ... y {count - 5} más</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Filter snapshot */}
          {filterRows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">Filtros aplicados</p>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
                {filterRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-medium text-gray-700 min-w-[110px]">{row.label}:</span>
                    <span>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="campaign-name">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePlaceholder}
                className={duplicateWarning.exists ? "border-amber-400" : ""}
              />
              {duplicateWarning.exists && duplicateWarning.createdAt && (
                <p className="text-xs text-amber-700">
                  Ya existe una campaña con este nombre (creada el{" "}
                  {new Date(duplicateWarning.createdAt).toLocaleDateString("es-AR")}). ¿Querés continuar o renombrar?
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700" htmlFor="campaign-body">
                  Copy del mensaje <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs ${body.length < MIN_COPY_LENGTH ? "text-red-500" : "text-gray-400"}`}>
                  {body.length}/{MIN_COPY_LENGTH} mín.
                </span>
              </div>
              <textarea
                id="campaign-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Texto del mensaje que se enviará a las clientas seleccionadas..."
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${
                  bodyTooShort ? "border-red-300" : "border-input"
                }`}
              />
              {bodyTooShort && (
                <p className="text-xs text-red-600">
                  El copy debe tener al menos {MIN_COPY_LENGTH} caracteres.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="campaign-notes">
                Notas internas <span className="text-xs text-gray-400">(opcional)</span>
              </label>
              <textarea
                id="campaign-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Contexto, objetivo de la campaña, instrucciones para el equipo..."
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400 order-2 sm:order-1">
            Estimación: enviar {count} mensaje{count !== 1 ? "s" : ""} manualmente lleva ~{estimatedMinutes} min
          </p>
          <div className="flex gap-2 order-1 sm:order-2">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isPending || bodyEmpty}
            >
              {isPending ? "Creando..." : "Crear campaña"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
