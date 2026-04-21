import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ServiciosTable from "./servicios-table";

export const metadata: Metadata = { title: "Servicios" };

interface Servicio {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  deposit_amount: number;
  is_active: boolean;
  professionals: { name: string } | null;
}

export default async function ServiciosPage() {
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("services")
    .select(
      `id, name, description, duration_minutes, price, deposit_amount, is_active,
       professionals(name)`
    )
    .order("name");

  const servicios = (raw ?? []) as unknown as Servicio[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Servicios</h1>
        <Link
          href="/backoffice/servicios/nuevo"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nuevo servicio
        </Link>
      </div>

      <ServiciosTable servicios={servicios} />
    </div>
  );
}
