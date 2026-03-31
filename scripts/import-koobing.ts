#!/usr/bin/env tsx
/**
 * Import Koobing appointments as VAIG bookings.
 *
 * Usage:
 *   npx tsx scripts/import-koobing.ts [--dry-run] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Default range: 2024-07-01 to today + 90 days (full Koobing history).
 */

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

async function main() {
  const { importKoobingAppointments } = await import("../src/lib/koobing/import-engine");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const fromArg = args.find((a, i) => args[i - 1] === "--from");
  const toArg = args.find((a, i) => args[i - 1] === "--to");

  const today = new Date().toISOString().split("T")[0];
  const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const from = fromArg ?? "2024-07-01";
  const to = toArg ?? ninetyDaysLater;

  console.log(`\n🔄 Koobing Import${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Range: ${from} → ${to}`);
  console.log("   Running...\n");

  const result = await importKoobingAppointments({ from, to, dryRun });

  console.log(`✅ Imported: ${result.imported}`);
  console.log(`⏭️  Skipped (already exists): ${result.skipped}`);
  console.log(`❌ Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  if (result.created.length > 0 && dryRun) {
    console.log("\nWould create:");
    result.created.slice(0, 20).forEach((c) =>
      console.log(`  [${c.date}] ${c.name} — ${c.service}`)
    );
    if (result.created.length > 20) {
      console.log(`  ... and ${result.created.length - 20} more`);
    }
  }

  console.log(`\nToday: ${today}`);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
