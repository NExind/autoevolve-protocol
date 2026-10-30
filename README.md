# AutoEvolve Protocol

AutoEvolve is an open-source framework for a bounded self-improving agent. Its
target end-to-end flow is:

1. generate a machine-readable DataDAO sharing policy;
2. deterministically evaluate it against a versioned safety rubric;
3. critique and revise it from V1 to V2 to V3;
4. ZK-attest that the committed score strictly improved;
5. pin the sanitized execution memory to IPFS; and
6. settle a locally verified attestation and micro-reward on Base Sepolia.

The dashboard deliberately distinguishes **what is proven** (a score improvement
under a committed evaluator) from **what is not proven** (the truthfulness of a
model's hidden reasoning).

## Quick start

    pnpm install
    pnpm dev

Open http://localhost:3000. Without secrets, the app runs an explicitly labelled
deterministic showcase replay. Add values from `.env.example` to `.env.local` to
enable live Gemini and Pinata paths. A real proof still needs the x86-64 proof
host, and a real Base Sepolia settlement needs deployed contracts, funded wallets,
and the registry address.

## Start four autonomous coding devices

The repository includes a peer-to-peer collaboration protocol rather than a
manager agent. After creating a GitHub repository and authenticating the CLI:

    git remote add origin https://github.com/OWNER/REPOSITORY.git
    git push -u origin main
    pnpm github:bootstrap -- --repo OWNER/REPOSITORY

Give each device one prompt from [prompts](prompts/README.md). They claim
tasks, discuss interface changes, open PRs, and hand work off directly through
GitHub. If GitHub is unavailable, they use the append-only Git-backed mailbox
in [coordination](coordination/README.md). No API key, private wallet key, or
private prompt belongs in either channel.

## What is runnable now

- The dashboard, deterministic V1→V2→V3 replay, evaluator, changelog, and
  safe-memory presentation run locally.
- `POST /api/attest` returns `prepared` without a Pinata token and `pinned` only
  after Pinata returns a real CID.
- Live Gemini runs only when `GEMINI_API_KEY` is present; it never silently
  substitutes a showcase result.

## What must be completed before the final “verified” demo

1. Run the Circom/snarkjs workflow on the dedicated x86-64 proof host and
   retain a successful local verification artifact.
2. Export and deploy the generated verifier, adapter, and registry to Base
   Sepolia; record their contract addresses and a confirmed transaction hash.
3. Pin a sanitized snapshot, generate a proof that binds its CID hash, and
   settle it with the deployed registry.
4. Query the on-chain CID through Agent Beta and rehearse the whole route twice.

Until those observed artifacts exist, call the state `prepared` or `pinned`, not
`proof verified` or `on-chain settled`.

## Repository map

| Path                 | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `apps/web`           | Next.js developer dashboard and server routes           |
| `packages/core`      | policy schemas, evaluator, agent loop, diffs, fixtures  |
| `packages/memory`    | sanitized IPFS snapshot and collective-memory retrieval |
| `packages/chain`     | Base Sepolia registry ABI and viem helpers              |
| `packages/contracts` | registry contracts, local tests, deploy/ZK scripts      |
| `circuits`           | Circom score-improvement circuit and proving fixtures   |

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md),
and [API_CONTRACT.md](API_CONTRACT.md) before changing shared interfaces.

## Truthful demo claims

After an actual successful verification, the proof establishes that a fixed
circuit evaluated two committed, private policies under the same rubric and
found the later score higher. It binds the claim to the agent wallet, run,
version commitments, and IPFS CID. It does not prove that an LLM's hidden
reasoning was correct or that public IPFS content is private.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before distributing
generated verifier artifacts.
