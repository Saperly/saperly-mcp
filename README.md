# @saperly/mcp

> **Published at [github.com/Saperly/saperly-mcp](https://github.com/Saperly/saperly-mcp).** This copy in the monorepo is the development source.

MCP server for [Saperly](https://saperly.com) — the phone carrier for AI agents. **36 tools** that let any MCP-compatible client provision phone lines, make calls, send SMS, manage consent, track compliance, query usage + billing, and (v0.5.7.0+) manage child API keys via service-key auth.

## Install

```bash
npm install @saperly/mcp
```

Or run directly:

```bash
SAPERLY_API_KEY=sk_live_... npx @saperly/mcp
```

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

### Claude Code

```bash
claude mcp add saperly -- npx -y @saperly/mcp
export SAPERLY_API_KEY=sk_live_...
```

## Available Tools

> The canonical list is in [`manifest.json`](./manifest.json). Tools are grouped by resource.

### Lines
| Tool | Description |
|------|-------------|
| `saperly_create_line` | Provision a new phone line (mode: webhook / audio / hosted) |
| `saperly_list_lines` | List all phone lines on your account |
| `saperly_get_line` | Get details for a specific phone line |
| `saperly_update_line` | Update a line's config (webhook URLs, system prompt, voice, recording) |

### Calls
| Tool | Description |
|------|-------------|
| `saperly_create_call` | Make an outbound call (requires consent first) |
| `saperly_list_calls` | List recent calls (filter by line/status) |
| `saperly_get_call` | Get details for a specific call |
| `saperly_hangup_call` | Terminate an active call (irreversible) |
| `saperly_conversation_call` | Hosted AI phone call — Saperly runs the LLM, returns full transcript when done |

### Consent + Compliance
| Tool | Description |
|------|-------------|
| `saperly_grant_consent` | Record outbound consent for a phone number |
| `saperly_check_consent` | Check if consent exists for a phone number on a line |
| `saperly_revoke_consent` | Revoke consent (blocks future outbound calls to that number) |
| `saperly_compliance_audit` | Query the immutable compliance audit trail |

### Disclosures
| Tool | Description |
|------|-------------|
| `saperly_create_disclosure` | Create a TCPA disclosure played at the start of every call |
| `saperly_list_disclosures` | List all TCPA disclosure configurations |

### Messages (SMS)
| Tool | Description |
|------|-------------|
| `saperly_send_sms` | Send outbound SMS (requires 24h-inbound or `explicit_outbound` consent) |
| `saperly_list_conversations` | List SMS conversations grouped by contact |
| `saperly_get_conversation` | Get full SMS history with a contact |

### Billing
| Tool | Description |
|------|-------------|
| `saperly_get_balance` | Account balance in USD (cents-honest since v0.5.3) |
| `saperly_list_transactions` | Recent charges, refunds, signup credit, auto-recharges |
| `saperly_add_funds` | **DEPRECATED** — manual top-up was removed in v0.5.2.0 (postpaid auto-charge now) |

### Account + Usage + Settings
| Tool | Description |
|------|-------------|
| `saperly_account_overview` | Full account snapshot — lines, balance, usage, recent calls |
| `saperly_get_usage` | Call minutes, SMS counts, and costs by day or month |
| `saperly_get_settings` | Account settings (currently shows default webhook URL) |
| `saperly_update_settings` | Update account settings |

### Webhooks
| Tool | Description |
|------|-------------|
| `saperly_webhook_deliveries` | List recent webhook delivery attempts |
| `saperly_webhook_stats` | Aggregate webhook delivery statistics |
| `saperly_webhook_test` | Send a test webhook to a line's URL |

### Voices
| Tool | Description |
|------|-------------|
| `saperly_list_voices` | List available TTS voices for hosted-mode calls |

### Audit (v0.5.7.0+)
| Tool | Description |
|------|-------------|
| `saperly_audit_list` | Unified audit feed: calls, SMS, compliance events, billing — scoped to the caller's API key |

### Keys (v0.5.7.0+ — service-key auth required)
| Tool | Description |
|------|-------------|
| `saperly_key_create` | Mint a new child api key. Returns plaintext ONCE. |
| `saperly_key_list` | List child api keys minted by this service key (metadata only) |
| `saperly_key_get` | Retrieve a single child api key by id (metadata only) |
| `saperly_key_update` | Update label, scope, permissions, or cap on a child api key |
| `saperly_key_rotate` | Atomic rotate: revoke old + mint new. Returns new plaintext ONCE. DESTRUCTIVE. |
| `saperly_key_delete` | Soft-revoke a child api key. DESTRUCTIVE. Requires `confirm=true`. |

## Migration

### v0.2.x → v0.3.0

- New `saperly_audit_list` + six `saperly_key_*` tools (require service-key auth — mint a service key in the portal at https://saperly.com/settings/keys/service-keys).
- All billing copy moved from "credits" to USD cents (cents-honest since v0.5.3).
- `saperly_add_funds` is a deprecated stub — manual top-up was removed in v0.5.2.0. Direct users to https://saperly.com/billing to add or update a payment method.

### v0.1.x → v0.2.0

**Breaking change:** `saperly_delete_line` was removed in v0.2.0. An AI agent hallucinating a `lineId` could permanently release a real phone number — safety over convenience.

**Workarounds:**
- **Portal** — delete lines at https://saperly.com/lines
- **REST API** — `DELETE /v1/lines/{id}` with your API key
- **SDK** — `client.lines.delete(lineId)`

The mode enum also tightened to `["webhook", "audio", "hosted"]`. Legacy `mode:"text"` via MCP now rejects (REST still accepts both for back-compat). Update your scripts to use `"webhook"`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SAPERLY_API_KEY` | Yes | Your Saperly API key (or service key) |
| `SAPERLY_BASE_URL` | No | Override API base URL (for local dev) |

## Development

```bash
# Install dependencies
npm install

# Build SDK first (workspace dependency)
cd ../sdk && npm run build && cd ../mcp

# Type check
npx tsc --noEmit

# Run tests
npx vitest run

# Build
npm run build
```

## License

MIT
