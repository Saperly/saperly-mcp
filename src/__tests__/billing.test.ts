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
    billing: { balance: vi.fn() },
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
});
