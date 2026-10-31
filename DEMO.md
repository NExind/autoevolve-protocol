# Five-minute AutoEvolve Demo Script

This document is the official judge presentation script for the AutoEvolve Protocol developer dashboard.
The presenter must adhere to the non-negotiable honesty boundary: use only states and artifacts verified in [EVIDENCE.md](EVIDENCE.md). Never improvise or simulate a ZK proof, Pinata CID, or Base Sepolia transaction.

---

## 0:00–0:30 — Problem Statement & The 90-Second Hook

**Presenter Script:**

> _"Autonomous agents typically grade themselves and ask users to trust their scores. AutoEvolve turns self-improvement claims into verifiable evidence: a bounded policy agent evolves from V1 to V2 to V3, deterministic score increases are mathematically proven via Circom Groth16 zero-knowledge proofs over private policy commitments, sanitized memory is pinned to IPFS, and a second agent (Agent Beta) inherits only allowlisted lessons—without exposure to prompt injection or raw traces."_

**Dashboard Actions:**

1. Open the dashboard at `http://localhost:3000` (or production URL).
2. Point out the top header:
   - Notice the **Showcase Replay** badge: clearly discloses offline deterministic mode.
   - Notice the **Base Sepolia (84532)** status: indicates live registry connection when configured, never a deceptive status.
3. Highlight the **Cryptographic Trust Boundary** card in the hero:
   - Explicitly contrast what IS proven (strict score monotonicity 40 → 70 → 100, 10 deterministic checks, Poseidon commitments, run ID, and CID binding) versus what is NOT proven (hidden LLM reasoning, internal chain-of-thought, or broad factual truth).
4. Click **Inspect 13-Signal ABI ↗**:
   - Show judges the immutable 13 public signals in output-first serialization order (Index 0: `previousScore`, Index 1: `nextScore`, Index 2: `binding`, followed by inputs). Close the modal.

---

## 0:30–1:45 — The Evolution Loop (V1 → Critique → V2 → Critique → V3)

**Presenter Script:**

> _"Our agent is given an objective—such as designing a cybersecurity roadmap or health research sharing policy. In parallel, it formulates the strict 10-field arithmetic policy for Circom ZK proof generation and a rich, multi-phase Markdown document. Let's inspect each stage of evolution."_

**Dashboard Actions:**

1. Click **Run showcase replay** (or enter a custom scenario prompt and click **Run live evolution**):
   - Note the instant execution with zero external secrets required.
2. Select **V1** on the execution graph:
   - Show score: **40/100** (or live candidate baseline).
   - Point to the **Deterministic Evaluation** panel: failed checks displayed with instant visual indicators.
   - Point to the **Independent Rubric Critique**: explains domain risks and lists targeted repair strategies.
3. Switch across the **5-Mode Output Inspector**:
   - **📄 Written Solution**: Highlight the rich, multi-phase Markdown document directly answering the objective. Click **"📋 Copy Document"** to demonstrate one-click clipboard extraction.
   - **📊 3-Version Matrix**: Compare all 10 policy fields across V1, V2, and V3 side-by-side against passing thresholds.
   - **🔍 Single Output**: Deeply inspect any active version's controls and rationale.
   - **🔀 Semantic Diff**: Show exact field-level changes between revisions (`redactDirectIdentifiers: false → true`).
   - **📋 Raw JSON**: View the full machine-readable manifest with one-click copy.
4. Click **View Guardrail & Agent Events**:
   - Expand the chronological event stream showing `[GENERATED]`, `[EVALUATED]`, `[CRITIQUED]`, `[REVISED]`, and `[GUARDRAIL]` events.
5. Select **V2**:
   - Show score leap: **+30 points → 70/100**.
   - Show the guarded revision incorporating the adversarial critic's repair plan.
6. Select **V3**:
   - Show final score: **100/100**.
   - All 10 rubric checks pass! Complete production-ready architecture achieved.

---

## 1:45–2:30 — Zero-Knowledge Proof Boundary & Prover Workflow

**Presenter Script:**

> _"How do we prove this policy improved without revealing proprietary policy details? We use Circom 2 and snarkjs Groth16."_

**Dashboard Actions:**

1. Focus on the **Evidence Status Ledger** (5-Stage Verification Lifecycle):
   - **Stage 1 (Evaluator):** `READY` (Verified deterministic scoring).
   - **Stage 2 (Circuit):** `SOURCE READY` (`AutoEvolveImprovement.circom`).
2. Explain the ZK privacy boundary:
   - Private witnesses: normalized V1/V2 and V2/V3 policy fields.
   - Circuit outputs: derived scores (40, 70, 100) and metadata binding.
   - Proof constraint: enforces `nextScore > previousScore` strictly.
3. Honest evidence check:
   - Highlight the 13-signal output-first public signal structure.
   - Explain truthful externalization: _"The Circom circuit and input generator are verified, and proof generation is externalized to an x86-64 proof host via `pnpm zk:prove` to avoid simulated browser proofs."_

---

## 2:30–3:30 — Historical Attested Showcase Evidence (Base Sepolia & IPFS)

**Presenter Script:**

> _"These public artifacts belong to the historical attested showcase (40 → 70 → 100), whereas the live Gemini Agent Beta run demonstrated safe lesson inheritance. Every on-chain settlement and decentralized memory snapshot is publicly verifiable on Base Sepolia and the Pinata IPFS gateway."_

