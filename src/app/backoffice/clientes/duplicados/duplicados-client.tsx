"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GitMerge, X, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { mergeClients, type ParDuplicado } from "@/actions/clientes";

function isPlaceholderPhone(phone: string): boolean {
  return phone.startsWith("historico_") || phone.startsWith("migrated_nophone_");
}

function DistanceBadge({ dist }: { dist: number }) {
  if (dist === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
        mismo nombre
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-700">
      {dist === 1 ? "1 carácter" : "2 caracteres"} de diferencia
    </span>
  );
}

interface ClientCardProps {
  cliente: ParDuplicado["a"];
  isKeep: boolean;
  onSelect: () => void;
}

function ClientCard({ cliente, isKeep, onSelect }: ClientCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-all ${
        isKeep
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">
            {cliente.first_name} {cliente.last_name}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isPlaceholderPhone(cliente.phone) ? "Sin teléfono" : cliente.phone}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{cliente.total_sesiones}</span>{" "}
            {cliente.total_sesiones === 1 ? "sesión" : "sesiones"}
          </p>
        </div>
        <div
          className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 transition-colors ${
            isKeep ? "border-primary bg-primary" : "border-muted-foreground/30"
          }`}
        >
          {isKeep && (
            <svg viewBox="0 0 20 20" fill="white" className="h-full w-full p-0.5">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>
      {isKeep && (
        <p className="mt-2 text-[11px] font-medium text-primary">Mantener este</p>
      )}
    </button>
  );
}

interface ParRowProps {
  par: ParDuplicado;
  onIgnorar: () => void;
  onMerged: () => void;
}

function ParRow({ par, onIgnorar, onMerged }: ParRowProps) {
  // Default: keep the one with more sessions
  const defaultKeep =
    par.a.total_sesiones >= par.b.total_sesiones ? par.a.id : par.b.id;
  const [keepId, setKeepId] = useState(defaultKeep);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"ok" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const deleteId = keepId === par.a.id ? par.b.id : par.a.id;

  function handleMerge() {
    startTransition(async () => {
      try {
        await mergeClients(keepId, deleteId);
        setResult("ok");
        setTimeout(onMerged, 800);
      } catch (e) {
        setResult("error");
        setErrorMsg(e instanceof Error ? e.message : "Error desconocido");
      }
    });
  }

  if (result === "ok") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        Fusionado correctamente
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <DistanceBadge dist={par.distancia} />
        <button
          onClick={onIgnorar}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Ignorar
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ClientCard
          cliente={par.a}
          isKeep={keepId === par.a.id}
          onSelect={() => setKeepId(par.a.id)}
        />
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <ClientCard
          cliente={par.b}
          isKeep={keepId === par.b.id}
          onSelect={() => setKeepId(par.b.id)}
        />
      </div>

      {result === "error" && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          Seleccioná el cliente a mantener, luego fusioná.
          Las sesiones del otro se transferirán.
        </p>
        <button
          onClick={handleMerge}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitMerge className="h-4 w-4" />
          )}
          Fusionar
        </button>
      </div>
    </div>
  );
}

export default function DuplicadosClient({ pares: paresIniciales }: { pares: ParDuplicado[] }) {
  const [pares, setPares] = useState(paresIniciales);
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());

  const paresMostrados = pares.filter((p) => {
    const key = [p.a.id, p.b.id].sort().join("|");
    return !ignorados.has(key);
  });

  function ignorar(par: ParDuplicado) {
    const key = [par.a.id, par.b.id].sort().join("|");
    setIgnorados((prev) => new Set([...prev, key]));
  }

  function merged(par: ParDuplicado) {
    setPares((prev) => prev.filter((p) => p !== par));
  }

  if (paresMostrados.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
        <p className="mt-3 font-medium text-green-800">No hay pares pendientes</p>
        <p className="mt-1 text-sm text-green-700">
          Todos los duplicados fueron fusionados o ignorados.
        </p>
        <Link
          href="/backoffice/clientes"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Volver a clientes
        </Link>
      </div>
    );
  }

  const pendientes = paresMostrados.length;
  const total = paresIniciales.length;
  const resueltos = total - pendientes;

  return (
    <div className="space-y-4">
      {resueltos > 0 && (
        <p className="text-sm text-muted-foreground">
          {resueltos} de {total} pares resueltos — {pendientes} pendientes
        </p>
      )}

      {paresMostrados.map((par) => (
        <ParRow
          key={`${par.a.id}|${par.b.id}`}
          par={par}
          onIgnorar={() => ignorar(par)}
          onMerged={() => merged(par)}
        />
      ))}
    </div>
  );
}
