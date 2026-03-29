import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly, Line } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

function formatLine(l: Line): string {
  return [
    `phone: ${l.phoneNumber}`,
    `id: ${l.id}`,
    `name: ${l.name}`,
    `mode: ${l.mode}`,
    `status: ${l.status}`,
    `environment: ${l.environment}`,
    l.webhookUrl ? `webhook: ${l.webhookUrl}` : null,
    l.audioHandlerUrl ? `audio handler: ${l.audioHandlerUrl}` : null,
    l.statusCallbackUrl ? `status callback: ${l.statusCallbackUrl}` : null,
    `created: ${l.createdAt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function registerLinesTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_create_line",
    "provision a new phone line for your ai agent. returns the assigned phone number. mode: text (saperly handles S2T+T2S, your webhook gets text) or audio (raw websocket).",
    {
      name: z.string().describe("display name for the line (e.g. 'support bot')"),
      mode: z
        .enum(["text", "audio"])
        .optional()
        .describe("text = S2T+T2S via webhook, audio = raw websocket. defaults to text."),
      webhookUrl: z
        .string()
        .optional()
        .describe("required for text mode. your server receives transcribed text here."),
      audioHandlerUrl: z
        .string()
        .optional()
        .describe("required for audio mode. websocket URL for raw audio streaming."),
      statusCallbackUrl: z
        .string()
        .optional()
        .describe("optional. receives call lifecycle events."),
    },
    async (args) => {
      try {
        const line = await client.lines.create(args);
        return toolResult(`line created!\n\n${formatLine(line)}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_list_lines",
    "list all phone lines on your account with their phone numbers and mode.",
    {},
    async () => {
      try {
        const lines = await client.lines.list();
        if (lines.length === 0) {
          return toolResult(
            "no lines yet. use saperly_create_line to provision your first phone number.",
          );
        }
        const list = lines
          .map((l) => `  ${l.phoneNumber}  ${l.mode}  ${l.status}  "${l.name}"`)
          .join("\n");
        return toolResult(`${lines.length} line(s):\n\n${list}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_get_line",
    "get details for a specific phone line.",
    {
      lineId: z.string().describe("the line id (uuid)"),
    },
    async ({ lineId }) => {
      try {
        const line = await client.lines.get(lineId);
        return toolResult(formatLine(line));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_delete_line",
    "release a phone line. the number goes back to the carrier pool. this is irreversible.",
    {
      lineId: z.string().describe("the line id to release"),
    },
    async ({ lineId }) => {
      try {
        const line = await client.lines.delete(lineId);
        return toolResult(
          `line released. phone number ${line.phoneNumber} is no longer yours.`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_send_sms",
    "send an sms from a phone line. consent must be granted first (use saperly_grant_consent). costs $0.01 per message.",
    {
      lineId: z.string().describe("line id to send from"),
      toNumber: z.string().describe("destination phone number in E.164 format (e.g. +14155551234)"),
      message: z.string().max(1600).describe("message text (max 1600 chars)"),
    },
    async (args) => {
      try {
        const sms = await client.lines.sendSms(args.lineId, {
          toNumber: args.toNumber,
          message: args.message,
        });
        return toolResult(
          `sms sent!\n\nid: ${sms.id}\nfrom: ${sms.fromNumber}\nto: ${sms.toNumber}\nstatus: ${sms.status}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
