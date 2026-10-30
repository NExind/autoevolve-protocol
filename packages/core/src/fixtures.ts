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
      },
      {
        id: "V2",
        source: "fixture",
        policy: v2,
        evaluation: report2,
        changesFromPrevious: policyDiff(v1, v2),
        createdAt: fixtureClock[1],
        displayCommitment: "0x6f18…b425",
      },
      {
        id: "V3",
        source: "fixture",
        policy: v3,
        evaluation: report3,
        changesFromPrevious: policyDiff(v2, v3),
        createdAt: fixtureClock[2],
        displayCommitment: "0xb7a1…5d89",
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
        message: "Guarded revision preserved a strict score increase to 70/100.",
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
