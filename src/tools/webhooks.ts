import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerWebhookTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_webhook_deliveries",
    "list recent webhook delivery attempts. shows status, duration, errors for each delivery.",
    {
      lineId: z.string().optional().describe("filter by line id"),
      eventType: z.string().optional().describe("filter: call_started, message, call_ended, sms_received, test"),
      status: z.string().optional().describe("filter: success, failed"),
      limit: z.number().optional().describe("max results (default 50, max 100)"),
      offset: z.number().optional().describe("pagination offset"),
    },
    async (args) => {
      try {
        const result = await client.webhooks.deliveries(args);
        if (result.deliveries.length === 0) return toolResult("no webhook deliveries found.");
        const list = result.deliveries
          .map((d) => `  ${d.createdAt.slice(0, 16)}  ${d.eventType.padEnd(14)}  ${d.status.padEnd(7)}  ${d.durationMs ?? "?"}ms  HTTP ${d.httpStatus ?? "N/A"}`)
          .join("\n");
        return toolResult(`${result.total} delivery(ies):\n\n${list}`);
      } catch (err) { return toolError(err); }
    },
  );

  server.tool(
    "saperly_webhook_stats",
    "get aggregate webhook delivery statistics.",
    { lineId: z.string().optional().describe("filter by line id") },
    async (args) => {
      try {
        const stats = await client.webhooks.stats(args);
        let text = `total: ${stats.total}, success: ${stats.success}, failed: ${stats.failed}, rate: ${stats.successRate}%`;
        if (stats.byEventType.length > 0) {
          text += "\n\nby event type:";
          for (const et of stats.byEventType) text += `\n  ${et.eventType.padEnd(14)}  total: ${et.total}  success: ${et.success}  failed: ${et.failed}`;
        }
        if (stats.byHour.length > 0) {
          text += "\n\nlast 24h by hour:";
          for (const h of stats.byHour) text += `\n  ${h.hour.slice(11, 16)}  total: ${h.total}  success: ${h.success}  failed: ${h.failed}`;
        }
        return toolResult(text);
      } catch (err) { return toolError(err); }
    },
  );

  server.tool(
    "saperly_webhook_test",
    "send a test webhook to a line's configured URL.",
    { lineId: z.string().describe("line id to test") },
    async (args) => {
      try {
        const result = await client.webhooks.test(args);
        const d = result.delivery;
        let text = `test result: ${d.status}\n  HTTP: ${d.httpStatus ?? "N/A"}\n  duration: ${d.durationMs}ms`;
        if (d.responseBody) text += `\n  response: ${d.responseBody.slice(0, 200)}`;
        return toolResult(text);
      } catch (err) { return toolError(err); }
    },
  );
}
