import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerMessagesTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_send_sms",
    "send an outbound SMS. requires either an inbound SMS from the recipient within the last 24 hours, OR active explicit_outbound consent on file for that (line, recipient) pair (e.g. recorded via POST /v1/consent or a web-form opt-in).",
    {
      lineId: z.string().describe("line id to send from"),
      to: z.string().describe("recipient phone number (E.164, e.g. +14155551234)"),
      text: z.string().describe("message text"),
    },
    async (args) => {
      try {
        const msg = await client.messages.send(args);
        return toolResult(`SMS sent!\nid: ${msg.id}\nto: ${msg.to}\nstatus: ${msg.status}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_list_conversations",
    "list SMS conversations grouped by contact. shows most recent message and count.",
    {
      lineId: z.string().optional().describe("filter by line (optional)"),
      limit: z.number().optional().describe("max results (default 20)"),
    },
    async (args) => {
      try {
        const result = await client.conversations.list(args);
        if (result.conversations.length === 0) {
          return toolResult("no conversations found.");
        }
        const list = result.conversations
          .map(
            (c) =>
              `  ${c.phoneNumber}  ${c.messageCount} msgs  last: "${c.lastMessageText ?? "\u2014"}" (${c.lastMessageDirection})`,
          )
          .join("\n");
        return toolResult(`${result.conversations.length} conversation(s):\n\n${list}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_get_conversation",
    "get full SMS message history for a conversation with a specific contact.",
    {
      lineId: z.string().describe("line id"),
      phoneNumber: z.string().describe("contact phone number (E.164)"),
      limit: z.number().optional().describe("max messages (default 50)"),
    },
    async (args) => {
      try {
        const result = await client.conversations.messages(args.lineId, args.phoneNumber, {
          limit: args.limit,
        });
        if (result.messages.length === 0) {
          return toolResult("no messages in this conversation.");
        }
        const msgs = result.messages
          .map((m) => `  [${m.direction}] ${m.text}  (${m.timestamp})`)
          .join("\n");
        return toolResult(`${result.messages.length} message(s):\n\n${msgs}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
