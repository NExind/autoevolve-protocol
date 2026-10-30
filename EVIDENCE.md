# Verification evidence ledger

This is an append-only, non-secret ledger. It is the source of truth for words
such as pinned, locally verified, and on-chain settled. An empty value means
the action has **not** been observed; it is not a task for a model to invent.

| Evidence gate                                 | Owner           | Status           | Observed artifact                                                                                                 |
| --------------------------------------------- | --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sanitized memory snapshot                     | agent-memory    | not observed     | —                                                                                                                 |
| Pinata public CID                             | agent-memory    | not observed     | —                                                                                                                 |
| V1-to-V2 local Groth16 verification           | agent-zk        | observed locally | `circuits/proofs/v1-v2/settlement.json` (verified score 40 -> 70, 13 output-first signals)                        |
| V2-to-V3 local Groth16 verification           | agent-zk        | observed locally | `circuits/proofs/v2-v3/settlement.json` (verified score 70 -> 100, 13 output-first signals)                       |
| Generated verifier deployed on Base Sepolia   | agent-zk        | not observed     | —                                                                                                                 |
| Adapter and registry deployed on Base Sepolia | agent-zk        | not observed     | —                                                                                                                 |
| Registry escrow funded                        | agent-zk        | not observed     | —                                                                                                                 |
| V1-to-V2 settlement receipt                   | agent-zk        | not observed     | —                                                                                                                 |
| V2-to-V3 settlement receipt                   | agent-zk        | not observed     | —                                                                                                                 |
| Agent Beta reads a CID/hash-validated card    | agent-memory    | not observed     | —                                                                                                                 |
| Dashboard HTTP smoke test                     | agent-dashboard | observed locally | Desktop (1440x900) & mobile (375x812) browser smoke tests passed on 2026-10-31; real Chrome screenshots captured. |

## How to add evidence

Add one dated bullet under the relevant heading below, preserving the table
state. Include public artifact links or hashes only—never a private key, JWT,
proving key, witness, raw private prompt, or unredacted user data.

### Memory

_No real CID observed yet._

### Proofs

- 2026-10-31: Circuit `AutoEvolveImprovement.circom` compiled to R1CS with 6,448 constraints, 6,441 wires, and 311 template instances. Groth16 setup completed using verified Powers of Tau 13 (SHA-256 `95751b5207f20aa822f01109902315c01c15250303feacea2b8aa7dc9fdfeefd`). V1-to-V2 (score 40 -> 70) and V2-to-V3 (score 70 -> 100) Groth16 proofs generated and locally verified via `snarkjs groth16.verify` against exported `verification_key.json`.
- 2026-10-31: On-chain verification validated in local Ganache EVM integration test: `GeneratedGroth16Verifier.sol` and `Groth16VerifierAdapter.sol` deployed, executing EVM pairing precompile checks and verifying both V1-to-V2 and V2-to-V3 proofs with `verifyProof(...) == true`.

### Base Sepolia

_No Base Sepolia deployment or settlement observed yet._

### Agent Beta

_No production registry-to-CID retrieval observed yet._

### Dashboard

- 2026-10-30: Local HTTP smoke check observed HTTP 200 for the homepage,
  deterministic replay score sequence 40 → 70 → 100, prepared attestation
  without Pinata, 503 live-mode failure without Gemini, and unconfigured memory
  lookup without registry settings. This is not proof or settlement evidence.
- 2026-10-31: Automated browser QA and API smoke suite passed with zero errors (`apps/web/test/smoke.mjs`). Observed desktop render (1440x900, 462,481 bytes) and narrow mobile render (375x812, 164,986 bytes) using headless Chrome. Verified honest showcase replay banner, 503 unauthenticated Gemini error handling, prepared local snapshot state with canonical hash, unconfigured registry state, 13-signal public ABI modal, and safe memory retrieval flow without fabricated green states.
