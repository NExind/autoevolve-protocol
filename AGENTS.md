# Autonomous Agent Rules

This repository is designed for four independent coding agents. There is no
permanent technical-lead agent: ownership, GitHub discussion, and the
deterministic conflict procedure in coordination/PROTOCOL.md are the
coordination mechanism.

## Before every task

1. Read PROJECT_CONTEXT.md, ARCHITECTURE.md, API_CONTRACT.md, this file, and
   coordination/WORK_BOARD.md.
2. Fetch origin/main, inspect open GitHub issues/PRs for your scope, then claim
   one unclaimed task with a comment. If GitHub is temporarily unavailable,
   leave an append-only message with pnpm agent:mail.
3. Work only inside your ownership boundary. Do not edit another boundary just
   to make a local test pass; instead open a small interface RFC.

## Non-negotiable rules

- Never commit .env files, keys, wallet data, raw private prompts, or private
  traces.
- A task is complete only with a focused commit, command/result evidence, and
  a handoff note for dependent agents.
- Do not call a simulated status a real IPFS pin, ZK proof, or on-chain
  transaction.
- Treat the output-first 13-element public-signal order in API_CONTRACT.md as
  immutable until all affected scope owners explicitly acknowledge an RFC.
- Before using verified in a demo or PR, attach the relevant CID, local proof
  verification result, and/or confirmed transaction hash.

## Ownership boundaries

| Agent ID        | Owns                                                                                                 | Does not edit                                   |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| agent-core      | packages/core/\*\*, apps/web/app/api/runs/route.ts                                                   | proof, chain, memory, dashboard files           |
| agent-zk        | circuits/**, packages/contracts/**, proof/deployment rows in EVIDENCE.md                             | web API routes, SDKs, memory                    |
| agent-memory    | packages/memory/**, packages/chain/**, attestation and memory search routes, CID rows in EVIDENCE.md | circuit/contract source, dashboard presentation |
| agent-dashboard | apps/web/components/\*\* plus page, layout, CSS, next config, DEMO.md                                | API routes and package internals                |

Shared root documents, root configuration, and API contracts require the RFC
procedure. The agent that opens the RFC owns its implementation after peer
acknowledgements.

EVIDENCE.md is the exception: it is append-only for observed, non-secret
artifacts. An owning agent may fill only its designated evidence rows without
an RFC; it must never replace a missing artifact with a placeholder claim.
