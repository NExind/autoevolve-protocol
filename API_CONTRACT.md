# AutoEvolve Protocol — API Contract & Data Specifications

This document defines the authoritative HTTP interface, JSON schemas, cryptographic signal orders, and trust boundaries implemented across the AutoEvolve Protocol.

---

## 1. Execution Engine API: `POST /api/runs`

Triggers the autonomous self-improvement evolution loop ($V1 \rightarrow V2 \rightarrow V3$).

### Request Payload

```json
{
  "mode": "showcase" | "live",
  "userPrompt": "Optional custom scenario guidance (string, max 500 chars)"
}
```

- **`mode`**:
  - `"showcase"`: Zero-dependency local deterministic replay using verified fixtures. Requires no API keys.
  - `"live"`: Executes real multi-model inference. Requires `FEATHERLESS_API_KEY` (Qwen-2.5-Coder) or `GEMINI_API_KEY` (Gemini-2.0-Flash). If neither is configured, returns honest HTTP 503 rather than faking execution.
- **`userPrompt`**:
  - Optional custom user scenario (e.g. _"Design a comprehensive roadmap for learning cybersecurity"_ or _"Develop a distributed message broker in Go"_).
  - Sanitized server-side (control characters stripped, length capped at 500 characters). Untrusted browser injection of internal memory or evaluation signals is strictly rejected with HTTP 400.

### Response Payload

```json
{
  "mode": "showcase" | "live",
  "provider": "featherless" | "gemini",
  "memoryNotice": "Retrieved 9 verified lesson(s) from on-chain CID bafkrei...",
  "warning": "This is a deterministic local showcase replay. No proof, CID, or on-chain transaction is claimed.",
  "run": {
    "runId": "run-a1b2c3d4e5f6",
    "mode": "live",
    "task": {
      "id": "custom-task-0x1a2b...",
      "title": "Comprehensive Roadmap for Learning Cybersecurity",
      "publicSummary": "Design a comprehensive roadmap for learning cybersecurity",
      "rubricVersion": "policy-rubric-v1"
    },
    "userPrompt": "Design a comprehensive roadmap for learning cybersecurity",
    "versions": [
      {
        "id": "V1",
        "source": "generator" | "fixture",
        "policy": {
          "requireConsent": true,
          "redactDirectIdentifiers": false,
          "researchPurposeOnly": true,
          "auditLogging": true,
          "blockRestrictedRegions": false,
          "requireDualApprovalHighVolume": false,
          "minKAnonymity": 2,
          "maxExportRows": 12000,
          "retentionDays": 60,
          "dailyRequestLimit": 100
        },
        "evaluation": {
          "score": 40,
          "passedChecks": ["requireConsent", "researchPurposeOnly", "auditLogging", "dailyRequestLimit"],
          "failureCodes": ["PII_EXPOSURE", "MISSING_REGION_BLOCK", "MISSING_DUAL_APPROVAL", "K_ANONYMITY_TOO_LOW", "EXPORT_LIMIT_TOO_HIGH", "RETENTION_TOO_LONG"]
        },
        "changesFromPrevious": [],
        "createdAt": "2026-10-31T08:00:00.000Z",
        "solutionDocument": "# V1 Baseline Draft: Comprehensive Roadmap for Learning Cybersecurity\n\n## Executive Overview\n..."
      },
      {
        "id": "V2",
        "source": "guarded-revision",
        "policy": { "...": "..." },
        "evaluation": { "score": 70, "...": "..." },
        "changesFromPrevious": [{ "field": "redactDirectIdentifiers", "from": false, "to": true }],
        "createdAt": "2026-10-31T08:00:03.000Z",
        "solutionDocument": "# V2 Guarded Revision: Comprehensive Roadmap for Learning Cybersecurity\n\n## Revision Summary\n..."
      },
      {
        "id": "V3",
        "source": "guarded-revision",
        "policy": { "...": "..." },
        "evaluation": { "score": 100, "...": "..." },
        "changesFromPrevious": [{ "field": "requireDualApprovalHighVolume", "from": false, "to": true }],
        "createdAt": "2026-10-31T08:00:07.000Z",
        "solutionDocument": "# V3 Production-Ready Solution: Comprehensive Roadmap for Learning Cybersecurity\n\n## Final Architecture\n..."
      }
    ],
    "critiques": [
      {
        "fromVersion": "V1",
        "summary": "The baseline draft provides good theoretical coverage of Linux and networking, but lacks active defense, SIEM telemetry, and practical exploitation labs.",
        "failureCodes": ["PII_EXPOSURE", "MISSING_REGION_BLOCK", "..."],
        "repairPlan": ["Deploy Splunk/ELK log correlation", "Add OWASP Top 10 hands-on labs with Burp Suite"],
        "author": "featherless-critic" | "gemini-critic" | "deterministic-critic"
      }
    ],
    "events": [
      { "at": "2026-10-31T08:00:00.000Z", "stage": "generated", "version": "V1", "message": "..." }
    ],
    "inheritedLessons": [
      { "failureCode": "PII_EXPOSURE", "safePatchStrategy": "redact direct identifiers immediately" }
    ],
    "proofBoundary": "Live agent output is evaluated by a deterministic rubric. If an initial model candidate cannot support two strict improvement stages, the run explicitly substitutes a deterministic staged baseline. A later attestation can prove rubric score increases for the selected policies; it does not prove model reasoning."
  }
}
```

