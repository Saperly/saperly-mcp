import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerVoicesTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_list_voices",
    "list available TTS voices for hosted-mode calls. use the voice id when creating or updating a line.",
    {},
    async () => {
      try {
        const result = await client.voices.list();
        if (result.voices.length === 0) {
          return toolResult("no voices available.");
        }
        const list = result.voices
          .map((v) => `  ${v.id}  ${v.name}  ${v.gender}  ${v.accent}  ${v.style}`)
          .join("\n");
        return toolResult(`${result.voices.length} voice(s):\n\n${list}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
