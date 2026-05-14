# AGENTS.md: @saperly/mcp

Patterns and pitfalls for AI agents (Claude Desktop, Claude Code, Cursor) using the Saperly MCP server. If you are an MCP client reading this autonomously, the tool names and patterns below are canonical for v0.3.0 (36 tools, 14 groups).

## 1. What Saperly is

Saperly is the phone carrier for AI agents. One API call gives any agent a real phone number with TCPA compliance, consent capture, and an audit trail built in. Hosted mode runs the AI for you (Saperly handles speech-to-text, the LLM call, and text-to-speech). Webhook mode lets your backend decide responses turn by turn. Audio mode streams raw audio over a WebSocket if you need full control of the media plane.

## 2. Installation

For Claude Code:

```bash
claude mcp add saperly -- npx -y @saperly/mcp
export SAPERLY_API_KEY=sk_live_...
```

For Claude Desktop, add this entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "saperly": {
      "command": "npx",
      "args": ["-y", "@saperly/mcp"],
      "env": { "SAPERLY_API_KEY": "sk_live_..." }
    }
  }
}
```

Transport is stdio. The server is a Node.js 18+ binary published as `@saperly/mcp`.

## 3. Authentication

Saperly uses a two-tier credential model. The MCP server reads exactly one credential from the environment at startup; pick the tier that matches the tools you plan to call.

| Credential | Prefix | What it does | Where to get it |
| --- | --- | --- | --- |
| API key | `sk_test_…` / `sk_live_…` | Place calls, send SMS, manage lines, query usage, read audit. | Portal, or minted by a service key via `POST /v1/keys`. |
| Service key | `sk_svc_test_…` / `sk_svc_live_…` | Mint, list, get, update, rotate, revoke child API keys. Credential management only. | Portal only (Settings → Service Keys). |

Child API keys minted by a service key carry their own scope. The API accepts exactly four permission tiers on `POST /v1/keys` and `PATCH /v1/keys/{id}`. A fifth value, `legacy_full`, appears on responses for keys minted before v0.5.7.0 but cannot be set via the API.

| Permission | Settable | Returned | What it does |
| --- | --- | --- | --- |
| `full` | yes | yes | All call, SMS, line, and account operations. |
| `call_only` | yes | yes | Place and inspect calls; no SMS, no line mutation. |
| `sms_only` | yes | yes | Send and inspect SMS; no calls, no line mutation. |
| `read_only` | yes | yes | GETs only; no mutations. |
| `legacy_full` | no | yes | Backfill marker for keys minted before v0.5.7.0. |

The `saperly_key_*` tools require `SAPERLY_API_KEY` to hold a service key (`sk_svc_…`). All other tools require an API key (`sk_…`). Calling the wrong tier returns `401 invalid_api_key`.

## 4. Core resources

- `lines`: Provision and manage phone numbers (hosted, webhook, or audio mode).
- `calls`: Place and monitor outbound calls, run hosted conversation calls.
- `messages`: Send and receive SMS, list conversations.
- `keys`: Mint, rotate, revoke child API keys (service key only).
- `consent`: Record explicit caller consent for TCPA compliance.
- `disclosures`: Configure inbound disclosure scripts.
- `webhooks`: Track event delivery; verify via signed HMAC-SHA256.
- `audit`: Read the immutable compliance event stream.

## 5. Canonical patterns

Each pattern below shows the MCP tool name plus the JSON arguments an MCP client would pass.

### Provision a hosted line

Call `saperly_create_line`:

```json
{
  "name": "my agent",
  "mode": "hosted",
  "systemPrompt": "You are a helpful assistant."
}
```

The response includes `id` and `phoneNumber`. Reuse an existing line by name before provisioning a new one. Phone numbers cost $2.50/month each (first number free for 30 days).

### Place a test outbound call

Call `saperly_create_call`:

```json
{
  "lineId": "550e8400-e29b-41d4-a716-446655440000",
  "toNumber": "+14155551234"
}
```

Ask the human operator for `toNumber` before placing the call. Never call `+1 555-0100` through `+1 555-0199`; those are reserved test numbers that will never connect. Consent must be on file before the API will accept the call.

### Mint a child API key (service key auth)

Call `saperly_key_create` (requires `SAPERLY_API_KEY` to hold a service key):

```json
{
  "name": "voice-agent-prod",
  "line_id": "550e8400-e29b-41d4-a716-446655440000",
  "permissions": "call_only",
  "monthly_cap_cents": 500
}
```

Field names on this tool are snake_case (the underlying SDK handles the camelCase translation). The response includes `plaintextKey` exactly once. Save it immediately; there is no read-back endpoint. Idempotency is handled automatically by the server.

### Rotate a service-minted key

Call `saperly_key_rotate`:

```json
{
  "id": "key_abc123",
  "confirm": true
}
```

`confirm` must be exactly `true`; the Zod schema rejects everything else. The response includes the new `plaintextKey`. The old plaintext stops working the instant the response returns. This tool is DESTRUCTIVE.

## 6. Required headers

The MCP server sets these on every outbound call to the Saperly API; you do not set them yourself, but the rules still matter for understanding errors.

- `Authorization: Bearer <key>`: derived from `SAPERLY_API_KEY` at server startup.
- `Idempotency-Key: <uuid>`: required on `POST /v1/keys` and `POST /v1/keys/{id}/rotate`. No tool argument is exposed for it; the underlying SDK auto-generates a UUID v4 on every key mint and rotate. Recommended on `POST /v1/calls` and `POST /v1/messages` (also handled by the SDK automatically).
- `Content-Type: application/json`: set automatically by the server.

## 7. Common pitfalls

1. **stdio is the only supported transport.** The server speaks MCP over stdin/stdout. There is no HTTP, SSE, or socket transport in v0.3.0. Launch via `npx @saperly/mcp` or `claude mcp add` as shown above.
2. **`saperly_key_*` tools require a service key, not an API key.** Calling them with `SAPERLY_API_KEY=sk_live_…` returns `401 invalid_api_key`. Either start a separate MCP server instance with `SAPERLY_API_KEY=sk_svc_live_…`, or split your client into one connection per tier.
3. **DESTRUCTIVE tools require explicit `confirm: true`.** Both `saperly_key_delete` and `saperly_key_rotate` require `confirm: true` (the Zod schema rejects anything else). `saperly_hangup_call` is irreversible mid-call, though no confirm flag is enforced there.
4. **Manifest tool count is locked.** The manifest declares **36 tools** across 14 groups. Adding or removing a tool must update `manifest.json` AND the publish-mcp workflow's drift check. Surprise tool count changes will fail CI.

## 8. Resources

- Docs: https://docs.saperly.com
- Quickstart: https://docs.saperly.com/quickstart
- Agent onboarding: https://docs.saperly.com/agent-onboarding
- Service keys: https://docs.saperly.com/service-keys
- API reference: https://docs.saperly.com/api-reference
- llms.txt: https://saperly.com/llms.txt
- Issues: https://github.com/Saperly/saperly-mcp/issues
- Source: https://github.com/Saperly/saperly-mcp

### Tool index

The canonical list is [`manifest.json`](./manifest.json). 36 tools across 14 groups:

- **lines**: `saperly_create_line`, `saperly_list_lines`, `saperly_get_line`, `saperly_update_line`
- **calls**: `saperly_create_call`, `saperly_list_calls`, `saperly_get_call`, `saperly_hangup_call`, `saperly_conversation_call`
- **messages**: `saperly_send_sms`, `saperly_list_conversations`, `saperly_get_conversation`
- **keys**: `saperly_key_create`, `saperly_key_list`, `saperly_key_get`, `saperly_key_update`, `saperly_key_rotate`, `saperly_key_delete`
- **consent**: `saperly_grant_consent`, `saperly_check_consent`, `saperly_revoke_consent`
- **disclosures**: `saperly_create_disclosure`, `saperly_list_disclosures`
- **compliance**: `saperly_compliance_audit`
- **billing**: `saperly_get_balance`, `saperly_list_transactions`, `saperly_add_funds` (deprecated stub)
- **account**: `saperly_account_overview`
- **webhooks**: `saperly_webhook_deliveries`, `saperly_webhook_stats`, `saperly_webhook_test`
- **usage**: `saperly_get_usage`
- **settings**: `saperly_get_settings`, `saperly_update_settings`
- **voices**: `saperly_list_voices`
- **audit**: `saperly_audit_list`
