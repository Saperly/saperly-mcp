#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Saperly } from "@saperly/sdk";
import { registerLinesTools } from "./tools/lines.js";
import { registerCallsTools } from "./tools/calls.js";
import { registerConsentTools } from "./tools/consent.js";
import { registerComplianceTools } from "./tools/compliance.js";
import { registerAuditTools } from "./tools/audit.js";
import { registerDisclosureTools } from "./tools/disclosures.js";
import { registerBillingTools } from "./tools/billing.js";
import { registerAccountTools } from "./tools/account.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerMessagesTools } from "./tools/messages.js";
import { registerUsageTools } from "./tools/usage.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerVoicesTools } from "./tools/voices.js";

const apiKey = process.env.SAPERLY_API_KEY;
if (!apiKey) {
  console.error(
    "SAPERLY_API_KEY environment variable is required.\n" +
      "Get your key at https://saperly.com/portal or set it:\n" +
      "  export SAPERLY_API_KEY=sk_live_...",
  );
  process.exit(1);
}

const client = new Saperly({
  apiKey,
  baseUrl: process.env.SAPERLY_BASE_URL,
});

const server = new McpServer({
  name: "saperly",
  version: "0.1.0",
});

registerLinesTools(server, client);
registerCallsTools(server, client);
registerConsentTools(server, client);
registerComplianceTools(server, client);
registerAuditTools(server, client);
registerDisclosureTools(server, client);
registerBillingTools(server, client);
registerAccountTools(server, client);
registerWebhookTools(server, client);
registerMessagesTools(server, client);
registerUsageTools(server, client);
registerSettingsTools(server, client);
registerVoicesTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
