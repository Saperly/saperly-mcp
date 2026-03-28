import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerDisclosureTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_create_disclosure",
    "create a custom tcpa disclosure message played at the start of every call on lines using this disclosure.",
    {
      message: z
        .string()
        .describe(
          "the disclosure text (e.g. 'this call is handled by an ai assistant from acme corp.')",
        ),
      language: z.string().optional().describe("language code (default: en)"),
    },
    async (args) => {
      try {
        const disclosure = await client.disclosures.create(args);
        return toolResult(
          `disclosure created!\n\nid: ${disclosure.id}\nmessage: "${disclosure.message}"\nlanguage: ${disclosure.language}`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_list_disclosures",
    "list all tcpa disclosure configurations.",
    {},
    async () => {
      try {
        const disclosures = await client.disclosures.list();
        if (disclosures.length === 0) {
          return toolResult(
            "no disclosures configured. saperly uses a default disclosure message.",
          );
        }
        const list = disclosures
          .map(
            (d) =>
              `  ${d.id.slice(0, 8)}...  "${d.message.slice(0, 50)}${d.message.length > 50 ? "..." : ""}"  ${d.isDefault ? "(default)" : ""}`,
          )
          .join("\n");
        return toolResult(`${disclosures.length} disclosure(s):\n\n${list}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
