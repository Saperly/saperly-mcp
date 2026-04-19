import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerSettingsTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_get_settings",
    "get your account settings. currently shows default webhook URL.",
    {},
    async () => {
      try {
        const settings = await client.settings.get();
        const parts = ["account settings:"];
        parts.push(
          `  default webhook: ${settings.defaultWebhookUrl ?? "(not set)"}`,
        );
        return toolResult(parts.join("\n"));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_update_settings",
    "update account settings. set or clear the default webhook URL used for new lines.",
    {
      defaultWebhookUrl: z
        .string()
        .optional()
        .describe("default webhook URL for new webhook-mode lines. omit to clear."),
    },
    async (args) => {
      try {
        const settings = await client.settings.update({
          defaultWebhookUrl: args.defaultWebhookUrl ?? null,
        });
        return toolResult(
          `settings updated!\n  default webhook: ${settings.defaultWebhookUrl ?? "(not set)"}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
