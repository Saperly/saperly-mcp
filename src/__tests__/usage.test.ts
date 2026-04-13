import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerUsageTools } from "../tools/usage.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    usage: {
      daily: vi.fn(),
      monthly: vi.fn(),
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
  registerUsageTools(mockServer, client);
  return tools;
}

describe("usage tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_get_usage returns daily usage by default", async () => {
    vi.mocked(client.usage.daily).mockResolvedValueOnce({
      daily: [
        {
          date: "2026-04-08",
          calls: 3,
          minutes: 12,
          smsInbound: 2,
          smsOutbound: 1,
          costCredits: 132,
        },
        {
          date: "2026-04-07",
          calls: 1,
          minutes: 5,
          smsInbound: 0,
          smsOutbound: 0,
          costCredits: 55,
        },
      ],
    });

    const result = await tools["saperly_get_usage"]({});

    expect(result.content[0].text).toContain("daily usage:");
    expect(result.content[0].text).toContain("2026-04-08");
    expect(result.content[0].text).toContain("3 calls");
    expect(result.content[0].text).toContain("132 credits");
    expect(result.content[0].text).toContain("2026-04-07");
    expect(result.isError).toBeUndefined();
    expect(client.usage.daily).toHaveBeenCalledWith({ days: 7 });
  });

  it("saperly_get_usage returns monthly usage when requested", async () => {
    vi.mocked(client.usage.monthly).mockResolvedValueOnce({
      monthly: [
        {
          month: "2026-04",
          calls: 25,
          minutes: 120,
          smsInbound: 10,
          smsOutbound: 5,
          costCredits: 1320,
        },
      ],
    });

    const result = await tools["saperly_get_usage"]({
      period: "monthly",
    });

    expect(result.content[0].text).toContain("monthly usage:");
    expect(result.content[0].text).toContain("2026-04");
    expect(result.content[0].text).toContain("25 calls");
    expect(result.content[0].text).toContain("1320 credits");
    expect(result.isError).toBeUndefined();
    expect(client.usage.monthly).toHaveBeenCalledWith({ months: 3 });
  });

  it("saperly_get_usage passes custom count", async () => {
    vi.mocked(client.usage.daily).mockResolvedValueOnce({ daily: [] });

    const result = await tools["saperly_get_usage"]({
      period: "daily",
      count: 30,
    });

    expect(result.content[0].text).toContain("no usage data yet");
    expect(client.usage.daily).toHaveBeenCalledWith({ days: 30 });
  });

  it("saperly_get_usage returns error on failure", async () => {
    vi.mocked(client.usage.daily).mockRejectedValueOnce(
      new Error("Internal server error"),
    );

    const result = await tools["saperly_get_usage"]({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Internal server error");
  });
});
