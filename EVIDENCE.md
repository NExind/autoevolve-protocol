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
| Generated verifier deployed on Base Sepolia   | agent-zk        | observed on-chain | `0x779F13CE2479414d18961fD789C02e9866031b50` (tx `0x93d305d1811ff1e8b99e32a8be9771cf997bca2ebc9de7d2e5f5c9fd5809340b`, block 52384780)                                                                                                                          |
| Adapter and registry deployed on Base Sepolia | agent-zk        | observed on-chain | Adapter `0x1152380988ca3e3e079ce37d0015ea8c249f6c98` (tx `0xf5846bd4f08349be84fc9f920e4837986be0c56bd4eee40c10ab9eaa9c7c3eb2`); Registry `0x90b1453d9e0180e44a9d2b49f106a4ca921d7906` (tx `0x56cb356bf29f43f6b900f4e94fbd3b7927ca87d76981125760a88098a8b88fd8`) |
| Registry escrow funded                        | agent-zk        | observed on-chain | Funded 0.0002 ETH (tx `0x64198367401bed1e552acc8315f150866376f525a52edffb5934fac27bedc5fa`, block 52386306)                                                                                                                                                     |
| V1-to-V2 settlement receipt                   | agent-zk        | observed on-chain | tx `0x30e339ef3d3fc185a9980fa248e622f745dc4ff9ae62f4af1ec5fc2d86a5172b` (score 40 -> 70, reward paid 0.0001 ETH to agent `0xDad3D7fe51f2dBeA9EC02c956304840c5d8A2F46`)                                                                                          |
| V2-to-V3 settlement receipt                   | agent-zk        | observed on-chain | tx `0xb0b96713a4475feb9f54a045228292604700a757756d5eb699a531099f757f62` (score 70 -> 100, reward paid 0.0001 ETH, final version 3)                                                                                                                              |
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

- 2026-10-31: Completed live deployment and settlement on Base Sepolia (chain ID 84532):
  - `GeneratedGroth16Verifier.sol` deployed at `0x779F13CE2479414d18961fD789C02e9866031b50` (tx `0x93d305d1811ff1e8b99e32a8be9771cf997bca2ebc9de7d2e5f5c9fd5809340b`, block 52384780).
  - `Groth16VerifierAdapter.sol` deployed at `0x1152380988ca3e3e079ce37d0015ea8c249f6c98` (tx `0xf5846bd4f08349be84fc9f920e4837986be0c56bd4eee40c10ab9eaa9c7c3eb2`, block 52386108).
  - `AutoEvolveRegistry.sol` deployed at `0x90b1453d9e0180e44a9d2b49f106a4ca921d7906` (tx `0x56cb356bf29f43f6b900f4e94fbd3b7927ca87d76981125760a88098a8b88fd8`, block 52386119).
  - Escrow funded with 0.0002 ETH (tx `0x64198367401bed1e552acc8315f150866376f525a52edffb5934fac27bedc5fa`, block 52386306).
  - `startRun` initiated for run `0x1111111111111111111111111111111111111111111111111111111111111111` (tx `0x2242dc72385e7ac188d3a41936471e7f2980ed908dd041fd30b28b612ff00bb1`).
  - V1-to-V2 Groth16 improvement settled on-chain (tx `0x30e339ef3d3fc185a9980fa248e622f745dc4ff9ae62f4af1ec5fc2d86a5172b`, score 40 -> 70, 0.0001 ETH bounty paid to agent).
  - V2-to-V3 Groth16 improvement settled on-chain (tx `0xb0b96713a4475feb9f54a045228292604700a757756d5eb699a531099f757f62`, score 70 -> 100, 0.0001 ETH bounty paid to agent, verified version 3).
  - Final on-chain state: version 3, score 100, memory pointer bound to CID `bafybeigdyrztshowcasecidplaceholder`.

### Agent Beta

_No production registry-to-CID retrieval observed yet._

### Dashboard

- 2026-10-30: Local HTTP smoke check observed HTTP 200 for the homepage,
  deterministic replay score sequence 40 → 70 → 100, prepared attestation
  without Pinata, 503 live-mode failure without Gemini, and unconfigured memory
  lookup without registry settings. This is not proof or settlement evidence.
- 2026-10-31: Automated browser QA and API smoke suite passed with zero errors (`apps/web/test/smoke.mjs`). Observed desktop render (1440x900, 462,481 bytes) and narrow mobile render (375x812, 164,986 bytes) using headless Chrome. Verified honest showcase replay banner, 503 unauthenticated Gemini error handling, prepared local snapshot state with canonical hash, unconfigured registry state, 13-signal public ABI modal, and safe memory retrieval flow without fabricated green states.
- 2026-10-31: Completed DEMO-01 five-minute judge walkthrough integration (`apps/web/components/JudgeDemoGuide.tsx`) with 6-stage presentation narrative, lifted 13-signal Groth16 modal trigger, rehearsed showcase replay sequence, and updated desktop (464,077 bytes) and mobile (165,737 bytes) Chrome browser screenshots.
