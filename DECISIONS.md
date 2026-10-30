# Decisions

| ID    | Decision                                                   | Why                                                                                                                                     |
| ----- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Use structured DataDAO policy repair                       | It enables a real deterministic evaluator and meaningful proof in 24 hours.                                                             |
| D-002 | Circom + snarkjs Groth16                                   | Small arithmetic circuit and native Solidity-verifier export fit the requirement; proof compilation runs on the designated x86-64 host. |
| D-003 | Base Sepolia + native test-ETH reward                      | Lowest integration complexity for an EVM testnet settlement.                                                                            |
| D-004 | Pinata public IPFS                                         | Fast CID pinning; snapshots are synthetic and sanitized because public IPFS is not private.                                             |
| D-005 | Gemini generator and critic with a deterministic evaluator | Model roles are separated, but no false claim of independent providers is made.                                                         |
| D-006 | Evidence-state labels                                      | `prepared`, `pinned`, `locally verified`, and `on-chain settled` are distinct states; a later state requires its observed artifact.     |
| D-007 | Output-first Groth16 ABI                                   | Circom main-component outputs precede declared public inputs. All clients and the registry use the documented 13-signal order.          |
