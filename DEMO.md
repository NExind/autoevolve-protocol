# Five-minute AutoEvolve demo

This is the default judge narrative. The presenter should use only states that
are backed by [EVIDENCE.md](EVIDENCE.md). Do not improvise a proof, CID, or
transaction.

## 0:00–0:30 — Why this exists

“Self-improving agents typically ask us to trust their own score. AutoEvolve
turns a bounded improvement claim into evidence: one structured policy evolves
from V1 to V2 to V3, the arithmetic score change can be proven privately, and
the safe repair history becomes reusable by another agent.”

Open the dashboard and point out the explicit trust boundary: it proves a score
increase under policy-rubric-v1, not private model reasoning.

## 0:30–1:45 — Agent Alpha repairs a real structured task

1. Run **showcase replay** for the deterministic path. Say it is a replay.
2. Select V1: show score 40/100 and the failed policy checks.
3. Select V2: show field-level diffs and score 70/100.
4. Select V3: show remaining controls, 100/100, and the automated changelog.

If Gemini is configured, run **live Gemini** once before judging and retain the
completed trace. State whether the trace used a model candidate or the explicit
deterministic staged baseline. Never describe a guardrail baseline as raw model
output.

## 1:45–3:00 — Why the improvement is cryptographically meaningful

Show the proof panel and describe the exact private/public split:

- private: the normalized V1 and V2 (or V2 and V3) policy witnesses;
- derived privately: the deterministic rubric score and Poseidon commitments;
- public: score outputs, commitments, run ID, CID hash limbs, agent wallet,
  stage, rubric hash, and metadata binding.

If proof evidence exists, open the local-proof artifact and explain that both
V1-to-V2 and V2-to-V3 passed local Groth16 verification. If it does not exist,
say “the circuit and pipeline are ready, but proof verification has not been
observed in this environment” and move on—do not call it verified.

## 3:00–4:00 — Immutable memory and reward settlement

If a real CID exists, open the Pinata/IPFS link and show that the snapshot has
only synthetic policy facts, diffs, hashes, and allowlisted repair cards. Point
out that secrets, private prompts, and raw chain-of-thought are excluded.

If Base Sepolia receipts exist, open the registry explorer link and show:

1. verifier/adapter/registry deployment;
2. CID-bound V1-to-V2 and V2-to-V3 events;
3. test-ETH micro-reward from escrow.

If either artifact is missing, use its actual prepared or pinned label.

## 4:00–4:40 — Agent Beta learns safely

Use the Agent Beta memory view. Explain the enforced route:

    registry pointer → CID hash match → IPFS fetch → schema/integrity validation → allowlisted card

Show that Beta receives a compact repair strategy rather than raw prompts or
untrusted IPFS content.

## 4:40–5:00 — Winning close

“AutoEvolve does not pretend to prove intelligence. It proves a useful,
repeatable, privacy-respecting self-improvement claim—and lets the next agent
inherit only the verified fix, not the failure.”

## Fallback order

If a live external dependency fails during judging, keep the narrative intact:

1. deterministic replay and evaluator/diffs;
2. source-level proof boundary and locally saved proof evidence, if observed;
3. CID and registry evidence, if observed;
4. no fabricated green state.

Record the final evidence links in EVIDENCE.md before submission.
