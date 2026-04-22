import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../retry";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, label: "test" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries up to maxAttempts and throws after all failures", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    let caughtError: Error | undefined;

    const resultPromise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, label: "notifyAdmin" })
      .catch((e: Error) => { caughtError = e; });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(caughtError?.message).toBe("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff delays", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const resultPromise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000, label: "test" })
      .catch(() => "caught");
    await vi.runAllTimersAsync();
    await resultPromise;

    const delays = setTimeoutSpy.mock.calls.map((args) => args[1]);
    expect(delays).toContain(1000); // attempt 1 → delay 1000ms
    expect(delays).toContain(2000); // attempt 2 → delay 2000ms
    setTimeoutSpy.mockRestore();
  });

  it("uses defaults when no options provided", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const resultPromise = withRetry(fn).catch(() => "caught");
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not delay after the final failed attempt", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const resultPromise = withRetry(fn, { maxAttempts: 2, baseDelayMs: 500, label: "test" })
      .catch(() => "caught");
    await vi.runAllTimersAsync();
    await resultPromise;

    const delays = setTimeoutSpy.mock.calls.map((args) => args[1]);
    // maxAttempts=2: delay after attempt 1 only (500ms), no delay after attempt 2
    expect(delays.filter((d) => d === 500)).toHaveLength(1);
    setTimeoutSpy.mockRestore();
  });
});
