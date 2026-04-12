import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { NotFoundError } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerBillingTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_get_balance",
    "check your credit balance. calls cost $0.11/min (webhook mode) or $0.20/min (hosted mode). numbers are $2/mo.",
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

  server.tool(
    "saperly_add_funds",
    "add credits to your saperly account. returns a checkout url. amounts: $10 (1000), $25 (2500), $50 (5000), $100 (10000).",
    {
      amount_cents: z
        .number()
        .describe("amount in cents: 1000, 2500, 5000, or 10000"),
    },
    async ({ amount_cents }: { amount_cents: number }) => {
      try {
        const result = await client.billing.addFunds({
          amountCents: amount_cents as 1000 | 2500 | 5000 | 10000,
        });
        return toolResult(
          `checkout ready!\n\nopen this url to complete your purchase:\n${result.checkoutUrl}\n\namount: $${(amount_cents / 100).toFixed(2)}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_list_transactions",
    "list recent billing transactions: credits, charges, refunds. shows amount, type, and running balance.",
    {
      limit: z
        .number()
        .optional()
        .describe("number of transactions to return (1-100, default 20)"),
      cursor: z
        .string()
        .optional()
        .describe("iso date cursor for pagination from a previous response"),
    },
    async ({ limit, cursor }: { limit?: number; cursor?: string }) => {
      try {
        const result = await client.billing.transactions({ limit, cursor });
        if (result.transactions.length === 0) {
          return toolResult("no transactions found.");
        }
        const lines = result.transactions.map((t) => {
          const isDebit = t.type === "call_charge" || t.type === "number_fee";
          const sign = isDebit ? "-" : "+";
          const dollars = (t.amountCents / 100).toFixed(2);
          const balDollars = (t.balanceAfterCents / 100).toFixed(2);
          return `  ${t.createdAt.slice(0, 16)}  ${sign}$${dollars}  ${t.type.replace(/_/g, " ")}  bal: $${balDollars}`;
        });
        const footer = result.hasMore
          ? `\n\n(more available — use cursor: "${result.nextCursor}")`
          : "";
        return toolResult(
          `${result.transactions.length} transaction(s):\n\n${lines.join("\n")}${footer}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
