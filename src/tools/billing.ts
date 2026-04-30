import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { NotFoundError } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerBillingTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_get_balance",
    "check your credit balance. calls cost 60 credits/min in webhook mode or 100 credits/min in hosted mode for Zone A (US/Canada). international destinations use Zone B (×2) or Zone C (×3) multipliers. numbers cost 1,800 credits per 30 days.",
    {},
    async () => {
      try {
        const balance = await client.billing.balance();
        return toolResult(
          `balance: ${balance.credits} credits\n\nrates (Zone A — US/Canada):\n  webhook mode: 60 credits/min\n  hosted mode: 100 credits/min\n  phone number: 1,800 credits per 30 days\n\ninternational destinations: Zone B = ×2, Zone C = ×3 (see https://docs.saperly.com/guides/voice-zones)`,
        );
      } catch (err) {
        if (err instanceof NotFoundError) {
          return toolResult(
            "billing endpoint not available yet. your account has 1,800 starter credits (~30 min webhook).",
          );
        }
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_add_funds",
    "add credits to your saperly account. returns a checkout url. amounts: 4600, 12000, 25000, 50000 credits at $13/$30/$55/$100.",
    {
      amount_credits: z
        .number()
        .describe("amount in credits: 4600, 12000, 25000, or 50000"),
    },
    async ({ amount_credits }: { amount_credits: number }) => {
      try {
        const result = await client.billing.addFunds({
          amountCredits: amount_credits as 4600 | 12000 | 25000 | 50000,
        });
        return toolResult(
          `checkout ready!\n\nopen this url to complete your purchase:\n${result.checkoutUrl}\n\namount: ${amount_credits} credits`,
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
          // v0.5.1.x: explicit debit-type allowlist (was: hardcoded 2 types).
          // sms_charge added in earlier phase; call_charge and number_fee
          // unchanged. tier_grant + postpaid_flush + signup_credit +
          // credit_purchase + refund + auto_recharge all credit the account.
          const isDebit =
            t.type === "call_charge" ||
            t.type === "number_fee" ||
            t.type === "sms_charge";
          const sign = isDebit ? "-" : "+";
          return `  ${t.createdAt.slice(0, 16)}  ${sign}${t.amountCredits} credits  ${t.type.replace(/_/g, " ")}  bal: ${t.balanceAfterCredits} credits`;
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
