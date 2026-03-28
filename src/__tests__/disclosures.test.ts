import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerDisclosureTools } from "../tools/disclosures.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    disclosures: { create: vi.fn(), list: vi.fn() },
  } as unknown as Saperly;
}

function captureTools(client: Saperly) {
  const tools: Record<string, ToolHandler> = {};
  const mockServer = {
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      tools[name] = handler;
    },
  } as unknown as McpServer;
  registerDisclosureTools(mockServer, client);
  return tools;
}

describe("disclosure tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_create_disclosure returns created disclosure", async () => {
    vi.mocked(client.disclosures.create).mockResolvedValueOnce({
      id: "disc-1",
      message: "This call is handled by an AI assistant.",
      audioUrl: null,
      language: "en",
      jurisdiction: "US",
      isDefault: false,
      createdAt: "2026-03-28T00:00:00Z",
    });

    const result = await tools["saperly_create_disclosure"]({
      message: "This call is handled by an AI assistant.",
    });

    expect(result.content[0].text).toContain("disclosure created!");
    expect(result.content[0].text).toContain("disc-1");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_disclosures returns formatted list", async () => {
    vi.mocked(client.disclosures.list).mockResolvedValueOnce([
      {
        id: "disc-1-full-uuid-here",
        message: "This call is handled by an AI assistant from Acme Corp.",
        audioUrl: null,
        language: "en",
        jurisdiction: "US",
        isDefault: true,
        createdAt: "2026-03-28T00:00:00Z",
      },
    ]);

    const result = await tools["saperly_list_disclosures"]({});

    expect(result.content[0].text).toContain("1 disclosure(s)");
    expect(result.content[0].text).toContain("(default)");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_disclosures handles empty list", async () => {
    vi.mocked(client.disclosures.list).mockResolvedValueOnce([]);

    const result = await tools["saperly_list_disclosures"]({});

    expect(result.content[0].text).toContain("no disclosures configured");
    expect(result.isError).toBeUndefined();
  });
});
