"use client";

import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { LOCAL_TIMEZONE, localInputToISO } from "@/lib/timezone";
import {
  createCampaign,
  createAndScheduleCampaign,
  updateCampaign,
  uploadCampaignImage,
  scheduleCampaign,
  updateClientInline,
} from "@/actions/campaigns";
import CampaignRecipientsTable, { type RecipientClient } from "@/components/backoffice/campaign-recipients-table";

interface CampaignFormProps {
  campaign?: {
    id: string;
    name: string;
    body: string;
    image_url: string | null;
    scheduled_at: string | null;
    target_all: boolean;
    status: string;
    recipient_ids: string[];
    initialRecipients?: RecipientClient[];
  };
}

function toLocalDatetimeValue(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: LOCAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatTimeART(isoString: string | null): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("es-AR", {
    timeZone: LOCAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CampaignForm({ campaign }: CampaignFormProps) {
  const isEdit = !!campaign;
  const isDraft = !campaign || campaign.status === "draft";

  const [name, setName] = useState(campaign?.name ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [imageUrl, setImageUrl] = useState(campaign?.image_url ?? "");
  const [imagePreview, setImagePreview] = useState(campaign?.image_url ?? "");
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeValue(campaign?.scheduled_at ?? null));
  const [selectedClients, setSelectedClients] = useState<RecipientClient[]>(
    campaign?.initialRecipients ?? []
  );
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fileRef = useRef<HTMLInputElement>(null);

  const minDatetime = toLocalDatetimeValue(new Date().toISOString());

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("body", body);
    fd.append("image_url", imageUrl);
    fd.append("target_all", "false");
    fd.append("scheduled_at", scheduledAt);
    for (const c of selectedClients) {
      fd.append("client_ids", c.id);
    }
    return fd;
  }

  function handleSaveDraft() {
    startTransition(async () => {
      try {
        const fd = buildFormData();
        if (isEdit && campaign) {
          await updateCampaign(campaign.id, fd);
        } else {
          await createCampaign(fd);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function handleScheduleNew() {
    if (!scheduledAt) {
      toast.error("Configurá una fecha y hora de envío antes de programar");
      return;
    }
    startTransition(async () => {
      try {
        const fd = buildFormData();
        await createAndScheduleCampaign(fd);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al programar");
      }
    });
  }

  async function handleScheduleExisting() {
    if (!campaign) return;
    startTransition(async () => {
      try {
        await scheduleCampaign(campaign.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al programar");
      }
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadCampaignImage(fd);
      setImageUrl(result.url);
    } catch (err) {
      toast.error(`Error al subir imagen: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setImagePreview(imageUrl);
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    setImageUrl("");
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleAddClient(client: RecipientClient) {
    setSelectedClients((prev) => {
      if (prev.some((c) => c.id === client.id)) return prev;
      return [...prev, client];
    });
  }

  function handleRemoveClient(clientId: string) {
    setSelectedClients((prev) => prev.filter((c) => c.id !== clientId));
  }

  async function handleUpdateClient(
    clientId: string,
    patch: { first_name?: string; last_name?: string; phone?: string }
  ) {
    await updateClientInline(clientId, patch);
    setSelectedClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, ...patch } : c))
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* LEFT: Form fields */}
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la campaña
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Opcional — si lo dejás vacío usamos la fecha"
              disabled={!isDraft}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Si lo dejás vacío se autocompleta con la fecha y hora de creación.
            </p>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
            {imagePreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-32 w-auto rounded-lg border border-gray-200 object-cover"
                />
                {isDraft && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : isDraft ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {uploading ? "Subiendo..." : "Adjuntar imagen"}
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Message body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribí tu mensaje..."
              rows={5}
              disabled={!isDraft}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Scheduled at */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora de envío
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minDatetime}
              disabled={!isDraft}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">Timezone: {LOCAL_TIMEZONE}.</p>
          </div>

          {/* Recipients — Excel table */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destinatarios</label>
            <CampaignRecipientsTable
              clients={selectedClients}
              disabled={!isDraft}
              onAdd={handleAddClient}
              onRemove={handleRemoveClient}
              onUpdate={handleUpdateClient}
            />
          </div>

          {/* Action buttons */}
          {isDraft && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isPending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Guardar borrador"}
              </button>
              {isEdit ? (
                <button
                  type="button"
                  onClick={handleScheduleExisting}
                  disabled={isPending || !scheduledAt}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Procesando..." : "Programar envío"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleScheduleNew}
                  disabled={isPending || !scheduledAt}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Procesando..." : "Programar envío"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: WhatsApp preview (sticky on desktop) */}
        <div className="md:sticky md:top-6 md:self-start">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Vista previa</p>
          <div
            className="rounded-2xl p-4 max-w-xs mx-auto shadow-sm"
            style={{ backgroundColor: "#E5DDD5" }}
          >
            <div
              className="rounded-2xl rounded-tl-none overflow-hidden max-w-[280px] ml-auto shadow"
              style={{ backgroundColor: "#DCF8C6" }}
            >
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full object-cover max-h-48 rounded-t-2xl rounded-tl-none"
                />
              )}
              <div className="px-3 py-2">
                {body ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-snug">
                    {"Hola {nombre}, te escribimos desde VAIG Depilación Láser.\n\n"}
                    {body}
                    {"\n\nCualquier consulta estamos a tu disposición."}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Tu mensaje aparecerá aquí...</p>
                )}
                <div className="mt-1 flex justify-end">
                  <span className="text-xs text-gray-500">
                    {scheduledAt
                      ? formatTimeART(localInputToISO(scheduledAt))
                      : new Date().toLocaleTimeString("es-AR", {
                          timeZone: LOCAL_TIMEZONE,
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    {" ✓✓"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta info */}
          <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 p-3 space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Destinatarios</span>
              <span className="font-medium text-gray-700">
                {selectedClients.length} seleccionado{selectedClients.length !== 1 ? "s" : ""}
              </span>
            </div>
            {scheduledAt && (
              <div className="flex justify-between">
                <span>Programado</span>
                <span className="font-medium text-gray-700">
                  {new Date(localInputToISO(scheduledAt)).toLocaleString("es-AR", {
                    timeZone: LOCAL_TIMEZONE,
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
