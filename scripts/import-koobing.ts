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

  const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const globalFrom = fromArg ?? "2024-07-01";
  const globalTo = toArg ?? ninetyDaysLater;

  // Split into 3-month chunks to avoid Koobing API timeout on large ranges
  const chunks: Array<{ from: string; to: string }> = [];
  const cursor = new Date(globalFrom + "T12:00:00");
  const end = new Date(globalTo + "T12:00:00");
  while (cursor < end) {
    const chunkFrom = cursor.toISOString().split("T")[0];
    cursor.setMonth(cursor.getMonth() + 3);
    const chunkTo = cursor > end ? end.toISOString().split("T")[0] : cursor.toISOString().split("T")[0];
    chunks.push({ from: chunkFrom, to: chunkTo });
  }

  console.log(`\n🔄 Koobing Import${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Range: ${globalFrom} → ${globalTo} (${chunks.length} chunks of ~3 months)`);
  console.log("");

  let totalImported = 0;
  let totalSkipped = 0;
  let totalUnmatched = 0;
  const allErrors: string[] = [];

  for (const chunk of chunks) {
    process.stdout.write(`   ${chunk.from} → ${chunk.to} ... `);
    const result = await importKoobingAppointments({ from: chunk.from, to: chunk.to, dryRun });
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalUnmatched += result.unmatched_service;
    allErrors.push(...result.errors);
    console.log(`imported=${result.imported} skipped=${result.skipped} unmatched=${result.unmatched_service} errors=${result.errors.length}`);
  }

  console.log(`\n✅ Total imported: ${totalImported}`);
  console.log(`⏭️  Total skipped (already exists): ${totalSkipped}`);
  console.log(`⚠️  Sin servicio matcheado: ${totalUnmatched}`);
  console.log(`❌ Total errors: ${allErrors.length}`);

  if (allErrors.length > 0) {
    console.log("\nErrors:");
    allErrors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (allErrors.length > 20) console.log(`  ... and ${allErrors.length - 20} more`);
  }

  process.exit(allErrors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
