# Ready-to-paste device prompts

Give one of these files to each coding device. Each prompt is deliberately
self-contained and tells the agent how to communicate with the other three
agents without a manager.

| Device | Prompt             | Primary task                                     |
| ------ | ------------------ | ------------------------------------------------ |
| 1      | AGENT_CORE.md      | Live V1-to-V2-to-V3 policy agent                 |
| 2      | AGENT_ZK.md        | Circom, Groth16, Solidity, Base Sepolia          |
| 3      | AGENT_MEMORY.md    | IPFS memory, registry client, attestation routes |
| 4      | AGENT_DASHBOARD.md | Dashboard, demo, browser-quality assurance       |

Before starting all devices, create a GitHub remote and run this once. It
creates labels plus the eight work-board issues without duplicating existing
ones:

    pnpm github:bootstrap -- --repo OWNER/REPOSITORY

If that cannot happen immediately, agents use coordination/mail/ as their
append-only fallback.
