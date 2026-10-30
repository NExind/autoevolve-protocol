# Autonomous work board

Claim each item as a GitHub issue using the ID in its title. Do not edit this
file to claim it; issue comments prevent merge conflicts.

| ID      | Priority | Owner           | Depends on                    | Deliverable                                                                                                    |
| ------- | -------- | --------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CORE-01 | P0       | agent-core      | none                          | Validate the guarded V1-to-V2-to-V3 live loop; retain only truthful model/guardrail events and tests.          |
| ZK-01   | P0       | agent-zk        | CORE-01 fixture compatibility | Compile the circuit on x86-64; produce and locally verify V1-to-V2 and V2-to-V3 proofs.                        |
| ZK-02   | P0       | agent-zk        | ZK-01                         | Export the generated verifier; deploy verifier, adapter, registry, and funded escrow to Base Sepolia.          |
| MEM-01  | P0       | agent-memory    | none                          | Strictly parse IPFS snapshots, validate the CID/pointer binding, and expose only allowlisted memory cards.     |
| MEM-02  | P0       | agent-memory    | ZK-02 plus real CID           | Wire CID/proof/transaction evidence into attestation and Agent Beta lookup routes.                             |
| UI-01   | P0       | agent-dashboard | CORE-01, MEM-01               | Show unconfigured/prepared/pinned/local-proof/settled states without fake success; add browser smoke coverage. |
| DEMO-01 | P0       | agent-dashboard | ZK-02, MEM-02, UI-01          | Add a resilient five-minute demo path, explorer/CID links, and capture evidence.                               |
| OPS-01  | P1       | any             | local repo ready              | Create/authenticate GitHub remote, bootstrap labels/templates, enable CI, and protect main if the host allows. |

## Hard cutoffs

- T+8h: if a real proof is not locally verified, preserve the source, fixture,
  and honest proof-pending dashboard state; stop altering the rubric.
- T+14h: if Base Sepolia deployment is not complete, stop adding features and
  focus on proof plus CID plus a repeatable local settlement test.
- T+18h: freeze interfaces and start only defect fixes, deployment, and demo
  rehearsal.