---

## 2. Memory Attestation API: `POST /api/attest`

Builds, sanitizes, and optionally pins execution snapshots to IPFS.

### Request Payload

```json
{
  "run": "{ ... validated AgentRun object ... }"
}
```

### Response States

| State              | HTTP    | Meaning                                                                                                                       |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `prepared`         | 200     | Snapshot sanitized into canonical `SnapshotCore` JSON format. Raw prompts and credentials redacted. No Pinata JWT configured. |
| `pinned`           | 200     | Snapshot pinned to decentralized IPFS via Pinata. Real IPFS CID returned.                                                     |
| `locally verified` | 200     | Witness generated and Groth16 proof locally verified on x86-64 host against `verification_key.json`.                          |
| `on-chain settled` | 200     | Groth16 proof verified on Base Sepolia EVM, reward bounty released, and CID pointer registered.                               |
| `error`            | 400/500 | Validation failed or network transport error.                                                                                 |

---

## 3. Decentralized Memory Search API: `GET /api/memory/search`

Enables cross-agent collective memory retrieval for Agent Beta.

### Query Parameters

- `taskHash`: `0x...` (32-byte Keccak-256 hash of the target task ID).

### Security Boundary

1. Queries on-chain pointer from `AutoEvolveRegistry.sol`.
2. Verifies CID integrity: `keccak256(bytes(cid)) == pointer.cidHash`.
3. Fetches `SnapshotCore` from IPFS gateway.
4. Validates schema and strips all potential prompt injection or unstructured strings.
5. Emits strictly typed, allowlisted `MemoryCard` records (`failureCode`, `safePatchStrategy`) to Agent Beta.

---

## 4. Circom Groth16 13-Signal Public ABI

Circom serializes main-component public outputs **before** declared public inputs. To ensure exact compatibility between `AutoEvolveImprovement.circom`, `GeneratedGroth16Verifier.sol`, and `AutoEvolveRegistry.sol`, the immutable signal order is:

| Signal Index | Signal Identifier          | Signal Class | Meaning                                                              |
| ------------ | -------------------------- | ------------ | -------------------------------------------------------------------- |
| **0**        | `previousScore`            | Output       | Evaluator score of Version $N$ (0–100)                               |
| **1**        | `nextScore`                | Output       | Evaluator score of Version $N+1$ (0–100, strictly $> previousScore$) |
| **2**        | `binding`                  | Output       | Bitwise commitment binding verify signal                             |
| **3**        | `previousPolicyCommitment` | Public Input | Poseidon hash of private policy $N$                                  |
| **4**        | `nextPolicyCommitment`     | Public Input | Poseidon hash of private policy $N+1$                                |
| **5**        | `runIdLow`                 | Public Input | Lower 128 bits of 256-bit `runId`                                    |
| **6**        | `runIdHigh`                | Public Input | Upper 128 bits of 256-bit `runId`                                    |
| **7**        | `cidHashLow`               | Public Input | Lower 128 bits of `keccak256(bytes(cid))`                            |
| **8**        | `cidHashHigh`              | Public Input | Upper 128 bits of `keccak256(bytes(cid))`                            |
| **9**        | `agent`                    | Public Input | Agent Ethereum address (`uint160`)                                   |
| **10**       | `stage`                    | Public Input | Improvement stage (1 = V1 $\rightarrow$ V2, 2 = V2 $\rightarrow$ V3) |
| **11**       | `rubricHashLow`            | Public Input | Lower 128 bits of rubric identifier hash                             |
| **12**       | `rubricHashHigh`           | Public Input | Upper 128 bits of rubric identifier hash                             |
