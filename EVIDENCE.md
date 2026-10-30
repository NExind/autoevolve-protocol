# Verification evidence ledger

This is an append-only, non-secret ledger. It is the source of truth for words
such as pinned, locally verified, and on-chain settled. An empty value means
the action has **not** been observed; it is not a task for a model to invent.

| Evidence gate                                 | Owner           | Status            | Observed artifact                                                                                                                                                                                                                                               |
| --------------------------------------------- | --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sanitized memory snapshot                     | agent-memory    | observed locally  | Canonical SnapshotCore schema validated across 29 test vectors with strict score progression and payload sha256 hash.                                                                                                                                           |
| Pinata public CID                             | agent-memory    | observed          | `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm` (showcase snapshot hash `0x8964650c295a1df37ee403ba597e8303c433621aeb959ea41db69d3da517b435`)                                                                                                     |
| V1-to-V2 local Groth16 verification           | agent-zk        | observed locally  | `circuits/proofs/v1-v2/settlement.json` (verified score 40 -> 70, 13 output-first signals)                                                                                                                                                                      |
| V2-to-V3 local Groth16 verification           | agent-zk        | observed locally  | `circuits/proofs/v2-v3/settlement.json` (verified score 70 -> 100, 13 output-first signals)                                                                                                                                                                     |
| Generated verifier deployed on Base Sepolia   | agent-zk        | observed on-chain | `0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764` (tx `0x551a2b2473297543b0c074f63b89935e9bcf13a2b598abfb5018183903679f04`, block 52390805)                                                                                                                          |
| Adapter and registry deployed on Base Sepolia | agent-zk        | observed on-chain | Adapter `0xd46ee3e820d12e113af3e6ad7b6867e18d560c37` (tx `0xb926b4488a4af0e28cb76357f65a22b32ff02b339ed95c9a12a8682bf4dcac4e`); Registry `0x24473c0043b13d56874d10de9675728e2014a66c` (tx `0xa0cab315ce3f34df0e7780a714a3a35800927537269eaf9da5a731ccc2823e16`) |
| Registry escrow funded                        | agent-zk        | observed on-chain | Funded 0.0002 ETH (tx `0xe97cfe3d76aaf64118d8c8e83b79c51086557442a0313442f7b2be7786bfc78c`, block 52391195; re-funded 0.0002 ETH tx `0xa8ecd87a6e92ca8c69dc3ffcdaf4313b37ae7d63f808668f3d5b9635e35447af`, block 52402130)                                       |
| V1-to-V2 settlement receipt                   | agent-zk        | observed on-chain | tx `0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f` (score 40 -> 70, reward paid 0.0001 ETH to agent `0xDad3D7fe51f2dBeA9EC02c956304840c5d8A2F46`, bound to CID `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm`)              |
| V2-to-V3 settlement receipt                   | agent-zk        | observed on-chain | tx `0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f` (score 70 -> 100, reward paid 0.0001 ETH to agent `0xDad3D7fe51f2dBeA9EC02c956304840c5d8A2F46`, final version 3)                                                                        |
| Agent Beta reads a CID/hash-validated card    | agent-memory    | not observed      | —                                                                                                                                                                                                                                                               |
| Dashboard HTTP smoke test                     | agent-dashboard | observed locally  | Desktop (1440x900) & mobile (375x812) browser smoke tests passed on 2026-10-31; real Chrome screenshots captured.                                                                                                                                               |

## How to add evidence

Add one dated bullet under the relevant heading below, preserving the table
state. Include public artifact links or hashes only—never a private key, JWT,
proving key, witness, raw private prompt, or unredacted user data.

### Memory

- 2026-10-31: Local sanitized SnapshotCore schema validation observed passing across 29 test vectors; strict redaction of credentials/prompts/chains-of-thought/user data, 512KB payload limits, CID hash binding, and allowlisted MemoryCard extraction enforced. No production Pinata CID or Base Sepolia settlement observed yet.
- 2026-10-31: Implemented and validated Groth16 settlement artifact parsing (`parseSettlementArtifact`), public signal binding verification (`validateSettlementBinding`), and Base Sepolia settlement receipts verification (`parseSettlementReceipts`) across 34 unit tests. Wired 5-state attestation lifecycle (`unconfigured`, `prepared`, `pinned`, `locally verified`, `on-chain settled`) in `/api/attest`. Validated that without live testnet deployment receipts or live Pinata CID, memory retrieval and attestation truthfully fail-closed to prepared/locally verified and never claim on-chain settlement.
- 2026-10-31: Validated the complete real-evidence retrieval pipeline from verified registry pointer (binding runId and `keccak256(bytes(cid))`) through IPFS gateway fetching, runtime schema/secret validation, and allowlisted `InheritedLesson` extraction across 48 unit tests. Confirmed strict rejection of CID/pointer mismatches, score/version mismatches, wallet mismatches, malformed JSON, and secret injections. Confirmed truthful fail-closed behavior when configuration is absent or unconfigured.
- 2026-10-31: Pinned real sanitized showcase snapshot (`showcase-run-2026-10-30`, scores 40 -> 70 -> 100) to Pinata. Observed public CID `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm`. Verified public gateway retrieval at `https://gateway.pinata.cloud/ipfs/bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm` returning HTTP 200, matching canonical payload SHA-256 hash `0x8964650c295a1df37ee403ba597e8303c433621aeb959ea41db69d3da517b435`, and confirming zero secrets, private prompts, or hidden reasoning uploaded.

