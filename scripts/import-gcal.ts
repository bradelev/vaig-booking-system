#!/usr/bin/env npx tsx
/**
 * GCal import CLI script.
 *
 * Usage:
 *   npx tsx scripts/import-gcal.ts [--dry-run] [--from <ISO date>] [--to <ISO date>]
 *
 * Requires .env.local (or .env) with GCal + Supabase credentials.
 */

import { config } from "dotenv";
import * as path from "node:path";

// Load env BEFORE importing the engine (which reads process.env at module load time).
// Use dynamic import to guarantee evaluation order is correct in ESM and CJS.
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  // Dynamic import ensures env vars are loaded before the module initializes
  const { importGCalEvents } = await import("../src/lib/gcal/import-engine");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const fromIdx = args.indexOf("--from");
  const toIdx = args.indexOf("--to");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const timeMin =
    fromIdx >= 0 ? new Date(args[fromIdx + 1]).toISOString() : thirtyDaysAgo.toISOString();
  const timeMax =
    toIdx >= 0 ? new Date(args[toIdx + 1]).toISOString() : thirtyDaysAhead.toISOString();

  console.log(
    `Importing GCal events from ${timeMin} to ${timeMax}${dryRun ? " (DRY RUN)" : ""}...`,
  );

  const result = await importGCalEvents({ timeMin, timeMax, dryRun });

  console.log(`\nResults:`);
  console.log(`  Imported bookings: ${result.imported}`);
  console.log(`  Skipped (already linked): ${result.skipped}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Unmatched events (no service found): ${result.unmatched.length}`);

  if (result.created.length > 0) {
    console.log(`\nCreated bookings:`);
    for (const b of result.created) {
      console.log(`  - ${b.clientName} / ${b.serviceName} (from: "${b.eventSummary}")`);
    }
  }

  if (result.unmatched.length > 0) {
    console.log(`\nUnmatched events (no service found):`);
    for (const u of result.unmatched) {
      console.log(`  - "${u.summary}" | abbrevs: [${u.abbreviations.join(", ")}]`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    for (const e of result.errors) {
      console.log(`  - ${e.summary}: ${e.error}`);
    }
  }
}

main().catch(console.error);
