import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { NotFoundError } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerBillingTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_get_balance",
    "check your account credit balance.",
    {},
    async () => {
      try {
        const balance = await client.billing.balance();
        const dollars = (balance.balanceCents / 100).toFixed(2);
        return toolResult(
          `balance: $${dollars} ${balance.currency}\n\nrates:\n  outbound: $0.05/min\n  inbound: $0.03/min\n  phone number: $2.00/mo`,
        );
      } catch (err) {
        if (err instanceof NotFoundError) {
          return toolResult(
            "billing endpoint not available yet. your account has starter credits ($5.00).",
          );
        }
        return toolError(err);
      }
    },
  );
}
