import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerAccountTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_account_overview",
    "get a full snapshot of your saperly account: all lines, balance, usage, and 5 most recent calls. use this first to understand current state.",
    {},
    async () => {
      try {
        const [lines, callsResult, balanceResult] = await Promise.all([
          client.lines.list(),
          client.calls.list({ limit: 5 }),
          client.billing.balance().catch(() => null),
        ]);

        const balanceText = balanceResult
          ? `balance: ${balanceResult.credits} credits`
          : "balance: check saperly.com/portal";

        const linesList =
          lines.length === 0
            ? "  (no lines yet)"
            : lines
                .map(
                  (l) =>
                    `  ${l.phoneNumber}  ${l.mode}  ${l.status}  "${l.name}"`,
                )
                .join("\n");

        const callsList =
          callsResult.calls.length === 0
            ? "  (no calls yet)"
            : callsResult.calls
                .map(
                  (c) =>
                    `  ${c.createdAt.slice(0, 16)}  ${c.direction}  ${c.fromNumber} \u2192 ${c.toNumber}  ${c.status}`,
                )
                .join("\n");

        const parts = [
          `saperly account overview\n\n${balanceText}\n\nlines (${lines.length}):\n${linesList}\n\nrecent calls (${callsResult.total} total):\n${callsList}`,
        ];

        try {
          const usage = await client.usage.daily({ days: 7 });
          if (usage.daily.length > 0) {
            const totalCalls = usage.daily.reduce((sum, d) => sum + d.calls, 0);
            const totalMinutes = usage.daily.reduce(
              (sum, d) => sum + d.minutes,
              0,
            );
            const totalCost = usage.daily.reduce(
              (sum, d) => sum + d.costCredits,
              0,
            );
            parts.push(
              `\n\u2014 last 7 days \u2014\n${totalCalls} calls, ${totalMinutes} minutes, ${totalCost} credits`,
            );
          }
        } catch {
          /* usage not critical for overview */
        }

        try {
          const convos = await client.conversations.list({ limit: 1 });
          if (convos.conversations.length > 0 || convos.hasMore) {
            parts.push(`\nSMS conversations: active`);
          }
        } catch {
          /* not critical */
        }

        return toolResult(parts.join(""));
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
