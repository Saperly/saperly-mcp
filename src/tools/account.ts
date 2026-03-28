import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerAccountTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_account_overview",
    "get a full snapshot of your saperly account: all lines, balance, and 5 most recent calls. use this first to understand current state.",
    {},
    async () => {
      try {
        const [lines, callsResult, balanceResult] = await Promise.all([
          client.lines.list(),
          client.calls.list({ limit: 5 }),
          client.billing.balance().catch(() => null),
        ]);

        const balanceText = balanceResult
          ? `balance: $${(balanceResult.balanceCents / 100).toFixed(2)} ${balanceResult.currency}`
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
                    `  ${c.createdAt.slice(0, 16)}  ${c.direction}  ${c.fromNumber} → ${c.toNumber}  ${c.status}`,
                )
                .join("\n");

        return toolResult(
          `saperly account overview\n\n${balanceText}\n\nlines (${lines.length}):\n${linesList}\n\nrecent calls (${callsResult.total} total):\n${callsList}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
