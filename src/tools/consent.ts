import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Saperly } from "@saperly/sdk";
import { ConsentAlreadyGrantedError } from "@saperly/sdk";
import { toolResult, toolError } from "./utils.js";

export function registerConsentTools(server: McpServer, client: Saperly) {
  server.tool(
    "saperly_grant_consent",
    "record outbound consent for a phone number. required before making outbound calls to that number.",
    {
      lineId: z.string().describe("the line that will call this number"),
      phoneNumber: z
        .string()
        .describe("phone number in E.164 format (e.g. +14155551234)"),
      consentType: z
        .enum(["implied_inbound", "explicit_outbound"])
        .describe("type of consent"),
      source: z
        .string()
        .describe("where consent was obtained (e.g. 'mcp_tool', 'verbal')"),
    },
    async (args) => {
      try {
        await client.consent.grant(args);
        return toolResult(
          `consent granted for ${args.phoneNumber} on line ${args.lineId}.`,
        );
      } catch (err) {
        if (err instanceof ConsentAlreadyGrantedError) {
          return toolResult(
            `consent already exists for ${args.phoneNumber} on line ${args.lineId}.`,
          );
        }
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_check_consent",
    "check if consent exists for a phone number on a line.",
    {
      phoneNumber: z
        .string()
        .describe("phone number in E.164 format"),
      lineId: z.string().optional().describe("optional line id to filter"),
    },
    async (args) => {
      try {
        const result = await client.consent.check(args);
        if (result.status === "active" && result.consent) {
          return toolResult(
            `consent active for ${args.phoneNumber}.\ntype: ${result.consent.consentType}\ngranted: ${result.consent.grantedAt}`,
          );
        }
        return toolResult(
          `no active consent for ${args.phoneNumber}. use saperly_grant_consent to record consent before calling.`,
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "saperly_revoke_consent",
    "revoke consent for a phone number. future outbound calls to this number will be blocked.",
    {
      phoneNumber: z
        .string()
        .describe("phone number in E.164 format"),
      lineId: z.string().optional().describe("optional line id"),
    },
    async (args) => {
      try {
        await client.consent.revoke(args);
        return toolResult(`consent revoked for ${args.phoneNumber}.`);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
