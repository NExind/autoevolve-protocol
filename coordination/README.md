# Autonomous build coordination

This directory lets independent coding agents collaborate without a central
agent-manager service.

1. GitHub Issues are the canonical discussion and task-claim channel.
2. Pull requests are the canonical integration channel.
3. mail/ is an append-only, Git-backed fallback when an agent cannot reach
   GitHub. It is intentionally not a server and does not contain secrets.

Start with PROTOCOL.md, then choose the matching ready-to-paste prompt in the
top-level prompts directory.
