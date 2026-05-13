import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly, AuditEvent } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

function formatAuditRow(event: AuditEvent): string {
  // Defensive null-coalesce: TS SDK types `createdAt` non-optional but a
  // wire-format drift (e.g. server emits null on a future code path) would
  // otherwise crash the formatter and surface as opaque 'unexpected error'
  // to the LLM caller.
  const ts = (event.createdAt ?? "").slice(0, 16); // YYYY-MM-DDTHH:MM
  const data = event.data;
  switch (event.type) {
    case "call": {
      const direction = String(data.direction ?? "");
      const peer = direction === "inbound" ? data.fromNumber : data.toNumber;
      const status = String(data.status ?? "");
      return `  ${ts}  call (${direction}) ${peer ?? "?"}  ${status}`;
    }
    case "sms": {
      const to = String(data.toNumber ?? "?");
      const status = String(data.status ?? "");
      return `  ${ts}  sms → ${to}  ${status}`;
    }
    case "compliance_event": {
      const eventType = String(data.eventType ?? "");
      const phone = data.phoneNumber ? ` ${data.phoneNumber}` : "";
      return `  ${ts}  event ${eventType}${phone}`;
    }
    case "billing_transaction": {
      const txType = String(data.transactionType ?? "");
      const cents = Number(data.amountCents ?? 0);
      const dollars = (cents / 100).toFixed(2);
      const sign = cents >= 0 ? "+" : "";
      return `  ${ts}  ${txType} ${sign}$${dollars}`;
    }
    default: {
      // Exhaustiveness check: adding a 5th value to AuditEventType forces
      // a compile error here so MCP can't silently emit blank rows. We
      // narrow on `event.type` because the SDK's AuditEvent is a single
      // interface (not a discriminated union) — the discriminator narrows
      // even when the surrounding shape doesn't.
      const _exhaustive: never = event.type;
      void _exhaustive;
      return "";
    }
  }
}

export function registerAuditTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_audit_list",
    "list recent activity for the api key bound to this mcp client (calls, sms, compliance events, billing transactions). default scope is the caller's own key; pass another uuid you own to read its activity. inbound carrier traffic is not included (no actor key stamp). time-sorted DESC by created_at; max 500 events per call.",
    {
      apiKeyId: z
        .string()
        .optional()
        .describe("'self' (default) or a uuid you own"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("max results, default 100"),
      eventTypes: z
        .array(z.enum(["call", "sms", "compliance_event", "billing_transaction"]))
        .optional()
        .describe("filter to specific event types"),
    },
    async (args) => {
      try {
        const result = await client.audit.list(args);
        if (result.events.length === 0) {
          return toolResult("no activity found for this key.");
        }
        const lines = result.events.map(formatAuditRow);
        return toolResult(
          `${result.events.length} event(s) for key ${result.apiKeyId}:\n\n${lines.join("\n")}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
