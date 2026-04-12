import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerComplianceTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_compliance_audit",
    "query the immutable compliance audit trail. shows disclosure plays, consent events, call lifecycle events.",
    {
      lineId: z.string().optional().describe("filter by line id"),
      phoneNumber: z.string().optional().describe("filter by phone number"),
      eventType: z
        .string()
        .optional()
        .describe(
          "filter: disclosure_played, consent_collected, consent_revoked, call_started, call_ended, pre_call_check_passed, pre_call_check_blocked",
        ),
      from: z.string().optional().describe("start date (ISO 8601)"),
      to: z.string().optional().describe("end date (ISO 8601)"),
      limit: z.number().optional().describe("max results (default 20, max 100)"),
      offset: z.number().optional().describe("pagination offset"),
    },
    async (args) => {
      try {
        const result = await client.compliance.audit(args);
        if (result.events.length === 0) {
          return toolResult("no compliance events found.");
        }
        const list = result.events
          .map(
            (e) =>
              `  ${e.createdAt.slice(0, 16)}  ${e.eventType}  ${e.phoneNumber}`,
          )
          .join("\n");
        return toolResult(`${result.total} event(s):\n\n${list}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
