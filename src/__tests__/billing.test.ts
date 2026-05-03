import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { NotFoundError } from "@saperly/sdk";
import { registerBillingTools } from "../tools/billing.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    billing: {
      balance: vi.fn(),
      addFunds: vi.fn(),
      transactions: vi.fn(),
    },
  } as unknown as Saperly;
}

function captureTools(client: Saperly) {
  const tools: Record<string, ToolHandler> = {};
  const mockServer = {
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      tools[name] = handler;
    },
  } as unknown as McpServer;
  registerBillingTools(mockServer, client);
  return tools;
}

describe("billing tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_get_balance returns formatted balance with rates (cents-honest USD)", async () => {
    vi.mocked(client.billing.balance).mockResolvedValueOnce({
      credits: 485,
      currency: "USD",
    });

    const result = await tools["saperly_get_balance"]({});

    expect(result.content[0].text).toContain("$4.85");
    expect(result.content[0].text).toContain("485 cents");
    expect(result.content[0].text).toContain("$0.13/min");
    expect(result.content[0].text).toContain("$0.26/min");
    expect(result.content[0].text).toContain("$2.50/month");
    expect(result.content[0].text).toContain("credits never expire");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_balance returns fallback when billing endpoint not found", async () => {
    vi.mocked(client.billing.balance).mockRejectedValueOnce(
      new NotFoundError("Billing endpoint not found"),
    );

    const result = await tools["saperly_get_balance"]({});

    expect(result.content[0].text).toContain("not available yet");
    expect(result.content[0].text).toContain("$5 in starter credits");
    expect(result.content[0].text).toContain("38 min webhook");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_add_funds returns deprecation message (endpoint removed v0.5.2.0)", async () => {
    const result = await tools["saperly_add_funds"]({ amount_credits: 12000 });

    expect(result.content[0].text).toContain("removed");
    expect(result.content[0].text).toContain("postpaid");
    expect(result.content[0].text).toContain("https://app.saperly.com/billing");
    expect(result.isError).toBeUndefined();
    // SDK addFunds is no longer called — endpoint is gone, so the tool short-circuits.
    expect(client.billing.addFunds).not.toHaveBeenCalled();
  });

  it("saperly_list_transactions returns formatted list", async () => {
    vi.mocked(client.billing.transactions).mockResolvedValueOnce({
      transactions: [
        {
          id: "t1",
          type: "signup_credit",
          amountCredits: 500,
          balanceAfterCredits: 500,
          description: "Signup credit",
          referenceId: null,
          referenceType: null,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_list_transactions"]({});

    expect(result.content[0].text).toContain("+$5.00");
    expect(result.content[0].text).toContain("signup credit");
    expect(result.content[0].text).toContain("bal: $5.00");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_transactions shows pagination cursor when hasMore", async () => {
    vi.mocked(client.billing.transactions).mockResolvedValueOnce({
      transactions: [
        {
          id: "t1",
          type: "call_charge",
          amountCredits: 50,
          balanceAfterCredits: 450,
          description: "Call charge",
          referenceId: "call-1",
          referenceType: "call",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      hasMore: true,
      nextCursor: "2025-12-31T00:00:00Z",
    });

    const result = await tools["saperly_list_transactions"]({});

    expect(result.content[0].text).toContain("-$0.50");
    expect(result.content[0].text).toContain("bal: $4.50");
    expect(result.content[0].text).toContain("2025-12-31T00:00:00Z");
  });

  it("saperly_list_transactions returns empty message", async () => {
    vi.mocked(client.billing.transactions).mockResolvedValueOnce({
      transactions: [],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_list_transactions"]({});

    expect(result.content[0].text).toContain("no transactions found");
  });
});
