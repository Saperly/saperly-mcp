---
name: saperly
description: >
  give your ai agent a phone number. provision lines, make calls,
  send sms, check compliance — all from claude code. saperly is
  the phone carrier for ai agents.
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
$5 free credit on signup — enough for a phone number + ~60 minutes of calls.

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

### /lines

list all your phone lines with numbers and mode.

usage: `/lines`

### /calls

show recent call history.

usage: `/calls`

### /sms

send an sms from one of your lines.

usage: `/sms +14155551234 hello from my agent!`

first argument is the phone number, everything after is the message.
consent must be granted first. costs $0.01 per message.

### /balance

check your account credit balance and per-minute rates.

usage: `/balance`

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

> /lines
1 line(s):

  +14155550123  text  active  "unnamed"

> /sms +14155551234 hey, just following up on our call!
sms sent!

id: SM1234abc
from: +14155550123
to: +14155551234
status: sent

> /balance
balance: $4.84 USD

rates:
  outbound: $0.05/min
  inbound: $0.03/min
  phone number: $2.00/mo
```

## how it works

saperly is a phone carrier, not an ai platform. you bring your own agent.
saperly gives it a phone number, handles compliance (tcpa disclosure,
consent tracking, audit trail), and manages the telephony infrastructure.

**text mode:** caller speaks -> saperly transcribes -> posts to your webhook ->
you respond with text -> saperly speaks it -> caller hears.

**audio mode:** raw audio streams to your websocket. you handle s2t/t2s.

## resources

- https://saperly.com/docs/quickstart
- https://saperly.com/docs/api-reference
- https://saperly.com/docs/text-mode
- https://saperly.com/docs/compliance
