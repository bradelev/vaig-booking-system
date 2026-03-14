import { createClient } from "@/lib/supabase/server";
import { saveSystemConfig } from "@/actions/schedule";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data } = await client.from("system_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data ?? []) {
    cfg[row.key as string] = row.value as string;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      <form action={saveSystemConfig} className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-gray-800 border-b pb-2">Negocio</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre del negocio</label>
          <input
            name="business_name"
            defaultValue={cfg["business_name"] ?? "VAIG"}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Teléfono admin (WhatsApp)</label>
          <input
            name="admin_phone"
            defaultValue={cfg["admin_phone"] ?? ""}
            placeholder="ej: 59891374904"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Número completo con código de país, sin +. Recibe notificaciones del bot.</p>
        </div>

        <h2 className="text-base font-semibold text-gray-800 border-b pb-2 pt-2">Pagos — Transferencia bancaria</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">CBU</label>
          <input
            name="cbu"
            defaultValue={cfg["cbu"] ?? ""}
            placeholder="0000000000000000000000"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Alias</label>
          <input
            name="cbu_alias"
            defaultValue={cfg["cbu_alias"] ?? ""}
            placeholder="ALIAS.NEGOCIO"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <h2 className="text-base font-semibold text-gray-800 border-b pb-2 pt-2">Pagos — Mercado Pago</h2>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="mp_enabled"
            name="mp_enabled"
            defaultChecked={cfg["mp_enabled"] === "true"}
            value="true"
            className="h-4 w-4 rounded border-gray-300 text-gray-900"
          />
          <label htmlFor="mp_enabled" className="text-sm font-medium text-gray-700">
            Habilitar link de pago MP en mensajes del bot
          </label>
        </div>

        <h2 className="text-base font-semibold text-gray-800 border-b pb-2 pt-2">Reservas</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cancelación automática (horas)</label>
            <input
              name="auto_cancel_hours"
              type="number"
              min={1}
              max={72}
              defaultValue={cfg["auto_cancel_hours"] ?? "24"}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">Cancela reservas pending sin pago después de X horas</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Buffer entre turnos (min)</label>
            <input
              name="buffer_minutes"
              type="number"
              min={0}
              max={60}
              defaultValue={cfg["buffer_minutes"] ?? "0"}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  );
}
