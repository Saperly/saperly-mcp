import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerComplianceTools } from "../tools/compliance.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    compliance: { audit: vi.fn() },
  } as unknown as Saperly;
}

function captureTools(client: Saperly) {
  const tools: Record<string, ToolHandler> = {};
  const mockServer = {
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      tools[name] = handler;
    },
  } as unknown as McpServer;
  registerComplianceTools(mockServer, client);
  return tools;
}

describe("compliance tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_compliance_audit returns formatted events", async () => {
    vi.mocked(client.compliance.audit).mockResolvedValueOnce({
      events: [
        {
          id: "evt-1",
          lineId: "line-1",
          callId: "call-1",
          phoneNumber: "+14155551234",
          eventType: "disclosure_played",
          metadata: null,
          createdAt: "2026-03-28T00:00:00Z",
        },
      ],
      total: 1,
    });

    const result = await tools["saperly_compliance_audit"]({});

    expect(result.content[0].text).toContain("1 event(s)");
    expect(result.content[0].text).toContain("disclosure_played");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_compliance_audit handles empty results", async () => {
    vi.mocked(client.compliance.audit).mockResolvedValueOnce({
      events: [],
      total: 0,
    });

    const result = await tools["saperly_compliance_audit"]({});

    expect(result.content[0].text).toContain("no compliance events found");
    expect(result.isError).toBeUndefined();
  });
});
