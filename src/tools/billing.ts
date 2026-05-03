import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { NotFoundError } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerBillingTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_get_balance",
    "check your account balance in USD. calls cost $0.13/min in webhook mode or $0.26/min in hosted mode for Zone A (US/Canada). international destinations use Zone B (×2) or Zone C (×3) multipliers. phone numbers cost $2.50/month (first number free for 30 days). credits never expire.",
    {},
    async () => {
      try {
        const balance = await client.billing.balance();
        const dollars = (balance.credits / 100).toFixed(2);
        return toolResult(
          `balance: $${dollars} (${balance.credits} cents)\n\nrates (Zone A — US/Canada):\n  webhook mode: $0.13/min\n  hosted mode: $0.26/min\n  SMS: $0.02/segment\n  phone number: $2.50/month (first number free for 30 days)\n\ninternational destinations: Zone B = ×2, Zone C = ×3 (see https://docs.saperly.com/guides/voice-zones)\n\nbilled per second; credits never expire.`,
        );
      } catch (err) {
        if (err instanceof NotFoundError) {
          return toolResult(
            "billing endpoint not available yet. your account has $5 in starter credits (~38 min webhook).",
          );
        }
        return toolError(err);
      }
    },
  );

  // DEPRECATED: /v1/billing/add-funds endpoint was removed in v0.5.2.0
  // (cents-honest pivot, prepaid credit packs killed in favor of postpaid
  // auto-charge against saved card). This tool will 404 if called. Tool
  // declaration left in place to avoid SDK cascade churn; full removal
  // (here + SDK billing.ts addFunds + types + tests) lands in v0.6.x
  // cleanup PR. Surface clearly in description so LLM agents don't call it.
  server.tool(
    "saperly_add_funds",
    "DEPRECATED — do not use. Manual top-up is no longer required. Saperly auto-charges your saved card when your balance runs low (postpaid). To add a payment method, direct the user to https://app.saperly.com/billing.",
    {
      amount_credits: z
        .number()
        .optional()
        .describe("(unused — endpoint removed)"),
    },
    async () => {
      return toolResult(
        "this endpoint has been removed. Saperly is now postpaid: when your balance runs low, your saved card on file is automatically charged. To add or update your payment method, visit https://app.saperly.com/billing.",
      );
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
          //
          // v0.5.2.0+ pivot: amountCredits / balanceAfterCredits SDK fields
          // carry cents (not credits). Field-name rename deferred to v0.6.x
          // for backward-compat. Format as USD here for LLM-readable output.
          const isDebit =
            t.type === "call_charge" ||
            t.type === "number_fee" ||
            t.type === "sms_charge";
          const sign = isDebit ? "-" : "+";
          const amountUsd = (t.amountCredits / 100).toFixed(2);
          const balanceUsd = (t.balanceAfterCredits / 100).toFixed(2);
          return `  ${t.createdAt.slice(0, 16)}  ${sign}$${amountUsd}  ${t.type.replace(/_/g, " ")}  bal: $${balanceUsd}`;
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
