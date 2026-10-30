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
   - Notice the **Base Sepolia (84532)** status: neutral/unconfigured dot, never a deceptive green checkmark before settlement.
3. Highlight the **Cryptographic Trust Boundary** card in the hero:
   - Explicitly contrast what IS proven (strict score monotonicity 40 → 70 → 100, 10 deterministic checks, Poseidon commitments, run ID, and CID binding) versus what is NOT proven (hidden LLM reasoning, internal chain-of-thought, or broad factual truth).
4. Click **Inspect 13-Signal ABI ↗**:
   - Show judges the immutable 13 public signals in output-first serialization order (Index 0: `previousScore`, Index 1: `nextScore`, Index 2: `binding`, followed by inputs). Close the modal.

---

## 0:30–1:45 — The Evolution Loop (V1 → Critique → V2 → Critique → V3)

**Presenter Script:**

> _"Our agent is given a real DataDAO health data-sharing policy to repair. Let's inspect each stage of evolution."_

**Dashboard Actions:**

1. Click **Run showcase replay** (or inspect current initial trace):
   - Note the instant execution with zero external secrets required.
2. Select **V1** on the execution graph:
   - Show score: **40/100**.
   - Point to the **Deterministic Evaluation** panel: 6 failed checks (`redactDirectIdentifiers`, `blockRestrictedRegions`, `minKAnonymity`, `requireDualApprovalHighVolume`, `maxExportRows`, `retentionDays`).
   - Point to the **Independent Rubric Critique**: explains the identified risks and lists targeted repair strategies.
3. Click **View Guardrail & Agent Events**:
   - Expand the chronological event stream showing `[GENERATED]`, `[EVALUATED]`, `[CRITIQUED]`, `[REVISED]`, and `[GUARDRAIL]` events.
4. Select **V2**:
   - Show score leap: **+30 points → 70/100**.
   - Show the **Semantic Policy Diff**: directly shows field-level changes:
     - `redactDirectIdentifiers: false → true`
     - `blockRestrictedRegions: false → true`
     - `minKAnonymity: 2 → 5`
   - Point to the remaining 3 failed checks in the evaluator checklist.
5. Select **V3**:
   - Show final score: **100/100** (+30 points).
   - Show semantic diffs resolving the remaining controls:
     - `requireDualApprovalHighVolume: false → true`
     - `maxExportRows: 12,000 → 10,000`
     - `retentionDays: 60 → 30`
   - All 10 rubric checks pass! Click **Inspect All 10 Fields** to show the complete policy state.

---

## 1:45–3:00 — Zero-Knowledge Proof Boundary & Prover Workflow

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
   - If local proof files exist under `circuits/proofs/`, show them.
   - If proofs have not been generated in this session, state truthfully: _"The Circom circuit and input generator are verified, and proof generation is externalized to an x86-64 proof host via `pnpm zk:prove` to avoid simulated browser proofs."_

---

## 3:00–4:00 — Sanitized Decentralized Memory (IPFS) & On-Chain Settlement

**Presenter Script:**

> _"Once a policy improvement candidate is frozen, we prepare an immutable memory snapshot and attest it on Base Sepolia."_

**Dashboard Actions:**

1. Click **Prepare Sanitized Memory Snapshot**:
   - Explain what happens behind the scenes:
     - Sanitizes execution memory into a canonical `SnapshotCore`.
     - Completely strips private prompts, API keys, raw model thoughts, and user traces.
     - Derives canonical SHA-256 payload hash (displayed in UI).
2. Honest status rendering:
   - If `PINATA_JWT` is configured: shows real `bafy...` CID and clickable IPFS gateway link.
   - If `PINATA_JWT` is unconfigured: visibly shows `PREPARED (LOCAL)` with canonical hash, explaining that a real CID is only returned when Pinata credentials are supplied.
3. Settlement status:
   - If Base Sepolia transaction exists: shows confirmed tx hash with link to BaseScan Sepolia (`https://sepolia.basescan.org/tx/...`).
   - If unconfigured: shows `UNSETTLED`, never displaying a fabricated transaction hash.

---

## 4:00–4:40 — Cross-Agent Collective Memory (Agent Beta Inheritance)

**Presenter Script:**

> _"The true test of a memory protocol is whether another agent can safely learn from past failures without suffering prompt injection."_

**Dashboard Actions:**

1. Navigate to the **Cross-Agent Collective Memory** section:
   - Point out the data pipeline:
     `Registry Pointer → CID Keccak Hash Check → Schema Validation → Allowlisted Memory Cards`.
2. Click **Check On-Chain Registry Memory**:
   - Demonstrates real live query to `GET /api/memory/search?taskHash=...`.
   - Explains that without registry deployment, the protocol returns an honest `UNCONFIGURED` state rather than mocking data.
3. Inspect the **Memory Cards**:
   - Each card contains only typed `failureCode` (e.g., `PII_EXPOSURE`, `K_ANONYMITY_TOO_LOW`) and structured `safePatchStrategy`.
   - Emphasize to judges: _Raw prompts or untrusted text are NEVER passed to Agent Beta. Prompt injection is impossible because memory cards are strictly validated against an allowlist schema._

---

## 4:40–5:00 — Conclusion & Trust Defense

**Presenter Script:**

> _"AutoEvolve Protocol doesn't make vague claims about artificial general intelligence. We prove what can be mathematically verified: strict policy improvement under an objective rubric, cryptographically bound to decentralized storage and EVM settlement. It's reproducible, verifiable, and honest."_

---

## Fallback & Emergency Playbook

If any live service (Gemini, Pinata, Base Sepolia RPC) fails or is unavailable during judging:

1. **Gemini Offline:** Click "Run showcase replay". The deterministic replay executes completely client/server side with zero API keys. If "Run live Gemini" is clicked, point to the clean HTTP 503 error message as proof of honest validation.
2. **Pinata Offline:** Click "Prepare Sanitized Memory Snapshot". The local sanitization and SHA-256 canonical hash pipeline will execute and display the local `PREPARED` state.
3. **Base Sepolia RPC Offline:** Click "Check On-Chain Registry Memory". The dashboard will cleanly show `UNCONFIGURED` or `ERROR` without crashing or freezing.
4. **No Simulated States:** At no point does the dashboard display fake green checks, fabricated hashes, or simulated wallet balances.
