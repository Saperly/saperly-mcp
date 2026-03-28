import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { ConsentRequiredError, InsufficientCreditsError } from "@saperly/sdk";
import { registerCallsTools } from "../tools/calls.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    calls: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      hangup: vi.fn(),
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
  registerCallsTools(mockServer, client);
  return tools;
}

describe("calls tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_create_call returns formatted call on success", async () => {
    vi.mocked(client.calls.create).mockResolvedValueOnce({
      id: "call-1",
      lineId: "line-1",
      direction: "outbound",
      fromNumber: "+14155550123",
      toNumber: "+14155551234",
      status: "initiated",
      durationSec: null,
      startedAt: null,
      endedAt: null,
      createdAt: "2026-03-28T00:00:00Z",
    });

    const result = await tools["saperly_create_call"]({
      lineId: "line-1",
      toNumber: "+14155551234",
    });

    expect(result.content[0].text).toContain("call initiated!");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_calls returns formatted list", async () => {
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
          createdAt: "2026-03-28T00:00:00Z",
        },
      ],
      total: 1,
    });

    const result = await tools["saperly_list_calls"]({});

    expect(result.content[0].text).toContain("1 call(s)");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_call returns formatted call details", async () => {
    vi.mocked(client.calls.get).mockResolvedValueOnce({
      id: "call-1",
      lineId: "line-1",
      direction: "outbound",
      fromNumber: "+14155550123",
      toNumber: "+14155551234",
      status: "completed",
      durationSec: 45,
      startedAt: "2026-03-28T00:00:00Z",
      endedAt: "2026-03-28T00:00:45Z",
      createdAt: "2026-03-28T00:00:00Z",
    });

    const result = await tools["saperly_get_call"]({ callId: "call-1" });

    expect(result.content[0].text).toContain("+14155551234");
    expect(result.content[0].text).toContain("completed");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_hangup_call returns termination confirmation", async () => {
    vi.mocked(client.calls.hangup).mockResolvedValueOnce({
      id: "call-1",
      lineId: "line-1",
      direction: "outbound",
      fromNumber: "+14155550123",
      toNumber: "+14155551234",
      status: "completed",
      durationSec: 45,
      startedAt: "2026-03-28T00:00:00Z",
      endedAt: "2026-03-28T00:00:45Z",
      createdAt: "2026-03-28T00:00:00Z",
    });

    const result = await tools["saperly_hangup_call"]({ callId: "call-1" });

    expect(result.content[0].text).toContain("terminated");
    expect(result.content[0].text).toContain("completed");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_create_call returns consent required error", async () => {
    vi.mocked(client.calls.create).mockRejectedValueOnce(
      new ConsentRequiredError("Consent not found for +14155551234"),
    );

    const result = await tools["saperly_create_call"]({
      lineId: "line-1",
      toNumber: "+14155551234",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("consent required");
    expect(result.content[0].text).toContain("saperly_grant_consent");
  });

  it("saperly_create_call returns insufficient credits error", async () => {
    vi.mocked(client.calls.create).mockRejectedValueOnce(
      new InsufficientCreditsError("Balance is $0.00"),
    );

    const result = await tools["saperly_create_call"]({
      lineId: "line-1",
      toNumber: "+14155551234",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("insufficient credits");
    expect(result.content[0].text).toContain("saperly_get_balance");
  });
});
