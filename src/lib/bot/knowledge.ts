import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeBase, ServiceInfo, ProfessionalInfo, PackageInfo } from "./types";

// Cache knowledge base in memory for a short TTL to avoid repeated DB queries
let cache: { data: KnowledgeBase; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches active services and professionals from Supabase and builds
 * a structured knowledge base for the LLM context.
 */
export async function buildKnowledgeBase(): Promise<KnowledgeBase> {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return cache.data;
  }

  const supabase = createAdminClient();

  const [servicesResult, professionalsResult, packagesResult] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price, deposit_amount, default_professional_id, category")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("professionals")
      .select("id, name, specialties")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("service_packages")
      .select("name, session_count, price, services(name)")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (servicesResult.error) {
    throw new Error(`Failed to fetch services: ${servicesResult.error.message}`);
  }

  if (professionalsResult.error) {
    throw new Error(`Failed to fetch professionals: ${professionalsResult.error.message}`);
  }

  type ServiceRow = {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    deposit_amount: number;
    default_professional_id: string | null;
    category: string | null;
  };

  type ProfessionalRow = {
    id: string;
    name: string;
    specialties: string[] | null;
  };

  type PackageRow = {
    name: string;
    session_count: number;
    price: number;
    services: { name: string } | null;
  };

  const services: ServiceInfo[] = (
    (servicesResult.data ?? []) as ServiceRow[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    price: Number(s.price),
    depositAmount: Number(s.deposit_amount),
    defaultProfessionalId: s.default_professional_id,
    category: s.category,
  }));

  const professionals: ProfessionalInfo[] = (
    (professionalsResult.data ?? []) as ProfessionalRow[]
  ).map((p) => ({
    id: p.id,
    name: p.name,
    specialties: p.specialties,
  }));

  const packages: PackageInfo[] = (
    (packagesResult.data ?? []) as PackageRow[]
  )
    .filter((pkg) => pkg.services !== null)
    .map((pkg) => ({
      packageName: pkg.name,
      serviceName: pkg.services!.name,
      sessionCount: pkg.session_count,
      price: Number(pkg.price),
      pricePerSession: Math.round(Number(pkg.price) / pkg.session_count),
    }));

  const knowledge: KnowledgeBase = {
    services,
    professionals,
    packages,
    generatedAt: new Date(),
  };

  cache = { data: knowledge, expiresAt: now + CACHE_TTL_MS };

  return knowledge;
}

/**
 * Formats the knowledge base as a plain-text context string for the LLM prompt.
 */
export function formatKnowledgeForLLM(knowledge: KnowledgeBase): string {
  const lines: string[] = [
    "=== VAIG — Servicios disponibles ===",
    "",
  ];

  for (const service of knowledge.services) {
    lines.push(`📌 ${service.name}`);
    if (service.description) {
      lines.push(`   ${service.description}`);
    }
    lines.push(`   Duración: ${service.durationMinutes} minutos`);
    lines.push(`   Precio: $${service.price.toLocaleString("es-AR")}`);
    lines.push(`   Seña: $${service.depositAmount.toLocaleString("es-AR")}`);
    lines.push("");
  }

  lines.push("=== Profesionales ===", "");

  for (const prof of knowledge.professionals) {
    lines.push(`👤 ${prof.name}`);
    if (prof.specialties && prof.specialties.length > 0) {
      lines.push(`   Especialidades: ${prof.specialties.join(", ")}`);
    }
    lines.push("");
  }

  if (knowledge.packages.length > 0) {
    lines.push("=== Packs de sesiones ===", "");

    for (const pkg of knowledge.packages) {
      lines.push(`📦 ${pkg.packageName}`);
      lines.push(`   Servicio: ${pkg.serviceName}`);
      lines.push(`   Sesiones: ${pkg.sessionCount}`);
      lines.push(`   Precio total: $${pkg.price.toLocaleString("es-AR")}`);
      lines.push(`   Precio por sesión: $${pkg.pricePerSession.toLocaleString("es-AR")}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Clears the in-memory cache (useful for testing or after data changes).
 */
export function clearKnowledgeCache(): void {
  cache = null;
}