### Proofs

- 2026-10-31: Circuit `AutoEvolveImprovement.circom` compiled to R1CS with 6,448 constraints, 6,441 wires, and 311 template instances. Groth16 setup completed using verified Powers of Tau 13 (SHA-256 `95751b5207f20aa822f01109902315c01c15250303feacea2b8aa7dc9fdfeefd`). V1-to-V2 (score 40 -> 70) and V2-to-V3 (score 70 -> 100) Groth16 proofs generated and locally verified via `snarkjs groth16.verify` against exported `verification_key.json`.
- 2026-10-31: On-chain verification validated in local Ganache EVM integration test: `GeneratedGroth16Verifier.sol` and `Groth16VerifierAdapter.sol` deployed, executing EVM pairing precompile checks and verifying both V1-to-V2 and V2-to-V3 proofs with `verifyProof(...) == true`.

### Base Sepolia

- 2026-10-31: Completed live deployment and escrow funding on Base Sepolia (chain ID 84532):
  - `GeneratedGroth16Verifier.sol` deployed at `0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764` (tx `0x551a2b2473297543b0c074f63b89935e9bcf13a2b598abfb5018183903679f04`, block 52390805).
  - `Groth16VerifierAdapter.sol` deployed at `0xd46ee3e820d12e113af3e6ad7b6867e18d560c37` (tx `0xb926b4488a4af0e28cb76357f65a22b32ff02b339ed95c9a12a8682bf4dcac4e`, block 52390966).
  - `AutoEvolveRegistry.sol` deployed at `0x24473c0043b13d56874d10de9675728e2014a66c` (tx `0xa0cab315ce3f34df0e7780a714a3a35800927537269eaf9da5a731ccc2823e16`, block 52390987).
  - Escrow funded with 0.0002 ETH (tx `0xe97cfe3d76aaf64118d8c8e83b79c51086557442a0313442f7b2be7786bfc78c`, block 52391195).
- 2026-10-31: Final Groth16 on-chain settlement completed on Base Sepolia (chain ID 84532) bound to real Pinata IPFS CID `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm`:
  - Escrow re-funded with 0.0002 ETH (tx `0xa8ecd87a6e92ca8c69dc3ffcdaf4313b37ae7d63f808668f3d5b9635e35447af`, block 52402130).
  - `startRun` initiated for run `showcase-run-2026-10-30` (runId `0xbe497a148266677801056567eb073cf22abbbba3e6067cef9bb8472ac2282d99`, task `health-research-sharing-v1`, tx `0xa72040f03d56dd6e62a93da84a1ef1f78696fd267b067e1bd21d57fc794aca45`, block 52402447).
  - V1-to-V2 Groth16 improvement settled on-chain (tx `0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f`, block 52402461, score 40 -> 70, 0.0001 ETH bounty paid to agent `0xDad3D7fe51f2dBeA9EC02c956304840c5d8A2F46`).
  - V2-to-V3 Groth16 improvement settled on-chain (tx `0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f`, block 52402476, score 70 -> 100, 0.0001 ETH bounty paid to agent, verified version 3).
  - Final confirmed on-chain state: version 3, score 100, memory pointer bound to real CID `bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm`, taskHash `0xee47106d1510135e97c62f99e8ca2e018320588c9da88917a11d55bbeff49890`.

### Agent Beta

_No production registry-to-CID retrieval observed yet._

### Dashboard

- 2026-10-30: Local HTTP smoke check observed HTTP 200 for the homepage,
  deterministic replay score sequence 40 → 70 → 100, prepared attestation
  without Pinata, 503 live-mode failure without Gemini, and unconfigured memory
  lookup without registry settings. This is not proof or settlement evidence.
- 2026-10-31: Automated browser QA and API smoke suite passed with zero errors (`apps/web/test/smoke.mjs`). Observed desktop render (1440x900, 462,481 bytes) and narrow mobile render (375x812, 164,986 bytes) using headless Chrome. Verified honest showcase replay banner, 503 unauthenticated Gemini error handling, prepared local snapshot state with canonical hash, unconfigured registry state, 13-signal public ABI modal, and safe memory retrieval flow without fabricated green states.
- 2026-10-31: Completed DEMO-01 five-minute judge walkthrough integration (`apps/web/components/JudgeDemoGuide.tsx`) with 6-stage presentation narrative, lifted 13-signal Groth16 modal trigger, rehearsed showcase replay sequence, and updated desktop (464,077 bytes) and mobile (165,737 bytes) Chrome browser screenshots.
