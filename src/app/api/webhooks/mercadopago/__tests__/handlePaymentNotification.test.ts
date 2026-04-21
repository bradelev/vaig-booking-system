import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/payments", () => ({
  fetchMPPayment: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/bot/notifications", () => ({
  notifyAdminPaymentConfirmed: vi.fn().mockResolvedValue(undefined),
  notifyClientPackPurchased: vi.fn().mockResolvedValue(undefined),
}));

import { handlePaymentNotification } from "../route";
import { fetchMPPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminPaymentConfirmed } from "@/lib/bot/notifications";

const mockFetchMPPayment = vi.mocked(fetchMPPayment);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockNotifyAdminPaymentConfirmed = vi.mocked(notifyAdminPaymentConfirmed);

function makeApprovedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 99999,
    status: "approved",
    status_detail: "accredited",
    external_reference: "booking-abc",
    transaction_amount: 5000,
    currency_id: "ARS",
    date_approved: "2026-04-21T10:00:00.000Z",
    date_created: "2026-04-21T09:50:00.000Z",
    payer: { email: "test@test.com" },
    ...overrides,
  };
}

function makeDbChain(overrides: Record<string, () => unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "is", "update", "insert", "maybeSingle", "single"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // terminal defaults
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
  Object.assign(chain, overrides);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handlePaymentNotification — idempotency guard", () => {
  it("returns early without re-processing when mp_payment_id already recorded", async () => {
    mockFetchMPPayment.mockResolvedValue(makeApprovedPayment() as never);

    const db = makeDbChain();
    // maybeSingle on idempotency check returns an existing booking
    (db.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: "booking-abc" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(db as never);

    await handlePaymentNotification("99999");

    // The atomic update should never have been called
    const updateCalls = (db.update as ReturnType<typeof vi.fn>).mock.calls;
    expect(updateCalls).toHaveLength(0);
    expect(mockNotifyAdminPaymentConfirmed).not.toHaveBeenCalled();
  });

  it("returns 200 gracefully when no rows matched (race condition — concurrent delivery)", async () => {
    mockFetchMPPayment.mockResolvedValue(makeApprovedPayment() as never);

    const db = makeDbChain();
    // idempotency check: no existing booking with this mp_payment_id
    (db.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
    // atomic update returns PGRST116 (no rows matched)
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
    });
    mockCreateAdminClient.mockReturnValue(db as never);

    // Should not throw
    await expect(handlePaymentNotification("99999")).resolves.toBeUndefined();
    expect(mockNotifyAdminPaymentConfirmed).not.toHaveBeenCalled();
  });

  it("happy path: transitions pending booking, stores mp_payment_id, notifies admin", async () => {
    mockFetchMPPayment.mockResolvedValue(makeApprovedPayment() as never);

    const bookingData = {
      scheduled_at: "2026-04-22T14:00:00.000Z",
      clients: { first_name: "Ana", last_name: "Gómez", phone: "59899123456" },
      services: { name: "Depilación laser", deposit_amount: "5000" },
    };

    const db = makeDbChain();
    // idempotency check: no existing booking
    (db.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
    // atomic update succeeds and returns booking data
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: bookingData, error: null });
    mockCreateAdminClient.mockReturnValue(db as never);

    await handlePaymentNotification("99999");

    expect(mockNotifyAdminPaymentConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-abc",
        clientName: "Ana Gómez",
        clientPhone: "59899123456",
        serviceName: "Depilación laser",
        method: "mercadopago",
        amount: 5000,
      })
    );
  });

  it("does nothing when payment status is not approved", async () => {
    mockFetchMPPayment.mockResolvedValue(makeApprovedPayment({ status: "pending" }) as never);

    const db = makeDbChain();
    mockCreateAdminClient.mockReturnValue(db as never);

    await handlePaymentNotification("99999");

    expect(db.from as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(mockNotifyAdminPaymentConfirmed).not.toHaveBeenCalled();
  });

  it("does nothing when external_reference is missing", async () => {
    mockFetchMPPayment.mockResolvedValue(
      makeApprovedPayment({ external_reference: "" }) as never
    );

    const db = makeDbChain();
    mockCreateAdminClient.mockReturnValue(db as never);

    await handlePaymentNotification("99999");

    expect(mockNotifyAdminPaymentConfirmed).not.toHaveBeenCalled();
  });

  it("logs error and returns when DB update fails with unexpected error", async () => {
    mockFetchMPPayment.mockResolvedValue(makeApprovedPayment() as never);

    const db = makeDbChain();
    (db.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key violation" },
    });
    mockCreateAdminClient.mockReturnValue(db as never);

    await expect(handlePaymentNotification("99999")).resolves.toBeUndefined();
    expect(mockNotifyAdminPaymentConfirmed).not.toHaveBeenCalled();
  });
});
