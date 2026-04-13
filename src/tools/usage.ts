import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerUsageTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_get_usage",
    "get usage statistics. shows calls, minutes, SMS counts, and costs by day or month.",
    {
      period: z
        .enum(["daily", "monthly"])
        .optional()
        .describe("aggregation period (default: daily)"),
      count: z
        .number()
        .optional()
        .describe("number of periods (default 7 for daily, 3 for monthly)"),
    },
    async (args) => {
      try {
        const period = args.period ?? "daily";
        if (period === "daily") {
          const result = await client.usage.daily({ days: args.count ?? 7 });
          if (result.daily.length === 0) return toolResult("no usage data yet.");
          const lines = result.daily
            .map(
              (d) =>
                `  ${d.date}  ${d.calls} calls  ${d.minutes} min  ${d.costCredits} credits`,
            )
            .join("\n");
          return toolResult(`daily usage:\n\n${lines}`);
        } else {
          const result = await client.usage.monthly({ months: args.count ?? 3 });
          if (result.monthly.length === 0) return toolResult("no usage data yet.");
          const lines = result.monthly
            .map(
              (m) =>
                `  ${m.month}  ${m.calls} calls  ${m.minutes} min  ${m.costCredits} credits`,
            )
            .join("\n");
          return toolResult(`monthly usage:\n\n${lines}`);
        }
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
