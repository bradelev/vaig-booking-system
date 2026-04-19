import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSystemConfig } from "@/actions/schedule";
import { LOCAL_TIMEZONE } from "@/lib/timezone";

const TIMEZONE_OPTIONS = [
  { value: "America/Montevideo", label: "America/Montevideo (UYT, UTC-3)" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires (ART, UTC-3)" },
  { value: "America/Santiago", label: "America/Santiago (CLT, UTC-3/-4)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT, UTC-3)" },
  { value: "America/Bogota", label: "America/Bogota (COT, UTC-5)" },
  { value: "UTC", label: "UTC" },
];

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;

  const { data } = await client.from("system_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data ?? []) {
    cfg[row.key as string] = row.value as string;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configuración</h1>

      <form action={saveSystemConfig} className="rounded-lg border bg-card p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-foreground border-b pb-2">Negocio</h2>

        <div>
          <label className="block text-sm font-medium text-foreground">Nombre del negocio</label>
          <input
            name="business_name"
            defaultValue={cfg["business_name"] ?? "VAIG"}
            className="mt-1 block w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Teléfono admin</label>
          <input
            name="admin_phone"
            defaultValue={cfg["admin_phone"] ?? ""}
            placeholder="ej: 59800000000"
            className="mt-1 block w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">Número completo con código de país, sin +.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Timezone local</label>
          <select
            name="local_timezone"
            defaultValue={cfg["local_timezone"] ?? LOCAL_TIMEZONE}
            className="mt-1 block w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Se usa para mostrar horarios y guardar citas correctamente. Cambiar requiere reiniciar el servidor.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  );
}
