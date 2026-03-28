import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly, Call } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

function formatCall(c: Call): string {
  return [
    `id: ${c.id}`,
    `direction: ${c.direction}`,
    `from: ${c.fromNumber}`,
    `to: ${c.toNumber}`,
    `status: ${c.status}`,
    c.durationSec != null ? `duration: ${c.durationSec}s` : null,
    c.startedAt ? `started: ${c.startedAt}` : null,
    c.endedAt ? `ended: ${c.endedAt}` : null,
    `created: ${c.createdAt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function registerCallsTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_create_call",
    "make an outbound phone call from one of your lines. consent must be granted first (use saperly_grant_consent). costs credits.",
    {
      lineId: z.string().describe("the line id to call from"),
      toNumber: z
        .string()
        .describe("phone number to call in E.164 format (e.g. +14155551234)"),
    },
    async (args) => {
      try {
        const call = await client.calls.create(args);
        return toolResult(`call initiated!\n\n${formatCall(call)}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_list_calls",
    "list recent calls. optionally filter by line or status.",
    {
      lineId: z.string().optional().describe("filter by line id"),
      status: z.string().optional().describe("filter: initiated, ringing, in_progress, completed, failed, no_answer"),
      limit: z.number().optional().describe("max results (default 20, max 100)"),
      offset: z.number().optional().describe("pagination offset"),
    },
    async (args) => {
      try {
        const result = await client.calls.list(args);
        if (result.calls.length === 0) {
          return toolResult("no calls found.");
        }
        const list = result.calls
          .map(
            (c) =>
              `  ${c.createdAt.slice(0, 16)}  ${c.direction}  ${c.fromNumber} → ${c.toNumber}  ${c.status}  ${c.durationSec ?? "-"}s`,
          )
          .join("\n");
        return toolResult(`${result.total} call(s):\n\n${list}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_get_call",
    "get details for a specific call.",
    {
      callId: z.string().describe("the call id"),
    },
    async ({ callId }) => {
      try {
        const call = await client.calls.get(callId);
        return toolResult(formatCall(call));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_hangup_call",
    "terminate an active call. irreversible.",
    {
      callId: z.string().describe("the call id to hang up"),
    },
    async ({ callId }) => {
      try {
        const call = await client.calls.hangup(callId);
        return toolResult(
          `call ${callId} terminated. final status: ${call.status}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
