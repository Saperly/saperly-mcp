# @saperly/mcp changelog

All notable changes to the Saperly MCP server. Versions follow the platform release cadence.

## [0.3.0] (2026-05-13) agent-native key management

### Added

- Six `saperly_key_*` tools: `saperly_key_create`, `saperly_key_list`, `saperly_key_get`, `saperly_key_update`, `saperly_key_rotate`, `saperly_key_delete`. Mint, rotate, and revoke child API keys at runtime from a service key (`sk_svc_…`). Both `rotate` and `delete` are DESTRUCTIVE and require `confirm: true` (the Zod schema rejects anything else). Plaintext keys returned exactly once on `_create` and `_rotate`.
- `saperly_audit_list` tool: unified time-sorted feed of calls, SMS, compliance events, and billing scoped to the caller's API key. Max 500 events per call.
- Manifest now declares **36 tools** across 14 groups (lines, calls, messages, keys, consent, disclosures, compliance, billing, account, webhooks, usage, settings, voices, audit).

### Changed

- All billing copy migrated from credits to USD cents (cents-honest since v0.5.3).
- `saperly_add_funds` is a deprecated stub. Manual top-up was removed in v0.5.2.0; Saperly is postpaid and auto-charges the saved card on file. Direct users to https://app.saperly.com/billing.

## [0.2.0] (2026-04-19) mode rename and delete-line removal

### Breaking

- `saperly_delete_line` removed. An AI agent hallucinating a `lineId` could permanently release a real phone number. Use the portal (https://saperly.com/lines), the REST API (`DELETE /v1/lines/{id}`), or the SDK (`client.lines.delete(lineId)`).
- Mode enum tightened to `["webhook", "audio", "hosted"]`. Legacy `mode: "text"` via MCP now rejects (the REST API still accepts both for back-compat). Update scripts to use `"webhook"`.

## [0.1.0]

Initial release of the Saperly MCP server.
