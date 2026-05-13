import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import {
  AgentScopeError,
  IdempotencyKeyReusedError,
  RateLimitedError,
} from "@saperly/sdk";
import { registerKeysTools } from "../tools/keys.js";

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
    keys: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      rotate: vi.fn(),
    },
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
  registerKeysTools(mockServer, client);
  return registrations;
}

describe("keys tools", () => {
  let client: Saperly;
  let tools: Record<string, ToolRegistration>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    tools = captureTools(client);
  });

  it("registers exactly 6 tools with saperly_key_ prefix", () => {
    const names = Object.keys(tools).filter((n) =>
      n.startsWith("saperly_key_"),
    );
    expect(names.sort()).toEqual([
      "saperly_key_create",
      "saperly_key_delete",
      "saperly_key_get",
      "saperly_key_list",
      "saperly_key_rotate",
      "saperly_key_update",
    ]);
  });

  it("saperly_key_create surfaces plaintext + SAVE THIS NOW warning", async () => {
    vi.mocked(client.keys.create).mockResolvedValueOnce({
      id: "key_abc",
      plaintextKey: "sk_test_PLAINTEXT_xxxxxxxxxxxxxxxx",
      keyPrefix: "sk_test_abc",
      environment: "test",
      name: "test-key",
      agentLabel: null,
      lineId: null,
      permissions: "full",
      monthlyCapCents: null,
      monthlySpendCents: 0,
      createdAt: "2026-05-12T00:00:00Z",
      revokedAt: null,
      lastUsedAt: null,
      rotatedFrom: null,
      createdByServiceKeyId: "svc_abc",
    });
    const result = await tools["saperly_key_create"].handler({
      name: "test-key",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain(
      "sk_test_PLAINTEXT_xxxxxxxxxxxxxxxx",
    );
    expect(result.content[0].text).toContain("SAVE THIS NOW");
  });

  it("saperly_key_list returns 'No child api keys yet' on empty", async () => {
    vi.mocked(client.keys.list).mockResolvedValueOnce({
      keys: [],
      total: 0,
    });
    const result = await tools["saperly_key_list"].handler({});
    expect(result.content[0].text).toContain("No child api keys yet");
  });

  it("saperly_key_list formats N of M header + per-row prefix/permissions/scope", async () => {
    vi.mocked(client.keys.list).mockResolvedValueOnce({
      keys: [
        {
          id: "k1",
          keyPrefix: "sk_test_aaaaaaaa",
          environment: "test",
          name: "alpha",
          agentLabel: null,
          lineId: null,
          permissions: "full",
          monthlyCapCents: null,
          monthlySpendCents: 0,
          createdAt: "2026-01-01T00:00:00Z",
          revokedAt: null,
          lastUsedAt: null,
          rotatedFrom: null,
          createdByServiceKeyId: "svc_a",
        },
        {
          id: "k2",
          keyPrefix: "sk_test_bbbbbbbb",
          environment: "test",
          name: "beta",
          agentLabel: null,
          lineId: "line_xyz12345",
          permissions: "sms_only",
          monthlyCapCents: 500,
          monthlySpendCents: 100,
          createdAt: "2026-01-02T00:00:00Z",
          revokedAt: null,
          lastUsedAt: null,
          rotatedFrom: null,
          createdByServiceKeyId: "svc_a",
        },
      ],
      total: 2,
    });
    const result = await tools["saperly_key_list"].handler({});
    expect(result.content[0].text).toContain("2 of 2 child api key(s)");
    expect(result.content[0].text).toContain("sk_test_aaaaaaaa");
    expect(result.content[0].text).toContain("all lines");
    expect(result.content[0].text).toContain("line line_xyz");
    expect(result.content[0].text).toContain("$5.00/mo cap");
  });

  it("saperly_key_delete zod schema REJECTS confirm:false / missing / string 'true'", () => {
    const schema = z.object(
      tools["saperly_key_delete"].schema as Record<string, z.ZodTypeAny>,
    );
    expect(schema.safeParse({ id: "k1", confirm: false }).success).toBe(false);
    expect(schema.safeParse({ id: "k1" }).success).toBe(false);
    expect(schema.safeParse({ id: "k1", confirm: "true" }).success).toBe(false);
    expect(schema.safeParse({ id: "k1", confirm: true }).success).toBe(true);
  });

  it("saperly_key_rotate zod schema gates confirm same way", () => {
    const schema = z.object(
      tools["saperly_key_rotate"].schema as Record<string, z.ZodTypeAny>,
    );
    expect(schema.safeParse({ id: "k1", confirm: false }).success).toBe(false);
    expect(schema.safeParse({ id: "k1" }).success).toBe(false);
    expect(schema.safeParse({ id: "k1", confirm: true }).success).toBe(true);
  });

  // /review hardening (2026-05-12): handler-level defense-in-depth tripwire.
  // If a transport bypasses Zod (custom harness, alternate MCP server impl),
  // the handler itself must still reject confirm !== true.
  it("saperly_key_delete handler REJECTS confirm:false even when Zod is bypassed", async () => {
    const result = await tools["saperly_key_delete"].handler({
      id: "key_xyz",
      confirm: false as unknown as true,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("confirm must be exactly true");
    expect(client.keys.delete).not.toHaveBeenCalled();
  });

  it("saperly_key_rotate handler REJECTS confirm:false even when Zod is bypassed", async () => {
    const result = await tools["saperly_key_rotate"].handler({
      id: "key_xyz",
      confirm: false as unknown as true,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("confirm must be exactly true");
    expect(client.keys.rotate).not.toHaveBeenCalled();
  });

  it("saperly_key_rotate surfaces NEW plaintext + warning + rotatedFrom", async () => {
    vi.mocked(client.keys.rotate).mockResolvedValueOnce({
      id: "key_new",
      plaintextKey: "sk_test_NEW_PLAINTEXT_zzzzzzzz",
      keyPrefix: "sk_test_new",
      environment: "test",
      name: "rotated-key",
      agentLabel: null,
      lineId: null,
      permissions: "full",
      monthlyCapCents: null,
      monthlySpendCents: 0,
      createdAt: "2026-05-12T00:00:00Z",
      revokedAt: null,
      lastUsedAt: null,
      rotatedFrom: "key_old",
      createdByServiceKeyId: "svc_a",
    });
    const result = await tools["saperly_key_rotate"].handler({
      id: "key_old",
      confirm: true,
    });
    expect(result.content[0].text).toContain("sk_test_NEW_PLAINTEXT_zzzzzzzz");
    expect(result.content[0].text).toContain("SAVE THE NEW KEY NOW");
    expect(result.content[0].text).toContain("key_old → new key_new");
    expect(result.content[0].text).toContain("Rotated from:  key_old");
  });

  it("surfaces AgentScopeError via toolError", async () => {
    vi.mocked(client.keys.create).mockRejectedValueOnce(
      new AgentScopeError("scope mismatch", 403, [
        { field: "line_id", message: "ln_xxx" },
      ]),
    );
    const result = await tools["saperly_key_create"].handler({ name: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("agent scope error");
  });

  it("surfaces IdempotencyKeyReusedError via toolError with friendly hint", async () => {
    vi.mocked(client.keys.create).mockRejectedValueOnce(
      new IdempotencyKeyReusedError("duplicate", 409),
    );
    const result = await tools["saperly_key_create"].handler({ name: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("idempotency key reused");
    expect(result.content[0].text).toContain("NEW Idempotency-Key");
  });

  it("surfaces RateLimitedError via toolError", async () => {
    vi.mocked(client.keys.list).mockRejectedValueOnce(
      new RateLimitedError("slow down", 429),
    );
    const result = await tools["saperly_key_list"].handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("rate limited");
  });
});

describe("manifest sync", () => {
  it("manifest.json contains exactly 36 tools (30 existing + 6 new) including all 6 saperly_key_ tools", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const manifestPath = resolve(__dirname, "..", "..", "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      tools: { name: string }[];
    };
    expect(manifest.tools).toHaveLength(36);
    const keysTools = manifest.tools.filter((t) =>
      t.name.startsWith("saperly_key_"),
    );
    expect(keysTools).toHaveLength(6);
  });

  // /review hardening (2026-05-12): a future PR that adds a saperly_key_*
  // tool but forgets the groups[] entry, or sets group to the wrong string,
  // would slip past the count-only check above.
  it("manifest declares the 'keys' group AND every saperly_key_* tool maps to it", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const manifestPath = resolve(__dirname, "..", "..", "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      groups: { name: string; description: string }[];
      tools: { name: string; group: string; description: string }[];
    };
    expect(manifest.groups.map((g) => g.name)).toContain("keys");
    const keysTools = manifest.tools.filter((t) =>
      t.name.startsWith("saperly_key_"),
    );
    for (const t of keysTools) {
      expect(t.group).toBe("keys");
    }
  });
});
