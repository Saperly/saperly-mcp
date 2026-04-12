import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerVoicesTools } from "../tools/voices.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    voices: {
      list: vi.fn(),
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
  registerVoicesTools(mockServer, client);
  return tools;
}

describe("voices tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_list_voices returns formatted voice list", async () => {
    vi.mocked(client.voices.list).mockResolvedValueOnce({
      voices: [
        {
          id: "nova",
          name: "Nova",
          gender: "female",
          accent: "american",
          style: "conversational",
        },
        {
          id: "echo",
          name: "Echo",
          gender: "male",
          accent: "american",
          style: "warm",
        },
      ],
    });

    const result = await tools["saperly_list_voices"]({});

    expect(result.content[0].text).toContain("2 voice(s)");
    expect(result.content[0].text).toContain("nova");
    expect(result.content[0].text).toContain("Nova");
    expect(result.content[0].text).toContain("female");
    expect(result.content[0].text).toContain("echo");
    expect(result.content[0].text).toContain("Echo");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_voices returns empty message", async () => {
    vi.mocked(client.voices.list).mockResolvedValueOnce({
      voices: [],
    });

    const result = await tools["saperly_list_voices"]({});

    expect(result.content[0].text).toContain("no voices available");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_voices returns error on failure", async () => {
    vi.mocked(client.voices.list).mockRejectedValueOnce(
      new Error("Service unavailable"),
    );

    const result = await tools["saperly_list_voices"]({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Service unavailable");
  });
});
