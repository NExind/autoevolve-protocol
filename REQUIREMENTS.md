# Requirements

## MVP acceptance criteria

- A V1→Critique→V2→Critique→V3 policy loop produces a quantitative score and changelog.
- The evaluator contains ten deterministic safety/quality checks worth ten points each.
- A Circom Groth16 circuit derives both scores from private policy witnesses and constrains strict improvement.
- The proof binds commitments, run ID, agent, rubric, and IPFS CID hash.
- A Base Sepolia registry verifies the generated proof, persists CID metadata, rejects replay, and pays a testnet micro-reward.
- The dashboard shows execution lineage, field-level diffs, proof status, CID/transaction links, and Agent Beta inheritance.
- Agent Beta only receives schema-validated, allowlisted lessons; raw IPFS content is never inserted into a prompt.

## Evidence required for acceptance

- Show the local proof verification result produced from the committed
  V1→V2 and V2→V3 witnesses.
- Show the exact pinned CID and its sanitized snapshot payload.
- Show the Base Sepolia registry and verifier addresses, plus a confirmed
  settlement transaction and emitted event.
- Demonstrate Agent Beta reading the registry pointer and consuming only its
  allowlisted memory fields.

An implementation without those artifacts may be presented as an integrated
prototype, but not as a cryptographically verified or settled result.

## Out of scope until MVP is verified

- Filecoin replication, DAO governance, tokenomics, user authentication, database persistence, arbitrary code repair, and claims about ZK-proving LLM inference.
