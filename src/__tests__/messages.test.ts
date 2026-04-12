import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { registerMessagesTools } from "../tools/messages.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
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
  registerMessagesTools(mockServer, client);
  return tools;
}

describe("messages tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_send_sms returns formatted message on success", async () => {
    vi.mocked(client.messages.send).mockResolvedValueOnce({
      id: "msg-1",
      lineId: "line-1",
      to: "+14155551234",
      text: "Hello there",
      status: "queued",
      createdAt: "2026-04-08T00:00:00Z",
    });

    const result = await tools["saperly_send_sms"]({
      lineId: "line-1",
      to: "+14155551234",
      text: "Hello there",
    });

    expect(result.content[0].text).toContain("SMS sent!");
    expect(result.content[0].text).toContain("msg-1");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.content[0].text).toContain("queued");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_send_sms returns error on failure", async () => {
    vi.mocked(client.messages.send).mockRejectedValueOnce(
      new Error("24-hour window expired"),
    );

    const result = await tools["saperly_send_sms"]({
      lineId: "line-1",
      to: "+14155551234",
      text: "Hello",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("24-hour window expired");
  });

  it("saperly_list_conversations returns formatted list", async () => {
    vi.mocked(client.conversations.list).mockResolvedValueOnce({
      conversations: [
        {
          lineId: "line-1",
          phoneNumber: "+14155551234",
          linePhoneNumber: "+14155550123",
          messageCount: 5,
          lastMessageAt: "2026-04-08T12:00:00Z",
          lastMessageText: "Thanks!",
          lastMessageDirection: "inbound" as const,
        },
        {
          lineId: "line-1",
          phoneNumber: "+14155559876",
          linePhoneNumber: "+14155550123",
          messageCount: 1,
          lastMessageAt: "2026-04-07T10:00:00Z",
          lastMessageText: null,
          lastMessageDirection: "outbound" as const,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_list_conversations"]({});

    expect(result.content[0].text).toContain("2 conversation(s)");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.content[0].text).toContain("5 msgs");
    expect(result.content[0].text).toContain("Thanks!");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_list_conversations returns empty message", async () => {
    vi.mocked(client.conversations.list).mockResolvedValueOnce({
      conversations: [],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_list_conversations"]({});

    expect(result.content[0].text).toContain("no conversations found");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_conversation returns message history", async () => {
    vi.mocked(client.conversations.messages).mockResolvedValueOnce({
      messages: [
        {
          direction: "inbound" as const,
          text: "Hi there",
          timestamp: "2026-04-08T12:00:00Z",
        },
        {
          direction: "outbound" as const,
          text: "Hello! How can I help?",
          timestamp: "2026-04-08T12:00:05Z",
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_get_conversation"]({
      lineId: "line-1",
      phoneNumber: "+14155551234",
    });

    expect(result.content[0].text).toContain("2 message(s)");
    expect(result.content[0].text).toContain("[inbound] Hi there");
    expect(result.content[0].text).toContain("[outbound] Hello! How can I help?");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_get_conversation returns empty message", async () => {
    vi.mocked(client.conversations.messages).mockResolvedValueOnce({
      messages: [],
      hasMore: false,
      nextCursor: null,
    });

    const result = await tools["saperly_get_conversation"]({
      lineId: "line-1",
      phoneNumber: "+14155551234",
    });

    expect(result.content[0].text).toContain("no messages in this conversation");
    expect(result.isError).toBeUndefined();
  });
});
