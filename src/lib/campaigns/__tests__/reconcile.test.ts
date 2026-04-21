import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileCampaignRecipientFromMessage } from "../reconcile";
import type { MessageRow, MessageStatus } from "@/lib/whatsapp/log";

// --- Mock Supabase admin client ---
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

function makeChain(data: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function makeMessageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: "msg-uuid",
    client_id: "client-uuid",
    source: "campaign",
    wa_message_id: "wamid.test123",
    ...overrides,
  };
}

describe("reconcileCampaignRecipientFromMessage", () => {
  it("no-ops when source is not campaign", async () => {
    const row = makeMessageRow({ source: "bot" });
    await reconcileCampaignRecipientFromMessage(row, "failed", 131026, "Error");
    // createAdminClient should not be called since we short-circuit
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("no-ops when wa_message_id is null", async () => {
    const row = makeMessageRow({ wa_message_id: null });
    await reconcileCampaignRecipientFromMessage(row, "failed", 131026, "Error");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("no-ops when recipient not found", async () => {
    const recipientChain = makeChain(null);
    const updateChain = makeChain(null);
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return recipientChain;
      return updateChain;
    });

    const row = makeMessageRow();
    await reconcileCampaignRecipientFromMessage(row, "failed", 131026, "Error");

    // update should not be called since recipient was null
    expect(updateChain.update).not.toHaveBeenCalled();
  });

  it("does not downgrade from failed to delivered", async () => {
    const recipientChain = makeChain({ campaign_id: "camp-1", client_id: "client-1", status: "failed" });
    const updateChain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? recipientChain : updateChain;
    });

    const row = makeMessageRow();
    await reconcileCampaignRecipientFromMessage(row, "delivered", null, null);

    expect(updateChain.update).not.toHaveBeenCalled();
  });

  it("does not advance read→delivered (no backwards transition)", async () => {
    const recipientChain = makeChain({ campaign_id: "camp-1", client_id: "client-1", status: "read" });
    const updateChain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? recipientChain : updateChain;
    });

    const row = makeMessageRow();
    await reconcileCampaignRecipientFromMessage(row, "delivered", null, null);

    expect(updateChain.update).not.toHaveBeenCalled();
  });
});
