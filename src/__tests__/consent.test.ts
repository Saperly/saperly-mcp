import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { ConsentAlreadyGrantedError } from "@saperly/sdk";
import { registerConsentTools } from "../tools/consent.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

function createMockClient() {
  return {
    consent: {
      grant: vi.fn(),
      check: vi.fn(),
      revoke: vi.fn(),
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
  registerConsentTools(mockServer, client);
  return tools;
}

describe("consent tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("saperly_grant_consent returns success message", async () => {
    vi.mocked(client.consent.grant).mockResolvedValueOnce({
      id: "consent-1",
      phoneNumber: "+14155551234",
      lineId: "line-1",
      consentType: "explicit_outbound",
      status: "active",
      grantedAt: "2026-03-28T00:00:00Z",
      revokedAt: null,
    });

    const result = await tools["saperly_grant_consent"]({
      lineId: "line-1",
      phoneNumber: "+14155551234",
      consentType: "explicit_outbound",
      source: "mcp_tool",
    });

    expect(result.content[0].text).toContain("consent granted");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_check_consent returns active consent details", async () => {
    vi.mocked(client.consent.check).mockResolvedValueOnce({
      status: "active",
      consent: {
        id: "consent-1",
        phoneNumber: "+14155551234",
        lineId: "line-1",
        consentType: "explicit_outbound",
        status: "active",
        grantedAt: "2026-03-28T00:00:00Z",
        revokedAt: null,
      },
    });

    const result = await tools["saperly_check_consent"]({
      phoneNumber: "+14155551234",
    });

    expect(result.content[0].text).toContain("consent active");
    expect(result.content[0].text).toContain("explicit_outbound");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_check_consent returns no consent message", async () => {
    vi.mocked(client.consent.check).mockResolvedValueOnce({
      status: "none",
      consent: null,
    });

    const result = await tools["saperly_check_consent"]({
      phoneNumber: "+14155551234",
    });

    expect(result.content[0].text).toContain("no active consent");
    expect(result.content[0].text).toContain("saperly_grant_consent");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_revoke_consent returns confirmation", async () => {
    vi.mocked(client.consent.revoke).mockResolvedValueOnce({
      id: "consent-1",
      phoneNumber: "+14155551234",
      lineId: "line-1",
      consentType: "explicit_outbound",
      status: "revoked",
      grantedAt: "2026-03-28T00:00:00Z",
      revokedAt: "2026-03-28T01:00:00Z",
    });

    const result = await tools["saperly_revoke_consent"]({
      phoneNumber: "+14155551234",
    });

    expect(result.content[0].text).toContain("consent revoked");
    expect(result.content[0].text).toContain("+14155551234");
    expect(result.isError).toBeUndefined();
  });

  it("saperly_grant_consent handles duplicate gracefully", async () => {
    vi.mocked(client.consent.grant).mockRejectedValueOnce(
      new ConsentAlreadyGrantedError("Consent already exists"),
    );

    const result = await tools["saperly_grant_consent"]({
      lineId: "line-1",
      phoneNumber: "+14155551234",
      consentType: "explicit_outbound",
      source: "mcp_tool",
    });

    // Not an error — duplicate consent is informational
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("consent already exists");
  });
});
