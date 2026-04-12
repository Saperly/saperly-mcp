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

  it("saperly_get_balance returns formatted balance with rates", async () => {
    vi.mocked(client.billing.balance).mockResolvedValueOnce({
      balanceCents: 485,
      currency: "USD",
    });

    const result = await tools["saperly_get_balance"]({});

    expect(result.content[0].text).toContain("$4.85");
    expect(result.content[0].text).toContain("USD");
    expect(result.content[0].text).toContain("$0.05/min");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_balance returns fallback when billing endpoint not found", async () => {
    vi.mocked(client.billing.balance).mockRejectedValueOnce(
      new NotFoundError("Billing endpoint not found"),
    );

    const result = await tools["saperly_get_balance"]({});

    expect(result.content[0].text).toContain("not available yet");
    expect(result.content[0].text).toContain("$5.00");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_add_funds returns checkout url", async () => {
    vi.mocked(client.billing.addFunds).mockResolvedValueOnce({
      checkoutUrl: "https://checkout.lemonsqueezy.com/pay/abc123",
    });

    const result = await tools["saperly_add_funds"]({ amount_cents: 2500 });

    expect(result.content[0].text).toContain("https://checkout.lemonsqueezy.com/pay/abc123");
    expect(result.content[0].text).toContain("$25.00");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_transactions returns formatted list", async () => {
    vi.mocked(client.billing.transactions).mockResolvedValueOnce({
      transactions: [
        {
          id: "t1",
          type: "signup_credit",
          amountCents: 500,
          balanceAfterCents: 500,
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
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_transactions shows pagination cursor when hasMore", async () => {
    vi.mocked(client.billing.transactions).mockResolvedValueOnce({
      transactions: [
        {
          id: "t1",
          type: "call_charge",
          amountCents: 50,
          balanceAfterCents: 450,
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
