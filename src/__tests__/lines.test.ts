import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { ValidationError } from "@saperly/sdk";
import { registerLinesTools } from "../tools/lines.js";

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
  return tools;
}

describe("lines tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_create_line returns formatted line on success", async () => {
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

    const result = await tools["saperly_create_line"]({
      name: "test bot",
      mode: "webhook",
    });

    expect(result.content[0].text).toContain("+14155550123");
    expect(result.content[0].text).toContain("line created!");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_lines returns formatted list", async () => {
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
        recordingEnabled: false,
        complianceEnabled: true,
        status: "active",
        environment: "live",
        createdAt: "2026-03-28T00:00:00Z",
      },
      {
        id: "line-2",
        phoneNumber: "+14155550456",
        displayName: null,
        name: "bot-2",
        mode: "audio",
        audioHandlerUrl: null,
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
      },
    ]);

    const result = await tools["saperly_list_lines"]({});

    expect(result.content[0].text).toContain("2 line(s)");
    expect(result.content[0].text).toContain("+14155550123");
    expect(result.content[0].text).toContain("+14155550456");
  });

  it("saperly_get_line returns formatted line details", async () => {
    vi.mocked(client.lines.get).mockResolvedValueOnce({
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

    const result = await tools["saperly_get_line"]({ lineId: "line-1" });

    expect(result.content[0].text).toContain("+14155550123");
    expect(result.content[0].text).toContain("webhook");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_create_line returns validation error", async () => {
    vi.mocked(client.lines.create).mockRejectedValueOnce(
      new ValidationError("Invalid input", 422, [
        { field: "name", message: "is required" },
      ]),
    );

    const result = await tools["saperly_create_line"]({
      name: "",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("validation error");
    expect(result.content[0].text).toContain("name: is required");
  });

  it("saperly_update_line returns updated line", async () => {
    vi.mocked(client.lines.update).mockResolvedValueOnce({
      id: "line-1",
      phoneNumber: "+14155550123",
      displayName: null,
      name: "updated bot",
      mode: "webhook",
      audioHandlerUrl: null,
      webhookUrl: "https://example.com/hook",
      statusCallbackUrl: null,
      systemPrompt: "You are a helpful assistant",
      beginMessage: "Hello!",
      voice: "nova",
      contextLimit: 30,
      recordingEnabled: true,
      complianceEnabled: true,
      status: "active",
      environment: "live",
      createdAt: "2026-03-28T00:00:00Z",
    });

    const result = await tools["saperly_update_line"]({
      lineId: "line-1",
      name: "updated bot",
      systemPrompt: "You are a helpful assistant",
      voice: "nova",
      recordingEnabled: true,
    });

    expect(result.content[0].text).toContain("line updated!");
    expect(result.content[0].text).toContain("updated bot");
    expect(result.content[0].text).toContain("system prompt: You are a helpful assistant");
    expect(result.content[0].text).toContain("voice: nova");
    expect(result.content[0].text).toContain("recording: enabled");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_update_line returns error on failure", async () => {
    vi.mocked(client.lines.update).mockRejectedValueOnce(
      new ValidationError("Invalid input", 422, [
        { field: "contextLimit", message: "must be between 1 and 50" },
      ]),
    );

    const result = await tools["saperly_update_line"]({
      lineId: "line-1",
      contextLimit: 100,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("validation error");
    expect(result.content[0].text).toContain("contextLimit");
  });
});
