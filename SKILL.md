---
name: saperly
description: >
  give your ai agent a phone number. provision lines, make calls,
  check compliance — all from claude code. saperly is the phone
  carrier for ai agents.
---

# saperly

saperly gives ai agents real phone numbers with built-in compliance.
text mode: your webhook gets transcribed text, responds with text.
audio mode: raw audio via websocket for voice-native ai.

## setup

set your api key:

```bash
export SAPERLY_API_KEY=sk_live_...
```

get your key at https://saperly.com/portal.
1,800 free credits on signup — enough for a phone number + ~30 minutes of webhook-mode calls (or ~18 min hosted).

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

### /buy-number

provision a text-mode phone line for your agent.

usage: `/buy-number`

creates a line with mode "text" and a default webhook url.
shows the provisioned phone number.

### /call

make an outbound call to a phone number.

usage: `/call +14155551234`

automatically grants consent if needed, then initiates the call.
the phone will ring. if text mode, saperly handles speech-to-text
and text-to-speech — your agent just sees text.

### /conversation-call

make an AI phone call where saperly handles the LLM. no webhook needed.
returns the full transcript when the call ends.

usage: `/conversation-call +14155551234 schedule a demo for next tuesday`

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

send an SMS reply within a conversation.

usage: `/sms +14155551234 Thanks for reaching out!`

### /conversations

list SMS conversations grouped by contact.

usage: `/conversations`

### /conversation

view full message history for a conversation.

usage: `/conversation <line-id> +14155551234`

### /balance

check your account credit balance and per-second rates.

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
mode: text
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

  2026-04-08  3 calls  12 min  132 credits
  2026-04-07  1 calls  5 min  55 credits

> /voices
4 voice(s):

  nova  Nova  female  american  conversational
  echo  Echo  male  american  warm

> /lines
1 line(s):

  +14155550123  text  active  "unnamed"

> /balance
balance: 313 credits
```

## how it works

saperly is a phone carrier for ai agents. three modes:

**text mode:** caller speaks -> saperly transcribes -> posts to your webhook ->
you respond with text -> saperly speaks it -> caller hears. 60 credits/min, billed per second.

**audio mode:** raw audio streams to your websocket. you handle s2t/t2s. 60 credits/min, billed per second.

**hosted mode:** saperly runs the LLM for you. just provide a system prompt
and saperly handles the entire conversation. 100 credits/min, billed per second. use conversation-call
or configure a line with a system prompt.

## resources

- https://saperly.com/docs/quickstart
- https://saperly.com/docs/api-reference
- https://saperly.com/docs/text-mode
- https://saperly.com/docs/compliance
