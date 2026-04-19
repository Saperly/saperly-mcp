import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { z } from "zod";
import { registerLinesTools } from "../tools/lines.js";

/**
 * MCP strict-mode decision (Phase 3D locked 2026-04-19):
 *
 * The MCP tool `saperly_create_line` accepts ["webhook","audio","hosted"] only.
 * Legacy "text" is REJECTED at the MCP layer — REST still accepts both for
 * back-compat. Rationale: MCP is a new surface, <10 users, pre-launch.
 */

type ToolArgs = Record<string, unknown>;
type ToolHandler = (args: ToolArgs) => Promise<unknown>;
type ToolSchema = Record<string, z.ZodType>;

function createMockClient() {
  return {
    lines: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as Saperly;
}

function captureToolsWithSchemas(client: Saperly) {
  const tools: Record<string, { schema: ToolSchema; handler: ToolHandler }> = {};
  const mockServer = {
    tool: (
      name: string,
      _desc: string,
      schema: ToolSchema,
      handler: ToolHandler,
    ) => {
      tools[name] = { schema, handler };
    },
  } as unknown as McpServer;
  registerLinesTools(mockServer, client);
  return tools;
}

describe("saperly_create_line — mode enum", () => {
  let client: Saperly;
  let tools: ReturnType<typeof captureToolsWithSchemas>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureToolsWithSchemas(client);
  });

  it('accepts mode="webhook"', () => {
    const modeSchema = tools["saperly_create_line"].schema.mode;
    expect(modeSchema.safeParse("webhook").success).toBe(true);
  });

  it('accepts mode="hosted"', () => {
    const modeSchema = tools["saperly_create_line"].schema.mode;
    expect(modeSchema.safeParse("hosted").success).toBe(true);
  });

  it('accepts mode="audio"', () => {
    const modeSchema = tools["saperly_create_line"].schema.mode;
    expect(modeSchema.safeParse("audio").success).toBe(true);
  });

  it('rejects legacy mode="text" (MCP strict)', () => {
    const modeSchema = tools["saperly_create_line"].schema.mode;
    expect(modeSchema.safeParse("text").success).toBe(false);
  });

  it("exposes all 5 hosted-mode fields on the schema", () => {
    const schema = tools["saperly_create_line"].schema;
    expect(schema.systemPrompt).toBeDefined();
    expect(schema.beginMessage).toBeDefined();
    expect(schema.voice).toBeDefined();
    expect(schema.contextLimit).toBeDefined();
    expect(schema.recordingEnabled).toBeDefined();
  });

  it('handler forwards {mode:"webhook"} to the SDK', async () => {
    vi.mocked(client.lines.create).mockResolvedValueOnce({
      id: "line-1",
      phoneNumber: "+14155550123",
      displayName: null,
      name: "test bot",
      mode: "webhook",
      audioHandlerUrl: null,
      webhookUrl: "https://example.com/hook",
      statusCallbackUrl: null,
      systemPrompt: null,
      beginMessage: null,
      voice: null,
      contextLimit: null,
      recordingEnabled: false,
      complianceEnabled: true,
      status: "active",
      environment: "live",
      createdAt: "2026-03-28T00:00:00Z",
    });

    await tools["saperly_create_line"].handler({
      name: "test bot",
      mode: "webhook",
      webhookUrl: "https://example.com/hook",
    });

    expect(client.lines.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "webhook" }),
    );
  });

  it('handler forwards {mode:"hosted", systemPrompt:"..."} to the SDK', async () => {
    vi.mocked(client.lines.create).mockResolvedValueOnce({
      id: "line-2",
      phoneNumber: "+14155550456",
      displayName: null,
      name: "hosted bot",
      mode: "hosted",
      audioHandlerUrl: null,
      webhookUrl: null,
      statusCallbackUrl: null,
      systemPrompt: "You are helpful.",
      beginMessage: null,
      voice: null,
      contextLimit: null,
      recordingEnabled: false,
      complianceEnabled: true,
      status: "active",
      environment: "live",
      createdAt: "2026-03-28T00:00:00Z",
    });

    await tools["saperly_create_line"].handler({
      name: "hosted bot",
      mode: "hosted",
      systemPrompt: "You are helpful.",
    });

    expect(client.lines.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "hosted",
        systemPrompt: "You are helpful.",
      }),
    );
  });

  it('handler forwards {mode:"audio", audioHandlerUrl:"..."} to the SDK', async () => {
    vi.mocked(client.lines.create).mockResolvedValueOnce({
      id: "line-3",
      phoneNumber: "+14155550789",
      displayName: null,
      name: "audio bot",
      mode: "audio",
      audioHandlerUrl: "wss://example.com/ws",
      webhookUrl: null,
      statusCallbackUrl: null,
      systemPrompt: null,
      beginMessage: null,
      voice: null,
      contextLimit: null,
      recordingEnabled: false,
      complianceEnabled: true,
      status: "active",
      environment: "live",
      createdAt: "2026-03-28T00:00:00Z",
    });

    await tools["saperly_create_line"].handler({
      name: "audio bot",
      mode: "audio",
      audioHandlerUrl: "wss://example.com/ws",
    });

    expect(client.lines.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "audio",
        audioHandlerUrl: "wss://example.com/ws",
      }),
    );
  });
});
