import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveTemplates } from "@/actions/templates";

export const metadata: Metadata = { title: "Templates" };
import { TEMPLATE_KEYS, TEMPLATE_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/templates";

export default async function TemplatesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any;

  const { data } = await client.from("system_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data ?? []) {
    cfg[row.key as string] = row.value as string;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Templates de mensajes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Editá los mensajes que el bot envía por WhatsApp. Usá los placeholders indicados — serán reemplazados automáticamente al enviar.
        </p>
      </div>

      <form action={saveTemplates} className="space-y-6">
        {TEMPLATE_KEYS.map((key) => (
          <div key={key} className="rounded-lg border bg-white p-6 shadow-sm space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{TEMPLATE_LABELS[key]}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Placeholders disponibles:{" "}
                {TEMPLATE_PLACEHOLDERS[key].map((p) => (
                  <code key={p} className="mx-0.5 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                    {p}
                  </code>
                ))}
              </p>
            </div>
            <textarea
              name={key}
              defaultValue={cfg[key] ?? ""}
              rows={6}
              className="block w-full rounded-lg border border-input px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none resize-y"
            />
          </div>
        ))}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Guardar templates
          </button>
        </div>
      </form>
    </div>
  );
}
