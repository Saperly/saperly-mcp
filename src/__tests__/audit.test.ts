import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import {
  AgentScopeError,
  AgentCapExceededError,
  AgentPermissionDeniedError,
  M3FraudBlockError,
} from "@saperly/sdk";
import { registerAuditTools } from "../tools/audit.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

interface ToolRegistration {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: ToolHandler;
}

function createMockClient() {
  return {
    audit: { list: vi.fn() },
  } as unknown as Saperly;
}

function captureTools(client: Saperly) {
  const registrations: Record<string, ToolRegistration> = {};
  const mockServer = {
    tool: (
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: ToolHandler,
    ) => {
      registrations[name] = { name, description, schema, handler };
    },
  } as unknown as McpServer;
  registerAuditTools(mockServer, client);
  return registrations;
}

describe("audit tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolRegistration>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("registers a tool named saperly_audit_list", () => {
    expect(tools["saperly_audit_list"]).toBeDefined();
    expect(tools["saperly_audit_list"].description).toContain(
      "list recent activity for the api key bound to this mcp client",
    );
  });

  it("invokes client.audit.list with caller-supplied args (preserves apiKeyId default at SDK boundary)", async () => {
    vi.mocked(client.audit.list).mockResolvedValueOnce({
      events: [],
      limit: 100,
      apiKeyId: "key-self",
    });

    await tools["saperly_audit_list"].handler({});

    // MCP layer forwards args verbatim; SDK applies the `self` default.
    // Verify we hand off the empty args (not undefined or a coerced shape).
    expect(client.audit.list).toHaveBeenCalledTimes(1);
    expect(client.audit.list).toHaveBeenCalledWith({});
  });

  it("returns friendly text on empty results", async () => {
    vi.mocked(client.audit.list).mockResolvedValueOnce({
      events: [],
      limit: 100,
      apiKeyId: "key-self",
    });

    const result = await tools["saperly_audit_list"].handler({});

    expect(result.content[0].text).toBe("no activity found for this key.");
    expect(result.isError).toBeUndefined();
  });

  it("formats a mixed-type result with one line per event", async () => {
    vi.mocked(client.audit.list).mockResolvedValueOnce({
      events: [
        {
          type: "call",
          id: "call-1",
          createdAt: "2026-05-10T12:34:56Z",
          data: {
            direction: "outbound",
            fromNumber: "+14155550001",
            toNumber: "+14155550002",
            status: "completed",
            durationSec: 42,
          },
        },
        {
          type: "sms",
          id: "sms-1",
          createdAt: "2026-05-10T12:30:00Z",
          data: {
            fromNumber: "+14155550001",
            toNumber: "+14155550009",
            status: "delivered",
            segments: 1,
          },
        },
        {
          type: "compliance_event",
          id: "evt-1",
          createdAt: "2026-05-10T12:20:00Z",
          data: {
            eventType: "disclosure_played",
            phoneNumber: "+14155550009",
          },
        },
        {
          type: "billing_transaction",
          id: "tx-1",
          createdAt: "2026-05-10T12:10:00Z",
          data: {
            transactionType: "usage_debit",
            amountCents: -125,
          },
        },
      ],
      limit: 100,
      apiKeyId: "key-self",
    });

    const result = await tools["saperly_audit_list"].handler({});

    const text = result.content[0].text;
    expect(result.isError).toBeUndefined();
    expect(text).toContain("4 event(s) for key key-self");
    // Each line uses the YYYY-MM-DDTHH:MM truncated timestamp.
    expect(text).toContain("2026-05-10T12:34");
    expect(text).toContain("2026-05-10T12:30");
    expect(text).toContain("2026-05-10T12:20");
    expect(text).toContain("2026-05-10T12:10");
    // Per-type key fields.
    expect(text).toContain("call (outbound)");
    expect(text).toContain("+14155550002");
    expect(text).toContain("completed");
    expect(text).toContain("sms → +14155550009");
    expect(text).toContain("delivered");
    expect(text).toContain("event disclosure_played");
    expect(text).toContain("usage_debit");
    // Negative cents render as `$-1.25` (formatter prefixes only the
    // positive sign; `.toFixed` carries the minus on the number itself).
    expect(text).toContain("$-1.25");
    // 4 events should produce 4 lines (plus the header) — count newlines
    // in the body after the blank-line separator.
    const body = text.split("\n\n").slice(-1)[0];
    expect(body.split("\n")).toHaveLength(4);
  });

  it("surfaces all 4 new typed errors with structured details where present", async () => {
    // 1. agent_cap_exceeded — detail-bearing
    vi.mocked(client.audit.list).mockRejectedValueOnce(
      new AgentCapExceededError("monthly cap reached", 402, [
        { field: "spent_cents", message: "5000" },
        { field: "cap_cents", message: "5000" },
        { field: "cycle_reset_at", message: "2026-06-01T00:00:00Z" },
      ]),
    );
    const capResult = await tools["saperly_audit_list"].handler({});
    expect(capResult.isError).toBe(true);
    expect(capResult.content[0].text).toContain("agent cap exceeded");
    expect(capResult.content[0].text).toContain("spent_cents=5000");
    expect(capResult.content[0].text).toContain("cap_cents=5000");
    expect(capResult.content[0].text).toContain(
      "cycle_reset_at=2026-06-01T00:00:00Z",
    );
    expect(capResult.content[0].text).toContain(
      "raise the cap or wait for the cycle to reset",
    );

    // 2. agent_scope_error — detail-bearing (line_id)
    vi.mocked(client.audit.list).mockRejectedValueOnce(
      new AgentScopeError("line-scoped key cross-sibling read", 403, [
        { field: "line_id", message: "ln_abc" },
      ]),
    );
    const scopeResult = await tools["saperly_audit_list"].handler({});
    expect(scopeResult.isError).toBe(true);
    expect(scopeResult.content[0].text).toContain("agent scope error");
    expect(scopeResult.content[0].text).toContain("line_id=ln_abc");
    expect(scopeResult.content[0].text).toContain(
      "restricted to a specific line",
    );

    // 3. agent_permission_denied — detail-bearing (tier, verb)
    vi.mocked(client.audit.list).mockRejectedValueOnce(
      new AgentPermissionDeniedError("verb not permitted", 403, [
        { field: "tier", message: "read_only" },
        { field: "verb", message: "call" },
      ]),
    );
    const permResult = await tools["saperly_audit_list"].handler({});
    expect(permResult.isError).toBe(true);
    expect(permResult.content[0].text).toContain("agent permission denied");
    expect(permResult.content[0].text).toContain("tier=read_only");
    expect(permResult.content[0].text).toContain("verb=call");
    expect(permResult.content[0].text).toContain(
      "tier doesn't permit this operation",
    );

    // 4. m3_fraud_block — no details by design
    vi.mocked(client.audit.list).mockRejectedValueOnce(
      new M3FraudBlockError("request blocked", 403),
    );
    const fraudResult = await tools["saperly_audit_list"].handler({});
    expect(fraudResult.isError).toBe(true);
    expect(fraudResult.content[0].text).toContain(
      "request blocked by fraud heuristic",
    );
    expect(fraudResult.content[0].text).toContain("contact support");
  });

  // Testing-specialist coverage: assert the zod schema is structurally
  // correct so a regression that loosened bounds (e.g. removing .max(500))
  // would break the test rather than ship.
  it("zod schema rejects out-of-bounds limit and unknown event types", () => {
    const schema = z.object(
      tools["saperly_audit_list"].schema as Record<string, z.ZodTypeAny>,
    );

    expect(schema.safeParse({ limit: 9999 }).success).toBe(false);
    expect(schema.safeParse({ limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ limit: -5 }).success).toBe(false);
    expect(schema.safeParse({ limit: 3.7 }).success).toBe(false); // .int()
    expect(
      schema.safeParse({ eventTypes: ["nonsense"] }).success,
    ).toBe(false);

    // Valid shapes pass.
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ apiKeyId: "self", limit: 100 }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({ eventTypes: ["call", "sms"] }).success,
    ).toBe(true);
  });
});
