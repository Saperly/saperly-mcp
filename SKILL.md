---
name: saperly
description: >
  give your ai agent a phone number. provision lines, make calls,
  check compliance, all from claude code. saperly is the phone
  carrier for ai agents.
---

# saperly

saperly gives ai agents real phone numbers with built-in compliance.
webhook mode: your backend gets transcribed text and decides the response.
hosted mode: saperly runs the ai for you. audio mode: raw audio via websocket
for voice-native ai.

## setup

set your api key:

```bash
export SAPERLY_API_KEY=sk_live_...
```

get your key at https://saperly.com/settings/keys.
$5 free signup credit, enough for a phone number for 2 months OR ~38 minutes of webhook-mode calls (or ~19 min hosted). Credits never expire.

> Key management tools (`saperly_key_*`) require a service key (`sk_svc_test_...` or `sk_svc_live_...`), not an API key. Mint one in the portal at Settings → Service Keys.

### claude desktop config

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

## commands

These are user-facing shortcuts. When you handle one, translate it into the underlying MCP tool call with appropriate arguments. The tool schemas have required fields (e.g. `saperly_create_line` requires `name`, `saperly_create_call` requires both `lineId` and `toNumber`); generate sensible defaults or look up missing context from prior tool calls before calling the tool.

### /buy-number

provision a webhook-mode phone line for your agent.

usage: `/buy-number`

invoke `saperly_create_line` with `mode: "webhook"` and a generated `name` (e.g. "my agent" or pick from context). shows the provisioned phone number.

### /call

make an outbound call to a phone number.

usage: `/call +14155551234`

invoke `saperly_create_call` with `lineId` (the line from a prior `/buy-number` or `saperly_list_lines`; if none, run `/buy-number` first) and `toNumber: "+14155551234"`. automatically grants consent if needed, then initiates the call. the phone will ring. in webhook mode, saperly handles speech-to-text and text-to-speech, your agent just sees text via the webhook.

### /conversation-call

make an AI phone call where saperly handles the LLM. no webhook needed.
returns the full transcript when the call ends.

usage: `/conversation-call +14155551234 schedule a demo for next tuesday`

invoke `saperly_create_conversation_call` with `lineId`, `toNumber: "+14155551234"`, and the prompt as `systemPrompt`.

### /lines

list all your phone lines with numbers and mode. lines support voice calls and inbound SMS.

usage: `/lines`

### /update-line

update a phone line's settings: webhook, system prompt, voice, recording, etc.

usage: `/update-line <line-id> systemPrompt="You are a helpful assistant"`

### /calls

show recent call history.

usage: `/calls`

### /sms

send an outbound SMS. requires either an inbound SMS from the recipient within the last 24 hours, OR an active `explicit_outbound` consent record on file for that (line, recipient) pair (recorded via `POST /v1/consent` or a documented web-form opt-in).

usage: `/sms +14155551234 Thanks for reaching out!`

invoke `saperly_send_sms` with `lineId`, `to: "+14155551234"`, and `text: "Thanks for reaching out!"`.

### /conversations

list SMS conversations grouped by contact.

usage: `/conversations`

### /conversation

view full message history for a conversation.

usage: `/conversation <line-id> +14155551234`

### /balance

check your account balance and per-second rates.

usage: `/balance`

### /usage

view usage statistics by day or month.

usage: `/usage` or `/usage monthly`

### /settings

view or update account settings like default webhook URL.

usage: `/settings`

### /voices

list available TTS voices for hosted-mode calls.

usage: `/voices`

## example

```
> /buy-number
line created!

phone: +14155550123
id: line-abc123
name: unnamed
mode: webhook
status: active

> /call +14155551234
consent granted for +14155551234 on line line-abc123.
call initiated!

from: +14155550123
to: +14155551234
status: initiated

> /conversation-call +14155551234 confirm the appointment for friday
call_id: call-xyz789
status: completed
duration: 42s

transcript:
  [assistant]: Hi, I'm calling to confirm your appointment on Friday.
  [user]: Yes, Friday at 2pm works great.
  [assistant]: Perfect, you're confirmed for Friday at 2pm. Have a great day!

> /sms +14155551234 Your appointment is confirmed for Friday 2pm.
SMS sent!
id: msg-abc123
to: +14155551234
status: queued

> /conversations
2 conversation(s):

  +14155551234  5 msgs  last: "Thanks!" (inbound)
  +14155559876  1 msgs  last: "Hi there" (inbound)

> /usage
daily usage:

  2026-04-08  3 calls  12 min  $1.56
  2026-04-07  1 calls  5 min  $0.65

> /voices
2 voice(s):

  nova  Nova  female  american  conversational
  echo  Echo  male  american  warm

> /lines
1 line(s):

  +14155550123  webhook  active  "unnamed"

> /balance
balance: $3.13
```

## how it works

saperly is a phone carrier for ai agents. three modes:

**webhook mode:** caller speaks, saperly transcribes, posts to your webhook,
you respond with text, saperly speaks it, caller hears. $0.13/min Zone A (US/CA), billed per second.

**audio mode:** raw audio streams to your websocket. you handle s2t/t2s. $0.13/min Zone A (US/CA), billed per second.

**hosted mode:** saperly runs the LLM for you. just provide a system prompt
and saperly handles the entire conversation. $0.26/min Zone A (US/CA), billed per second. use conversation-call
or configure a line with a system prompt.

## resources

- https://docs.saperly.com/quickstart
- https://docs.saperly.com/api-reference
- https://docs.saperly.com/agent-onboarding
- https://docs.saperly.com/service-keys
- https://docs.saperly.com/guides/webhook-mode
- https://docs.saperly.com/guides/compliance-and-consent
