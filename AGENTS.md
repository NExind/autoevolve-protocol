# AI Agent Collaboration Rules

- Read `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, and `API_CONTRACT.md` before coding.
- One agent owns one module; do not edit a module owned by another agent.
- Do not change `DataPolicy`, public API shapes, contract public-signal order, or
  root configuration without an integration issue and lead approval.
- Never commit `.env*`, keys, generated wallet data, private prompts, or private traces.
- A task is complete only with a commit, test/build command, result, and blocker note.
- Do not call a simulated status a real IPFS pin, ZK proof, or on-chain transaction.
- Treat the output-first 13-element public-signal order in `API_CONTRACT.md` as
  immutable. Escalate a change to the integration lead before editing it.
- Before using `verified` in a demo or PR, attach the relevant CID, local proof
  verification result, and/or confirmed transaction hash.

| Scope                                     | Owner boundary              |
| ----------------------------------------- | --------------------------- |
| `packages/core/**`                        | agent engine/evaluator      |
| `packages/memory/**`, `packages/chain/**` | memory + EVM client         |
| `circuits/**`, `packages/contracts/**`    | ZK + contract               |
| `apps/web/**`                             | dashboard + API integration |
