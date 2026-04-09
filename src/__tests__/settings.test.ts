import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerSettingsTools } from "../tools/settings.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    settings: {
      get: vi.fn(),
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
  registerSettingsTools(mockServer, client);
  return tools;
}

describe("settings tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_get_settings returns formatted settings", async () => {
    vi.mocked(client.settings.get).mockResolvedValueOnce({
      defaultWebhookUrl: "https://example.com/webhook",
    });

    const result = await tools["saperly_get_settings"]({});

    expect(result.content[0].text).toContain("account settings:");
    expect(result.content[0].text).toContain("https://example.com/webhook");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_settings shows not set when null", async () => {
    vi.mocked(client.settings.get).mockResolvedValueOnce({
      defaultWebhookUrl: null,
    });

    const result = await tools["saperly_get_settings"]({});

    expect(result.content[0].text).toContain("(not set)");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_settings returns error on failure", async () => {
    vi.mocked(client.settings.get).mockRejectedValueOnce(
      new Error("Unauthorized"),
    );

    const result = await tools["saperly_get_settings"]({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unauthorized");
  });

  it("saperly_update_settings updates webhook URL", async () => {
    vi.mocked(client.settings.update).mockResolvedValueOnce({
      defaultWebhookUrl: "https://example.com/new-webhook",
    });

    const result = await tools["saperly_update_settings"]({
      defaultWebhookUrl: "https://example.com/new-webhook",
    });

    expect(result.content[0].text).toContain("settings updated!");
    expect(result.content[0].text).toContain("https://example.com/new-webhook");
    expect(result.isError).toBeUndefined();
    expect(client.settings.update).toHaveBeenCalledWith({
      defaultWebhookUrl: "https://example.com/new-webhook",
    });
  });

  it("saperly_update_settings clears webhook URL when omitted", async () => {
    vi.mocked(client.settings.update).mockResolvedValueOnce({
      defaultWebhookUrl: null,
    });

    const result = await tools["saperly_update_settings"]({});

    expect(result.content[0].text).toContain("settings updated!");
    expect(result.content[0].text).toContain("(not set)");
    expect(result.isError).toBeUndefined();
    expect(client.settings.update).toHaveBeenCalledWith({
      defaultWebhookUrl: null,
    });
  });

  it("saperly_update_settings returns error on failure", async () => {
    vi.mocked(client.settings.update).mockRejectedValueOnce(
      new Error("Bad request"),
    );

    const result = await tools["saperly_update_settings"]({
      defaultWebhookUrl: "not-a-url",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Bad request");
  });
});
