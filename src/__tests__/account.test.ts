import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { NotFoundError } from "@saperly/sdk";
import { registerAccountTools } from "../tools/account.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    lines: { list: vi.fn() },
    calls: { list: vi.fn() },
    billing: { balance: vi.fn() },
    usage: { daily: vi.fn() },
    conversations: { list: vi.fn() },
  } as unknown as Saperly;
}

function captureTools(client: Saperly) {
  const tools: Record<string, ToolHandler> = {};
  const mockServer = {
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      tools[name] = handler;
    },
  } as unknown as McpServer;
  registerAccountTools(mockServer, client);
  return tools;
}

describe("account tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_account_overview aggregates lines, balance, and calls", async () => {
    vi.mocked(client.lines.list).mockResolvedValueOnce([
      {
        id: "line-1",
        phoneNumber: "+14155550123",
        displayName: null,
        name: "bot-1",
        mode: "webhook",
        audioHandlerUrl: null,
        webhookUrl: null,
        statusCallbackUrl: null,
        systemPrompt: null,
        beginMessage: null,
        voice: null,
        contextLimit: null,
        language: "multi",
        endpointingMs: null,
        recordingEnabled: false,
        complianceEnabled: true,
        status: "active",
        environment: "live",
        createdAt: "2026-03-28T00:00:00Z",
      },
    ]);
    vi.mocked(client.calls.list).mockResolvedValueOnce({
      calls: [
        {
          id: "call-1",
          lineId: "line-1",
          direction: "outbound",
          fromNumber: "+14155550123",
          toNumber: "+14155551234",
          status: "completed",
          durationSec: 45,
          startedAt: "2026-03-28T00:00:00Z",
          endedAt: "2026-03-28T00:00:45Z",
          recordingUrl: null,
          transcript: null,
          systemPrompt: null,
          beginMessage: null,
          createdAt: "2026-03-28T00:00:00Z",
        },
      ],
      total: 1,
    });
    vi.mocked(client.billing.balance).mockResolvedValueOnce({
      credits: 485,
      currency: "USD",
    });
    vi.mocked(client.usage.daily).mockResolvedValueOnce({
      daily: [
        { date: "2026-03-28", calls: 1, minutes: 1, smsInbound: 0, smsOutbound: 0, costCredits: 11 },
      ],
    });
    vi.mocked(client.conversations.list).mockResolvedValueOnce({
      conversations: [
        {
          lineId: "line-1",
          phoneNumber: "+14155551234",
          linePhoneNumber: "+14155550123",
          messageCount: 2,
          lastMessageAt: "2026-03-28T00:00:00Z",
          lastMessageText: "Hi",
          lastMessageDirection: "inbound" as const,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_account_overview"]({});

    expect(result.content[0].text).toContain("saperly account overview");
    expect(result.content[0].text).toContain("485 credits");
    expect(result.content[0].text).toContain("+14155550123");
    expect(result.content[0].text).toContain("1 total");
    expect(result.content[0].text).toContain("last 7 days");
    expect(result.content[0].text).toContain("1 calls");
    expect(result.content[0].text).toContain("SMS conversations: active");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_account_overview handles billing failure gracefully", async () => {
    vi.mocked(client.lines.list).mockResolvedValueOnce([]);
    vi.mocked(client.calls.list).mockResolvedValueOnce({
      calls: [],
      total: 0,
    });
    vi.mocked(client.billing.balance).mockRejectedValueOnce(
      new NotFoundError("Billing endpoint not found"),
    );
    vi.mocked(client.usage.daily).mockRejectedValueOnce(
      new Error("Not available"),
    );
    vi.mocked(client.conversations.list).mockRejectedValueOnce(
      new Error("Not available"),
    );

    const result = await tools["saperly_account_overview"]({});

    expect(result.content[0].text).toContain("saperly account overview");
    expect(result.content[0].text).toContain("(no lines yet)");
    expect(result.content[0].text).toContain("(no calls yet)");
    // Should not crash, should show fallback balance text
    expect(result.content[0].text).toContain("saperly.com/portal");
    expect(result.isError).toBeUndefined();
  });
});
