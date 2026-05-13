import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_KEY_SETTABLE_PERMISSIONS, type Saperly, type ApiKey } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

function formatKeyRow(key: ApiKey): string {
  const scope = key.lineId ? `line ${key.lineId.slice(0, 8)}…` : "all lines";
  const cap =
    key.monthlyCapCents === null
      ? "no cap"
      : `$${(key.monthlyCapCents / 100).toFixed(2)}/mo cap`;
  const status = key.revokedAt ? "REVOKED" : "active";
  return `  ${key.keyPrefix}…  ${key.name}  ${key.permissions}  ${scope}  ${cap}  ${status}`;
}

export function registerKeysTools(server: McpServer, client: Saperly): void {
  server.tool(
    "saperly_key_create",
    "mint a new child api key. requires service-key auth (sk_svc_...). returns the plaintext key ONCE — save it immediately. permissions: full | call_only | sms_only | read_only.",
    {
      name: z.string().min(1).max(64).describe("human label for the new key"),
      line_id: z
        .string()
        .uuid()
        .optional()
        .describe("scope key to a specific line"),
      permissions: z
        .enum(API_KEY_SETTABLE_PERMISSIONS)
        .default("full")
        .describe("permission tier"),
      monthly_cap_cents: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("monthly spend cap in cents; omit for unlimited"),
      agent_label: z.string().max(64).optional(),
      environment: z.enum(["test", "live"]).optional(),
    },
    async (args) => {
      try {
        const created = await client.keys.create({
          name: args.name,
          lineId: args.line_id,
          permissions: args.permissions,
          monthlyCapCents: args.monthly_cap_cents,
          agentLabel: args.agent_label,
          environment: args.environment,
        });
        return toolResult(
          [
            `Child api key created: ${created.id}`,
            ``,
            `⚠ SAVE THIS NOW — you won't see it again:`,
            ``,
            `    ${created.plaintextKey}`,
            ``,
            `Prefix:        ${created.keyPrefix}…`,
            `Environment:   ${created.environment}`,
            `Permissions:   ${created.permissions}`,
            `Line scope:    ${created.lineId ?? "all lines"}`,
            `Monthly cap:   ${created.monthlyCapCents !== null ? "$" + (created.monthlyCapCents / 100).toFixed(2) : "none"}`,
          ].join("\n"),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_key_list",
    "list child api keys minted by the service key bound to this mcp client. metadata only — no plaintext.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("max results, 1-100, default 50"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("pagination offset, default 0"),
    },
    async (args) => {
      try {
        const list = await client.keys.list({
          limit: args.limit,
          offset: args.offset,
        });
        if (!list.keys || list.keys.length === 0) {
          return toolResult(
            "No child api keys yet. Use saperly_key_create to mint one.",
          );
        }
        const header = `${list.keys.length} of ${list.total} child api key(s):\n`;
        return toolResult(header + list.keys.map(formatKeyRow).join("\n"));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_key_get",
    "retrieve a single child api key by id. metadata only — no plaintext. includes revoked keys (so you can see when a key was revoked).",
    {
      id: z.string().describe("api key id (full uuid; NOT prefix)"),
    },
    async (args) => {
      try {
        const key = await client.keys.get(args.id);
        return toolResult(formatKeyRow(key));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_key_update",
    "update a child api key's label, scope, permissions, or cap. partial update — only fields you pass are changed. pass null to clear agent_label / line_id / monthly_cap_cents.",
    {
      id: z.string(),
      name: z.string().min(1).max(64).optional(),
      agent_label: z.string().max(64).nullable().optional(),
      line_id: z.string().uuid().nullable().optional(),
      permissions: z.enum(API_KEY_SETTABLE_PERMISSIONS).optional(),
      monthly_cap_cents: z.number().int().positive().nullable().optional(),
    },
    async (args) => {
      try {
        const updated = await client.keys.update(args.id, {
          name: args.name,
          agentLabel: args.agent_label,
          lineId: args.line_id,
          permissions: args.permissions,
          monthlyCapCents: args.monthly_cap_cents,
        });
        return toolResult(`Updated:\n${formatKeyRow(updated)}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_key_delete",
    "soft-revoke a child api key. DESTRUCTIVE — the key stops working immediately (no grace window for child keys). requires confirm=true.",
    {
      id: z.string(),
      confirm: z
        .literal(true)
        .describe("must be exactly true. set this to acknowledge destruction."),
    },
    async (args) => {
      // Defense-in-depth: the Zod schema above already rejects confirm !== true
      // at the McpServer boundary. This handler-level check is a tripwire for
      // any transport that bypasses schema validation (custom test harnesses,
      // alternate MCP server implementations, future SDK API changes).
      if (args.confirm !== true) {
        return toolError(new Error("confirm must be exactly true to delete a key"));
      }
      try {
        const revoked = await client.keys.delete(args.id);
        return toolResult(
          `Revoked child api key ${revoked.id} at ${revoked.revokedAt}. The key stops working immediately.`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_key_rotate",
    "atomic rotate: revoke the old child api key + mint a new one with the same permissions/scope/cap. returns the new plaintext key ONCE. DESTRUCTIVE — old key stops working. requires confirm=true.",
    {
      id: z.string().describe("id of the child api key to rotate"),
      confirm: z
        .literal(true)
        .describe("must be exactly true. set this to acknowledge rotation."),
    },
    async (args) => {
      // Defense-in-depth tripwire — see saperly_key_delete handler comment.
      if (args.confirm !== true) {
        return toolError(new Error("confirm must be exactly true to rotate a key"));
      }
      try {
        const rotated = await client.keys.rotate(args.id);
        return toolResult(
          [
            `Rotated: old ${args.id} → new ${rotated.id}`,
            ``,
            `⚠ SAVE THE NEW KEY NOW — you won't see it again:`,
            ``,
            `    ${rotated.plaintextKey}`,
            ``,
            `Inherits the old key's permissions, scope, and cap.`,
            `Rotated from:  ${rotated.rotatedFrom}`,
          ].join("\n"),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
