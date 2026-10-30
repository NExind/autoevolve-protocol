# Project Context

## Challenge

Build AutoEvolve Protocol: a self-improving agent that performs V1→V2→V3,
cryptographically attests improvement, stores immutable execution memory on
decentralized storage, records it on an EVM testnet, and lets a second agent
reuse the verified failure history.

## Product wedge

The demo agent repairs a synthetic health-research DataDAO sharing policy. The
task is intentionally structured so the evaluator is deterministic and the ZK
claim is meaningful rather than subjective.

## Non-negotiable honesty boundary

AutoEvolve proves a score increase under `policy-rubric-v1`. It does not claim
to prove LLM intelligence, hidden chain-of-thought, or private prompt content.

## Target deployment stack

These are intended deployment targets, not evidence that credentials, proofs, or
contracts have already been provisioned.

- Model: Gemini API with temperature `0`, JSON output, server-side key only.
- Storage: Pinata public IPFS with a sanitized CIDv1 snapshot.
- Chain: Base Sepolia, chain ID `84532`.
- Proof: Circom 2 / snarkjs Groth16.

## Evidence boundary

An implementation is only considered verified after the team has retained the
actual artifact for that step: a Pinata CID for storage, a successful local
Groth16 verification for the proof, and a confirmed Base Sepolia transaction
for settlement. Until then, the dashboard and documentation must use
`prepared` or `pinned`, never `verified`.
