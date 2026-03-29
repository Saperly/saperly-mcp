# @saperly/mcp

MCP server for [Saperly](https://saperly.com) — the phone carrier for AI agents. 17 tools that let any MCP-compatible client provision phone lines, make calls, send SMS, manage consent, and query compliance.

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
npx skills.sh install saperly
export SAPERLY_API_KEY=sk_live_...
```

## Available Tools

| Tool | Description |
|------|-------------|
| `saperly_create_line` | Provision a new phone line |
| `saperly_list_lines` | List all lines |
| `saperly_get_line` | Get line details |
| `saperly_delete_line` | Release a phone line |
| `saperly_send_sms` | Send SMS from a line |
| `saperly_create_call` | Make an outbound call |
| `saperly_list_calls` | List recent calls |
| `saperly_get_call` | Get call details |
| `saperly_hangup_call` | Terminate an active call |
| `saperly_grant_consent` | Record outbound consent |
| `saperly_check_consent` | Check consent status |
| `saperly_revoke_consent` | Revoke consent |
| `saperly_compliance_audit` | Query audit trail |
| `saperly_create_disclosure` | Create TCPA disclosure |
| `saperly_list_disclosures` | List disclosures |
| `saperly_get_balance` | Check credit balance |
| `saperly_account_overview` | Full account snapshot |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SAPERLY_API_KEY` | Yes | Your Saperly API key |
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
