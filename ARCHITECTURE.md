# Architecture

    Next.js dashboard
      ├── /api/runs ── Gemini generator + critic ── @autoevolve/core evaluator
      ├── /api/attest ── sanitized SnapshotCore ── Pinata/IPFS CID
      │                         └─ proof host ── Base Sepolia Registry
      └── /api/memory/search ── registry CID ── validate ── allowlisted memory card

## Intended attestation data flow

1. `core` validates a `DataPolicy`, calculates the ten rule results, and emits
   a versioned score and semantic diff.
2. The run route makes bounded model calls. The evaluator, not the critic, is
   authoritative.
3. The attestation route serializes and redacts a canonical `SnapshotCore` and,
   when `PINATA_JWT` is configured, pins it. A proof-host workflow then binds
   the real CID into the witness and emits a Groth16 proof.
4. The deployed contract checks the proof signals against stored run state,
   invokes the Groth16 verifier, stores the new CID, emits an event, and
   transfers the testnet reward.
5. Beta retrieves the on-chain CID and only uses verified `failureCodes` and
   `safePatchStrategies`.

No secret, raw system prompt, private key, or sensitive user content may be
added to the snapshot, circuit inputs exposed publicly, browser bundle, or Git.

## Current implementation boundary

The dashboard can run a labelled deterministic replay and the server can
prepare a sanitized snapshot. A configured Pinata route can return a real CID.
Proof generation requires the x86-64 proof host, and on-chain verification
requires a deployed verifier/registry plus funded Base Sepolia accounts. Those
steps are deliberately externalized rather than represented as a simulated
success in the UI.
