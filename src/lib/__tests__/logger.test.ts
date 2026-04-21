import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  const originalNodeEnv = process.env.NODE_ENV as string;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);

  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  describe("production mode — JSON output", () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = "production";
    });

    it("emits valid JSON for info level", async () => {
      const lines: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      });

      // Re-import to pick up NODE_ENV change
      vi.resetModules();
      const { logger } = await import("../logger");

      logger.info("test message");

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("test message");
      expect(typeof parsed.timestamp).toBe("string");
    });

    it("includes context fields in JSON output", async () => {
      const lines: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      });

      vi.resetModules();
      const { logger } = await import("../logger");

      logger.error("processing failed", { phone: "59899123456", booking_id: "abc-123", error: "timeout" });

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe("error");
      expect(parsed.message).toBe("processing failed");
      expect(parsed.phone).toBe("59899123456");
      expect(parsed.booking_id).toBe("abc-123");
      expect(parsed.error).toBe("timeout");
    });

    it("emits valid JSON for warn level", async () => {
      const lines: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      });

      vi.resetModules();
      const { logger } = await import("../logger");

      logger.warn("something degraded", { service: "db" });

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe("warn");
      expect(parsed.message).toBe("something degraded");
      expect(parsed.service).toBe("db");
    });

    it("emits valid JSON for error level", async () => {
      const lines: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      });

      vi.resetModules();
      const { logger } = await import("../logger");

      logger.error("fatal error", { code: 500 });

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe("error");
      expect(parsed.code).toBe(500);
    });

    it("output ends with newline so log lines are separated", async () => {
      const lines: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(typeof chunk === "string" ? chunk : chunk.toString());
        return true;
      });

      vi.resetModules();
      const { logger } = await import("../logger");

      logger.info("newline test");

      expect(lines[0]).toMatch(/\n$/);
    });
  });

  describe("development mode — readable console output", () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = "development";
    });

    it("uses console.log for info", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.resetModules();
      const { logger } = await import("../logger");

      logger.info("dev info message");

      expect(spy).toHaveBeenCalledWith(expect.stringContaining("[INFO]"));
      spy.mockRestore();
    });

    it("uses console.warn for warn", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.resetModules();
      const { logger } = await import("../logger");

      logger.warn("dev warn message");

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("uses console.error for error", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.resetModules();
      const { logger } = await import("../logger");

      logger.error("dev error message");

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // Restore stdout.write after all tests
  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
  });
});
