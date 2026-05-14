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
        // Note: `costCredits` is the legacy v0.5.2.0 field name in the API
        // response. The value is in US cents and we render it as dollars here.
        // See openapi.yaml: "The `_credits` field name is a v0.5.2.0 carry-over;
        // values are cents-honest USD. Renamed to `cost_cents` in v0.6.x."
        const formatUsd = (cents: number): string =>
          `$${(cents / 100).toFixed(2)}`;
        if (period === "daily") {
          const result = await client.usage.daily({ days: args.count ?? 7 });
          if (result.daily.length === 0) return toolResult("no usage data yet.");
          const lines = result.daily
            .map(
              (d) =>
                `  ${d.date}  ${d.calls} calls  ${d.minutes} min  ${formatUsd(d.costCredits)}`,
            )
            .join("\n");
          return toolResult(`daily usage:\n\n${lines}`);
        } else {
          const result = await client.usage.monthly({ months: args.count ?? 3 });
          if (result.monthly.length === 0) return toolResult("no usage data yet.");
          const lines = result.monthly
            .map(
              (m) =>
                `  ${m.month}  ${m.calls} calls  ${m.minutes} min  ${formatUsd(m.costCredits)}`,
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
