import { evaluatePolicy, policyDiff } from "./evaluator";
import type { AgentRun, DataPolicy, TaskDefinition } from "./types";

export const dataDaoPolicyTask: TaskDefinition = {
  id: "health-research-sharing-v1",
  title: "Repair a health-research DataDAO sharing policy",
  publicSummary:
    "Produce a safe, machine-readable policy for sharing synthetic health research data.",
  rubricVersion: "policy-rubric-v1",
};

export const fixturePolicies: Record<"V1" | "V2" | "V3", DataPolicy> = {
  V1: {
    requireConsent: true,
    redactDirectIdentifiers: false,
    researchPurposeOnly: true,
    auditLogging: true,
    blockRestrictedRegions: false,
    requireDualApprovalHighVolume: false,
    minKAnonymity: 2,
    maxExportRows: 12_000,
    retentionDays: 60,
    dailyRequestLimit: 100,
  },
  V2: {
    requireConsent: true,
    redactDirectIdentifiers: true,
    researchPurposeOnly: true,
    auditLogging: true,
    blockRestrictedRegions: true,
    requireDualApprovalHighVolume: false,
    minKAnonymity: 5,
    maxExportRows: 12_000,
    retentionDays: 60,
    dailyRequestLimit: 100,
  },
  V3: {
    requireConsent: true,
    redactDirectIdentifiers: true,
    researchPurposeOnly: true,
    auditLogging: true,
    blockRestrictedRegions: true,
    requireDualApprovalHighVolume: true,
    minKAnonymity: 5,
    maxExportRows: 10_000,
    retentionDays: 30,
    dailyRequestLimit: 100,
  },
};

const fixtureClock = [
  "2026-10-30T16:00:00.000Z",
  "2026-10-30T16:00:03.000Z",
  "2026-10-30T16:00:07.000Z",
];

export function createShowcaseRun(): AgentRun {
  const v1 = fixturePolicies.V1;
  const v2 = fixturePolicies.V2;
  const v3 = fixturePolicies.V3;
  const report1 = evaluatePolicy(v1);
  const report2 = evaluatePolicy(v2);
  const report3 = evaluatePolicy(v3);
  return {
    runId: "showcase-run-2026-10-30",
    mode: "showcase",
    task: dataDaoPolicyTask,
    inheritedLessons: [],
    versions: [
      {
        id: "V1",
        source: "fixture",
        policy: v1,
        evaluation: report1,
        changesFromPrevious: [],
        createdAt: fixtureClock[0],
        displayCommitment: "0x9d40…1a72",
        solutionDocument: `# V1 Draft: Synthetic Health Data Sharing Policy

## Executive Summary
This preliminary release charter outlines baseline access controls for external biomedical researchers accessing synthetic demographic and clinical study cohorts.

### Initial Safeguards
- **Participant Consent**: Mandatory participant consent verification gate before record retrieval.
- **Audit Logging**: Comprehensive query audit logging enabled.
- **Research Gate**: Restricted to validated academic and institutional research queries.

### Known Vulnerabilities & Incomplete Controls
- Direct identifiers (names/MRNs) are not yet systematically redacted.
- k-Anonymity is set to 2, presenting quasi-identifier re-identification risks.
- Export size permits up to 12,000 rows without secondary authorization.
- Data retention is extended to 60 days.`,
      },
      {
        id: "V2",
        source: "fixture",
        policy: v2,
        evaluation: report2,
        changesFromPrevious: policyDiff(v1, v2),
        createdAt: fixtureClock[1],
        displayCommitment: "0x6f18…b425",
        solutionDocument: `# V2 Guarded Revision: Enhanced Privacy & Region Isolation

## Evolution Summary
Addressing critical findings from the Independent Rubric Critique:
- Redacted all direct personal identifiers prior to cohort release.
- Enforced strict regional embargo blocks for sanctioned jurisdictions.
- Raised k-Anonymity threshold to 5 to protect outlier micro-cohorts.

### Updated Policy Parameters
- **k-Anonymity**: 5 (Compliant with privacy floor)
- **PII Redaction**: Strict SHA-256 pseudonymization + field stripping
- **Geographic Gate**: Active region perimeter fencing

### Outstanding Remediations for V3
- Bulk export limit still exceeds 10,000 records.
- 60-day retention requires tightening to 30-day ephemerality.
- Dual approval for large queries remains disabled.`,
      },
      {
        id: "V3",
        source: "fixture",
        policy: v3,
        evaluation: report3,
        changesFromPrevious: policyDiff(v2, v3),
        createdAt: fixtureClock[2],
        displayCommitment: "0xb7a1…5d89",
        solutionDocument: `# V3 Production: Hardened DataDAO Governance Charter

## Final Verification & Deployment State
All 10 deterministic security controls have been fulfilled (100/100 Rubric Score). Ready for cryptographic witness generation and Base Sepolia settlement.

### Implemented Controls Matrix
1. **Consent Gate**: Mandatory cryptographic verification (Active)
2. **Direct Identifier Redaction**: Automated field stripping & salting (Active)
3. **Research-Only Enforcement**: Institutional credential gating (Active)
4. **Audit Logging**: Tamper-evident append-only ledger (Active)
5. **Region Embargo**: Multi-layer geo-IP & DNS blocking (Active)
6. **Dual Approval**: High-volume queries require 2-of-3 steward multi-sig (Active)
7. **k-Anonymity Floor**: Min threshold 5 enforced at SQL parser (Active)
8. **Export Limit**: Hard capped at 10,000 rows per query (Active)
9. **Retention Window**: Strictly capped at 30 days (Active)
10. **Daily Quota**: 100 requests / day rate-limited per API key (Active)`,
      },
    ],
    critiques: [
      {
        fromVersion: "V1",
        summary:
          "V1 permits direct identifiers, unbounded region access, and weak anonymity.",
        failureCodes: report1.failureCodes,
        repairPlan: report1.safePatchStrategies.slice(0, 3),
        author: "fixture-critic",
      },
      {
        fromVersion: "V2",
        summary:
          "V2 fixed identity and regional controls; high-volume export controls still need tightening.",
        failureCodes: report2.failureCodes,
        repairPlan: report2.safePatchStrategies,
        author: "fixture-critic",
      },
    ],
    events: [
      {
        at: fixtureClock[0],
        stage: "generated",
        version: "V1",
        message: "Generator produced an initial policy candidate.",
      },
      {
        at: fixtureClock[0],
        stage: "evaluated",
        version: "V1",
        message: "Deterministic evaluator recorded 40/100.",
      },
      {
        at: "2026-10-30T16:00:01.000Z",
        stage: "critiqued",
        version: "V1",
        message: "Critic translated failed checks into repair actions.",
      },
      {
        at: fixtureClock[1],
        stage: "revised",
        version: "V2",
        message:
          "Guarded revision preserved a strict score increase to 70/100.",
      },
      {
        at: "2026-10-30T16:00:04.000Z",
        stage: "critiqued",
        version: "V2",
        message: "Critic isolated remaining high-volume and retention risks.",
      },
      {
        at: fixtureClock[2],
        stage: "revised",
        version: "V3",
        message: "Guarded revision reached all ten rubric requirements.",
      },
    ],
    proofBoundary:
      "This replay demonstrates deterministic evaluator evidence. It is not a claim that a ZK proof or Base Sepolia transaction has been executed in this local session.",
  };
}
