import { logger } from "@/lib/logger";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const label = options?.label ?? "unknown";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error("Final failure after max retry attempts", {
    label,
    max_attempts: maxAttempts,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  throw lastError;
}
