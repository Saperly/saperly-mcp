/**
 * v0.5.3 launch-readiness customer-flow E2E (Phase A.1c).
 *
 * Mirrors the SDK-side customer-1 flow exercised in
 * packages/sdk/src/__tests__/live-customer-flow.test.ts, but driven through
 * the MCP tool surface — the perspective Claude Code (and any other MCP
 * client) actually sees.
 *
 * Sequence: saperly_create_line → saperly_create_call → saperly_send_sms.
 *
 * Tool names verified against tools/lines.ts, tools/calls.ts, tools/messages.ts:
 *   - saperly_create_line   (tools/lines.ts:32)
 *   - saperly_create_call   (tools/calls.ts:28)  — NOT saperly_make_call
 *   - saperly_send_sms      (tools/messages.ts:8)
 *
 * Mocking: SDK methods on a fake `Saperly` client — same pattern as
 * lines.test.ts / calls.test.ts / messages.test.ts. @saperly/sdk is a runtime
 * dep of @saperly/mcp (^0.3.0), and every MCP tool wraps an SDK call, so we
 * stub at the SDK boundary rather than mocking global fetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerLinesTools } from "../tools/lines.js";
import { registerCallsTools } from "../tools/calls.js";
import { registerMessagesTools } from "../tools/messages.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    lines: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    calls: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      hangup: vi.fn(),
      conversation: vi.fn(),
    },
    messages: {
      send: vi.fn(),
    },
    conversations: {
      list: vi.fn(),
      messages: vi.fn(),
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
  registerLinesTools(mockServer, client);
  registerCallsTools(mockServer, client);
  registerMessagesTools(mockServer, client);
  return tools;
}

describe("v0.5.3 live customer flow (MCP tool surface)", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("provisions a webhook line, places a call, and sends an SMS via MCP tools", async () => {
    // ── Step 1: saperly_create_line (webhook mode) ──────────────────────────
    vi.mocked(client.lines.create).mockResolvedValueOnce({
      id: "line-customer-1",
      phoneNumber: "+14155550111",
      displayName: null,
      name: "customer-1 webhook bot",
      mode: "webhook",
      audioHandlerUrl: null,
      webhookUrl: "https://customer-1.example.com/saperly/webhook",
      statusCallbackUrl: "https://customer-1.example.com/saperly/status",
      systemPrompt: null,
      beginMessage: null,
      voice: null,
      contextLimit: null,
      recordingEnabled: false,
      complianceEnabled: true,
      status: "active",
      environment: "live",
      createdAt: "2026-05-03T00:00:00Z",
    });

    const lineResult = await tools["saperly_create_line"]({
      name: "customer-1 webhook bot",
      mode: "webhook",
      webhookUrl: "https://customer-1.example.com/saperly/webhook",
      statusCallbackUrl: "https://customer-1.example.com/saperly/status",
    });

    // Assertion 1: MCP envelope shape + phone number surfaces in body.
    expect(lineResult.isError).toBeUndefined();
    expect(lineResult.content).toHaveLength(1);
    expect(lineResult.content[0].type).toBe("text");
    expect(lineResult.content[0].text).toContain("line created!");
    expect(lineResult.content[0].text).toContain("+14155550111");

    // Assertion 4 (line slice): MCP tool forwarded args to the SDK surface.
    expect(client.lines.create).toHaveBeenCalledWith({
      name: "customer-1 webhook bot",
      mode: "webhook",
      webhookUrl: "https://customer-1.example.com/saperly/webhook",
      statusCallbackUrl: "https://customer-1.example.com/saperly/status",
    });

    // ── Step 2: saperly_create_call (status: "initiated" — SDK enum) ────────
    vi.mocked(client.calls.create).mockResolvedValueOnce({
      id: "call-customer-1",
      lineId: "line-customer-1",
      direction: "outbound",
      fromNumber: "+14155550111",
      toNumber: "+14155559999",
      status: "initiated",
      durationSec: null,
      startedAt: null,
      endedAt: null,
      recordingUrl: null,
      transcript: null,
      systemPrompt: null,
      beginMessage: null,
      createdAt: "2026-05-03T00:00:01Z",
    });

    const callResult = await tools["saperly_create_call"]({
      lineId: "line-customer-1",
      toNumber: "+14155559999",
    });

    // Assertion 2: status: "initiated" surfaces (verified literal from
    // packages/sdk/src/types.ts:27 — "initiated" | "ringing" | "in_progress" | …).
    expect(callResult.isError).toBeUndefined();
    expect(callResult.content[0].type).toBe("text");
    expect(callResult.content[0].text).toContain("call initiated!");
    expect(callResult.content[0].text).toContain("+14155559999");
    expect(client.calls.create).toHaveBeenCalledWith({
      lineId: "line-customer-1",
      toNumber: "+14155559999",
    });

    // ── Step 3: saperly_send_sms (status field present) ─────────────────────
    vi.mocked(client.messages.send).mockResolvedValueOnce({
      id: "msg-customer-1",
      lineId: "line-customer-1",
      to: "+14155559999",
      text: "Thanks for calling — here's your follow-up link.",
      status: "queued",
      createdAt: "2026-05-03T00:00:02Z",
    });

    const smsResult = await tools["saperly_send_sms"]({
      lineId: "line-customer-1",
      to: "+14155559999",
      text: "Thanks for calling — here's your follow-up link.",
    });

    // Assertion 3: status field surfaces in MCP envelope text.
    expect(smsResult.isError).toBeUndefined();
    expect(smsResult.content[0].type).toBe("text");
    expect(smsResult.content[0].text).toContain("SMS sent!");
    expect(smsResult.content[0].text).toContain("msg-customer-1");
    expect(smsResult.content[0].text).toContain("status: queued");
    expect(client.messages.send).toHaveBeenCalledWith({
      lineId: "line-customer-1",
      to: "+14155559999",
      text: "Thanks for calling — here's your follow-up link.",
    });

    // Assertion 5: each MCP tool wrapped its SDK return cleanly into the
    // standard MCP envelope: { content: [{ type: "text", text: "…" }] }.
    for (const result of [lineResult, callResult, smsResult]) {
      expect(result).toMatchObject({
        content: [{ type: "text", text: expect.any(String) }],
      });
    }
  });
});
