# @saperly/mcp

Model Context Protocol server for Saperly. Gives any MCP-compatible AI agent (Claude Desktop, Claude Code, Cursor) the ability to provision phone numbers, place calls, send SMS, and manage credentials.

36 tools across 14 groups, all backed by the public Saperly API.

## Install

```bash
npm install -g @saperly/mcp
```

Or run on demand with `npx @saperly/mcp`.

## Quickstart

Register the server with Claude Desktop. Add this block to `claude_desktop_config.json`:

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

For Claude Code:

```bash
claude mcp add saperly -- npx -y @saperly/mcp
export SAPERLY_API_KEY=sk_live_...
```

Get an API key at [saperly.com/settings/keys](https://saperly.com/settings/keys). For key-management tools (`saperly_key_*`) set `SAPERLY_API_KEY` to a service key instead.

## Tool groups

The canonical tool list lives in [`manifest.json`](./manifest.json). One sentence per group:

- **lines**: Provision and manage phone numbers (modes: webhook, audio, hosted).
- **calls**: Place outbound calls, retrieve history, run hosted AI conversation calls.
- **messages**: Send outbound SMS and read inbound conversation history.
- **keys**: Mint, rotate, and revoke child API keys (service-key auth required).
- **consent**: Grant, check, and revoke TCPA outbound consent per phone number.
- **disclosures**: Configure TCPA disclosure scripts played at call start.
- **compliance**: Query the immutable compliance audit trail.
- **billing**: Read account balance, transactions, and the deprecated `add_funds` stub.
- **account**: Whole-account snapshot covering lines, balance, usage, and recent calls.
- **webhooks**: List delivery attempts, read aggregate stats, send test webhooks.
- **usage**: Aggregate call minutes, SMS counts, and costs by day or month.
- **settings**: Read or update account-level configuration (e.g. default webhook URL).
- **voices**: List TTS voices available for hosted-mode calls.
- **audit**: Unified time-sorted feed of calls, SMS, compliance events, and billing scoped to the caller.

## Auth

Saperly uses a two-tier credential model. Both authenticate via `SAPERLY_API_KEY` on the MCP server's environment.

| Credential | Use case |
| --- | --- |
| API key (`sk_live_…`, `sk_test_…`) | Place calls, send SMS, manage lines, read usage and audit. |
| Service key (`sk_svc_live_…`, `sk_svc_test_…`) | Mint, rotate, and revoke child API keys via the `saperly_key_*` tools. Credential management only. |

Full reference at [docs.saperly.com/service-keys](https://docs.saperly.com/service-keys).

## Resources

- Docs: https://docs.saperly.com
- Quickstart: https://docs.saperly.com/quickstart
- Agent onboarding: https://docs.saperly.com/agent-onboarding
- Service keys: https://docs.saperly.com/service-keys
- Patterns and pitfalls: [./AGENTS.md](./AGENTS.md)
- API reference: https://docs.saperly.com/api-reference
- Issues: https://github.com/Saperly/saperly-mcp/issues
- Discord: invite link in our docs

## License

MIT. See [LICENSE](./LICENSE).

## Contact

hello@saperly.com or open an issue.
