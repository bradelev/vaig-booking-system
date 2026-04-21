import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/scheduler/index.ts",
        "src/lib/scheduler/types.ts",
        "src/lib/timezone.ts",
        "src/lib/bot/date-parser.ts",
        "src/lib/bot/handoff.ts",
        "src/lib/bot/intent.ts",
        "src/lib/bot/session.ts",
        "src/lib/bot/rate-limit.ts",
        "src/lib/bot/campaign-context.ts",
        "src/lib/gcal/event-parser.ts",
        "src/lib/gcal/service-abbreviations.ts",
        "src/lib/utils.ts",
        "src/lib/templates.ts",
        "src/lib/whatsapp/sanitize.ts",
        "src/lib/bot/llm.ts",
        "src/lib/logger.ts",
        "src/lib/whatsapp/retry.ts",
        "src/lib/admin-rate-limit.ts",
      ],
      exclude: [
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
