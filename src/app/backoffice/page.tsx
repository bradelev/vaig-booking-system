import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Campañas" };

export default function BackofficePage() {
  redirect("/backoffice/automatizaciones");
}
