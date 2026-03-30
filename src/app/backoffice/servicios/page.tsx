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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: raw } = await client
    .from("services")
    .select(
      `id, name, description, duration_minutes, price, deposit_amount, is_active,
       professionals(name)`
    )
    .order("name");

  const servicios = (raw ?? []) as Servicio[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
        <Link
          href="/backoffice/servicios/nuevo"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Nuevo servicio
        </Link>
      </div>

      <ServiciosTable servicios={servicios} />
    </div>
  );
}
