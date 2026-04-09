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
    c.recordingUrl ? `recording: ${c.recordingUrl}` : null,
    c.startedAt ? `started: ${c.startedAt}` : null,
    c.endedAt ? `ended: ${c.endedAt}` : null,
    `created: ${c.createdAt}`,
    c.transcript && Array.isArray(c.transcript) && c.transcript.length > 0
      ? `transcript: ${c.transcript.length} turns`
      : null,
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

  server.tool(
    "saperly_conversation_call",
    "make an AI phone call. saperly runs the LLM with your instructions. returns the full transcript when the call ends. no webhook or backend needed.",
    {
      lineId: z.string().describe("line to call from"),
      toNumber: z
        .string()
        .describe("phone number to call (E.164 format, e.g. +15551234567)"),
      topic: z
        .string()
        .describe(
          "instructions for the AI agent. what should it accomplish on this call?",
        ),
      beginMessage: z
        .string()
        .optional()
        .describe("first thing the agent says when the call connects"),
      maxDurationSeconds: z
        .number()
        .optional()
        .describe("maximum call duration. default 300 (5 minutes)"),
    },
    async (args) => {
      try {
        const call = await client.calls.conversation({
          lineId: args.lineId,
          toNumber: args.toNumber,
          topic: args.topic,
          beginMessage: args.beginMessage,
          maxDurationSeconds: args.maxDurationSeconds,
        });

        const maxDuration = (args.maxDurationSeconds ?? 300) * 1000 + 30_000;
        const startTime = Date.now();
        let result = call;

        while (Date.now() - startTime < maxDuration) {
          result = await client.calls.get(call.id);
          if (["completed", "failed", "no_answer"].includes(result.status))
            break;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        const parts = [
          `call_id: ${result.id}`,
          `status: ${result.status}`,
          result.durationSec != null ? `duration: ${result.durationSec}s` : null,
          result.recordingUrl ? `recording: ${result.recordingUrl}` : null,
        ].filter(Boolean) as string[];

        if (
          result.transcript &&
          Array.isArray(result.transcript) &&
          result.transcript.length > 0
        ) {
          parts.push("\ntranscript:");
          for (const turn of result.transcript) {
            const t = turn as Record<string, unknown>;
            parts.push(`  [${String(t.role ?? "unknown")}]: ${String(t.text ?? "")}`);
          }
        } else if (result.status === "completed") {
          parts.push("\n(no transcript available)");
        }

        return toolResult(parts.join("\n"));
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