**Dashboard Actions:**

1. Navigate to the **Historical Attested Showcase Evidence** panel:
   - Point out the non-negotiable evidence boundary banner:
     _"These public artifacts belong to the historical attested showcase, not the current live Gemini run."_
   - Show the historical score progression: **40 → 70 → 100** for Run ID `showcase-run-2026-10-30`.
2. Inspect the verified public artifacts:
   - **IPFS Pinata Gateway:** Click the CID link [`bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm`](https://gateway.pinata.cloud/ipfs/bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm) to show the immutable JSON `SnapshotCore` with 9 allowlisted memory cards and matching SHA-256 payload hash (`0x8964650c295a1df37ee403ba597e8303c433621aeb959ea41db69d3da517b435`).
   - **Base Sepolia Registry:** Click the contract link [`0x24473c0043b13d56874d10de9675728e2014a66c`](https://sepolia.basescan.org/address/0x24473c0043b13d56874d10de9675728e2014a66c) to show the active registry on BaseScan Sepolia.
   - **V1 → V2 Settlement Receipt:** Click [`0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f`](https://sepolia.basescan.org/tx/0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f) (Block 52402461, score 40 → 70, 0.0001 ETH bounty paid).
   - **V2 → V3 Settlement Receipt:** Click [`0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f`](https://sepolia.basescan.org/tx/0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f) (Block 52402476, score 70 → 100, 0.0001 ETH bounty paid, verified version 3).
   - **Groth16 Verifier Contract:** Click [`0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764`](https://sepolia.basescan.org/address/0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764) to show the on-chain bn128 pairing verifier.
   - **Escrow Funding Tx:** Click [`0xe97cfe3d76aaf64118d8c8e83b79c51086557442a0313442f7b2be7786bfc78c`](https://sepolia.basescan.org/tx/0xe97cfe3d76aaf64118d8c8e83b79c51086557442a0313442f7b2be7786bfc78c) to show the funded 0.0002 ETH reward pool.

---

## 3:30–4:30 — Cross-Agent Collective Memory & Agent Beta Safe Inheritance

**Presenter Script:**

> _"The true test of a memory protocol is whether another agent can safely learn from past failures without suffering prompt injection. Let's inspect how Agent Beta queries Base Sepolia and inherits lessons."_

**Dashboard Actions:**

1. Navigate to the **Cross-Agent Collective Memory** section:
   - Point out the security pipeline:
     `Registry Pointer → CID Keccak Hash Check → Schema Validation → Allowlisted Memory Cards`.
2. Click **Check On-Chain Registry Memory**:
   - The dashboard makes a live call to `GET /api/memory/search?taskHash=0xee47106d1510135e97c62f99e8ca2e018320588c9da88917a11d55bbeff49890`.
   - Visibly observe the verified state:
     - **✓ ON-CHAIN MEMORY ACTIVE**
     - CID: `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm` (clickable)
     - Score: **100/100** (Version: **v3**)
     - Settled Agent: `0xDad3...2F46`
   - Point out that **9 verified safe memory cards** are loaded into the UI.
3. Inspect the **Memory Cards**:
   - Each card contains only typed `failureCode` (e.g., `PII_EXPOSURE`, `K_ANONYMITY_TOO_LOW`) and structured `safePatchStrategy`.
   - Emphasize to judges: _Raw prompts and unvalidated IPFS text are never passed to Agent Beta; only schema-validated, allowlisted fields are used._
   - Point out the **"💾 Download Snapshot JSON"** button in the Verifiability Ledger, allowing offline judges to export the sanitized canonical `SnapshotCore` payload locally.
   - Point out the **"Inspect Historical Base Sepolia Contract ↗"** direct link in the unconfigured state to view the verified smart contract on BaseScan Sepolia.
4. If available from a live run:
   - Point to the **Agent Beta Lesson Inheritance Event** banner:
     _"Retrieved 9 verified lesson(s) from on-chain CID bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm."_
   - Clarify that Agent Beta started from score 60 and reached 100 by applying these verified lessons.

---

## 4:30–5:00 — Conclusion & Trust Defense

**Presenter Script:**

> _"AutoEvolve Protocol doesn't make vague claims about artificial general intelligence. We prove what can be mathematically verified: strict policy improvement under an objective rubric, cryptographically bound to decentralized storage and EVM settlement. It's reproducible, verifiable, and honest. The displayed historical storage and settlement artifacts are publicly verifiable; the live Gemini run is explicitly labelled unsettled."_

---

## Fallback & Emergency Playbook

If any live service (Gemini, Pinata, Base Sepolia RPC) fails or is unavailable during judging:

1. **Gemini Offline:** Click "Run showcase replay". The deterministic replay executes completely client/server side with zero API keys. If "Run live Gemini" is clicked, point to the clean HTTP 503 error message as proof of honest validation.
2. **Pinata Gateway Offline:** The Historical Attested Showcase Evidence panel lists the public CID and canonical hash directly, and local SnapshotCore schema validation guarantees deterministic verification.
3. **Base Sepolia RPC Offline:** Click "Check On-Chain Registry Memory". The dashboard will cleanly show `UNCONFIGURED` or `ERROR` without crashing or freezing.
4. **No Simulated States:** At no point does the dashboard display fake green checks, fabricated hashes, or simulated wallet balances.
