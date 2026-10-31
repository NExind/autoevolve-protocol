# AutoEvolve Protocol

> **Bounded Self-Improving AI Agents with Zero-Knowledge Proofs & On-Chain Settlement on Base Sepolia.**

[![Tests](https://img.shields.io/badge/tests-89%20passed-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black.svg)]()
[![Circom](https://img.shields.io/badge/Circom-2.0%20Groth16-orange.svg)]()
[![Network](https://img.shields.io/badge/Base%20Sepolia-84532-0052FF.svg)](https://sepolia.basescan.org/address/0x24473c0043b13d56874d10de9675728e2014a66c)

---

## ⚡ What is AutoEvolve Protocol?

Autonomous AI agents often grade their own work and ask users to trust their claims of "self-improvement". **AutoEvolve Protocol** replaces unverifiable self-evaluations with a mathematically grounded, cryptographically verified pipeline:

1. **Autonomous Evolution**: An agent generates an initial domain candidate ($V1$), undergoes rigorous adversarial review by an independent AI Critic, and iteratively hardens the solution through guarded revisions ($V2 \rightarrow V3$).
2. **Dual-Track Generation**: Generates both the strict 10-field arithmetic policy for ZK circuits and rich, multi-phase Markdown documentation (e.g. cybersecurity roadmaps, cloud architectures, clinical protocols) in parallel.
3. **Objective Evaluation**: Every version is evaluated by a deterministic, unhackable 100-point rubric.
4. **Zero-Knowledge Proofs**: A Circom 2.0 Groth16 zk-SNARK circuit proves that $\text{Score}(V_{n+1}) > \text{Score}(V_n)$ over Poseidon-committed private policies without exposing proprietary details or reasoning.
5. **On-Chain Settlement**: Real smart contracts on Base Sepolia verify the 13-signal Groth16 proof, emit settlement receipts, and release micro-bounties to the agent's wallet.
6. **Cross-Agent Collective Memory**: Sanitized execution memories are pinned to IPFS, registered on Base Sepolia, and safely inherited by subsequent agents (**Agent Beta**) through strict anti-injection allowlisting.

---

## 🔗 Live Verified Artifacts on Base Sepolia & IPFS

| Resource                                   | Identifier / Address                                                 | Verification Link                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Base Sepolia Registry Contract**         | `0x24473c0043b13d56874d10de9675728e2014a66c`                         | [View on BaseScan ↗](https://sepolia.basescan.org/address/0x24473c0043b13d56874d10de9675728e2014a66c)                       |
| **Groth16 Verifier Contract**              | `0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764`                         | [View on BaseScan ↗](https://sepolia.basescan.org/address/0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764)                       |
| **Verifier Adapter Contract**              | `0xd46ee3e820d12e113af3e6ad7b6867e18d560c37`                         | [View on BaseScan ↗](https://sepolia.basescan.org/address/0xd46ee3e820d12e113af3e6ad7b6867e18d560c37)                       |
| **V1 $\rightarrow$ V2 Settlement Receipt** | `0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f` | [View Tx on BaseScan ↗](https://sepolia.basescan.org/tx/0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f) |
| **V2 $\rightarrow$ V3 Settlement Receipt** | `0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f` | [View Tx on BaseScan ↗](https://sepolia.basescan.org/tx/0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f) |
| **Pinata IPFS Sanitized Snapshot**         | `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm`        | [Inspect on IPFS Gateway ↗](https://gateway.pinata.cloud/ipfs/bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm)  |

---

## 🚀 Quick Start (60 Seconds — Zero Keys Required)

AutoEvolve is designed to be **instantly runnable out-of-the-box**. No API keys, cloud subscriptions, or Web3 wallets are required to test the deterministic showcase replay.

### 1. Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0

### 2. Clone & Install

```bash
git clone https://github.com/NExind/autoevolve-protocol.git
cd autoevolve-protocol
pnpm install
```

### 3. Start the Development Server

```bash
pnpm dev
```

Open **`http://localhost:3000`** in your browser. The dashboard will load immediately in **Deterministic Showcase Replay** mode, ready for inspection!

---

## ⚙️ Live Multi-Model Setup (Optional)

To enable live inference with **Featherless** (open-source models like Qwen-2.5-Coder), **Google Gemini**, or live **IPFS Pinning**, configure `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Option A: Featherless (Open-source LLM inference for generator & critic)
FEATHERLESS_API_KEY=your_featherless_api_key
FEATHERLESS_GENERATOR_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
FEATHERLESS_CRITIC_MODEL=deepseek-ai/DeepSeek-R1-Distill-Qwen-32B

# Option B: Google Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# IPFS Pinning (Pinata)
PINATA_JWT=your_pinata_jwt_token

# Base Sepolia Contract Address (pre-configured)
NEXT_PUBLIC_REGISTRY_ADDRESS=0x24473c0043b13d56874d10de9675728e2014a66c
NEXT_PUBLIC_EXPLORER_BASE_URL=https://sepolia.basescan.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

> **Honest Fallback Guarantee**: If live mode is selected without API keys, AutoEvolve returns a clean, transparent HTTP 503 explanation rather than silently faking live execution.

---

## 🧭 Judge Evaluation Walkthrough (2-Minute Test)

Judges can verify the entire protocol in 6 simple steps:

1. **Inspect Cryptographic Trust Boundary**:
   - Notice the prominent Hero Card at the top of the dashboard. AutoEvolve explicitly delineates what is mathematically proven (score monotonicity, Poseidon commitments, CID bindings) from what is not proven (hidden LLM reasoning).
2. **Execute Evolution**:
   - Click **"Run showcase replay"** (or type a custom domain prompt like _"Design a comprehensive roadmap for learning cybersecurity"_ and click **"Run live evolution"** if keys are set).
   - Observe the step-by-step progress: **$V1$ (40/100) $\rightarrow$ $V2$ (70/100) $\rightarrow$ $V3$ (100/100)**.
3. **Explore the 5-Mode Output Inspector**:
   - **📊 3-Version Matrix**: Compare all 10 policy fields side-by-side with passing thresholds.
   - **📄 Written Solution**: Read the genuine, multi-phase Markdown solution tailored to the prompt. Click **"📋 Copy Document"** to verify full text extraction.
   - **🔍 Single Output**: Deeply inspect any active version's controls and rationale.
   - **🔀 Semantic Diff**: Inspect exact field-level diffs (`redactDirectIdentifiers: false → true`).
   - **📋 Raw JSON**: View and copy the complete machine-readable manifest.
4. **Audit the Adversarial AI Critic**:
   - Select $V1$ or $V2$ and review the **Independent Rubric Critique** panel. The critic identifies domain risks and proposes concrete repair plans that drive the next version.
5. **Inspect the 13-Signal Groth16 Public ABI**:
   - Click **"Inspect 13-Signal ABI ↗"** in the Verifiability Ledger. Confirm the immutable output-first signal structure used by Circom and the EVM verifier.
6. **Verify Cross-Agent Collective Memory**:
   - Scroll to the **Cross-Agent Collective Memory** section and click **"Check On-Chain Registry Memory"**.
   - Watch the dashboard query Base Sepolia, verify `keccak256(bytes(cid))`, and safely load 9 allowlisted memory cards for **Agent Beta** with zero prompt-injection risk.

---

## 🧪 Comprehensive Verification Commands

Run the full automated test suite and verification checks across the entire monorepo:

```bash
# 1. Run all 89 unit & integration tests (Core, Memory, Chain, Contracts, Circom signals)
pnpm test

# 2. Perform strict TypeScript type checking across all 6 workspace packages
pnpm check

# 3. Verify GitHub-flavored formatting and styling
pnpm format:check

# 4. Build optimized production Next.js application
pnpm build
```

---

## 🏗️ Monorepo Architecture

```
autoevolve-protocol/
├── apps/
│   └── web/                 # Next.js 16 App Router dashboard and server-side API routes
├── packages/
│   ├── core/                # Policy schemas, deterministic evaluator, agent loop, diffs
│   ├── memory/              # SnapshotCore sanitizer, IPFS pinning, memory card allowlisting
│   ├── chain/               # Base Sepolia contract ABIs, viem client helpers
│   └── contracts/           # Solidity smart contracts, deploy scripts, integration tests
├── circuits/
│   ├── AutoEvolveImprovement.circom # Circom 2.0 Groth16 zk-SNARK circuit (6,448 constraints)
│   └── scripts/             # snarkjs witness, proving, and verification scripts
├── API_CONTRACT.md          # Authoritative REST API payload contracts & 13-signal ABI
├── ARCHITECTURE.md          # Detailed system architecture diagram & subsystem breakdown
├── DEMO.md                  # Five-minute judge presentation script & fallback playbook
├── EVIDENCE.md              # Append-only ledger of observed cryptographic & on-chain artifacts
└── THIRD_PARTY_NOTICES.md   # Open-source licenses & dependencies
```

---

## 🛡️ Truth & Honesty Guarantee

AutoEvolve adheres to a non-negotiable honesty policy:

- **No Simulated Proofs**: Zero-knowledge proofs are generated through real snarkjs Groth16 workflows.
- **No Fabricated CIDs**: The pinned snapshot CID is live on the public Pinata gateway.
- **No Mock Transactions**: Base Sepolia contract addresses, deployment hashes, and settlement receipts are real, confirmed on-chain transactions viewable on BaseScan.
- **No Secret Leakage**: Private keys, model tokens, raw system prompts, and unredacted PII are strictly excluded from git, IPFS snapshots, and client bundles.

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.
