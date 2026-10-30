# API Contract

## `POST /api/runs`

Request:

    { "mode": "showcase" | "live", "inheritance": ["optional failure code"] }

Response:

    {
      "mode": "showcase" | "live",
      "run": { "runId": "...", "versions": [], "critiques": [], "events": [] },
      "warning": "optional truthful fallback explanation"
    }

`showcase` is deterministic and visibly labelled. `live` requires
`GEMINI_API_KEY`; it never silently falls back to a fabricated live result.

## `POST /api/attest`

Request contains a validated completed run.

Current response states:

| State      | Meaning                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `prepared` | The snapshot passed the schema/sanitization path, but no Pinata credential is configured. It has no CID, proof, or transaction. |
| `pinned`   | Pinata returned the reported CID. This is a real storage result, but it is not proof-verified or settled on-chain.              |
| error      | The request, snapshot construction, or pin request failed.                                                                      |

The local proof-host and deployment workflow must add observed proof and
transaction evidence before a UI or API may call an attestation `verified`.

## Groth16 public-signal ABI

Circom serializes main-component outputs **before** explicitly declared public
inputs. The generated verifier, `packages/chain` client, and registry therefore
use this immutable 13-element order:

| Index | Signal                             |
| ----- | ---------------------------------- |
| 0     | `previousScore` (circuit output)   |
| 1     | `nextScore` (circuit output)       |
| 2     | `binding` (circuit output)         |
| 3     | `previousPolicyCommitment`         |
| 4     | `nextPolicyCommitment`             |
| 5–6   | `runIdLow` / `runIdHigh`           |
| 7–8   | `cidHashLow` / `cidHashHigh`       |
| 9     | `agent` as `uint160`               |
| 10    | `stage`                            |
| 11–12 | `rubricHashLow` / `rubricHashHigh` |

No agent may reorder these fields without simultaneously changing the circuit,
generated verifier, registry, SDK, test vectors, and this contract.

## `GET /api/memory/search?taskHash=0x...`

When `NEXT_PUBLIC_REGISTRY_ADDRESS` points to a deployed registry, this returns
only schema-validated, allowlisted `MemoryCard` values from its verified
on-chain CIDs. Without a deployed address it returns a configuration state.
Raw IPFS JSON stays server-side.
