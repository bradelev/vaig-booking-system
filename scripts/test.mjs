import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function findTests(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTests(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts") && full.includes("__tests__")) {
      results.push(full);
    }
  }
  return results;
}

const files = findTests("src");

if (files.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

const result = spawnSync("npx", ["tsx", "--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
