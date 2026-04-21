import { redirect } from "next/navigation";

export default function SesionesNuevaRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ semana?: string }>;
}) {
  void searchParams;
  redirect("/backoffice/sesiones");
}
