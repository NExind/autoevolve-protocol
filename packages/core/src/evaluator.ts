import type {
  DataPolicy,
  EvaluationReport,
  FailureCode,
  PolicyChange,
  PolicyField,
  RuleResult,
} from "./types";
import { policyFieldOrder } from "./types";

const ruleDefinitions: Array<{
  id: string;
  label: string;
  failureCode: FailureCode;
  passes: (policy: DataPolicy) => boolean;
  passedDetail: string;
  failedDetail: string;
  patch: string;
}> = [
  {
    id: "consent",
    label: "Consent gate",
    failureCode: "MISSING_CONSENT_GATE",
    passes: (policy) => policy.requireConsent,
    passedDetail: "Explicit consent is required before release.",
    failedDetail: "The policy can release records without consent.",
    patch: "Set requireConsent to true.",
  },
  {
    id: "pii",
    label: "Direct identifier redaction",
    failureCode: "PII_EXPOSURE",
    passes: (policy) => policy.redactDirectIdentifiers,
    passedDetail: "Direct identifiers are redacted.",
    failedDetail: "Direct identifiers could be exported.",
    patch: "Set redactDirectIdentifiers to true.",
  },
  {
    id: "purpose",
    label: "Research-purpose restriction",
    failureCode: "NON_RESEARCH_PURPOSE",
    passes: (policy) => policy.researchPurposeOnly,
    passedDetail: "Data use is restricted to research.",
    failedDetail: "The policy permits non-research use.",
    patch: "Set researchPurposeOnly to true.",
  },
  {
    id: "audit",
    label: "Audit logging",
    failureCode: "MISSING_AUDIT_LOG",
    passes: (policy) => policy.auditLogging,
    passedDetail: "Every export is audit logged.",
    failedDetail: "There is no immutable audit-log requirement.",
    patch: "Set auditLogging to true.",
  },
  {
    id: "region",
    label: "Restricted-region block",
    failureCode: "MISSING_REGION_BLOCK",
    passes: (policy) => policy.blockRestrictedRegions,
    passedDetail: "Restricted regions are blocked.",
    failedDetail: "Restricted regions are not blocked.",
    patch: "Set blockRestrictedRegions to true.",
  },
  {
    id: "dual-approval",
    label: "Dual approval for high-volume exports",
    failureCode: "MISSING_DUAL_APPROVAL",
    passes: (policy) => policy.requireDualApprovalHighVolume,
    passedDetail: "High-volume exports require dual approval.",
    failedDetail: "High-volume exports lack dual approval.",
    patch: "Set requireDualApprovalHighVolume to true.",
  },
  {
    id: "k-anonymity",
    label: "k-anonymity floor",
    failureCode: "K_ANONYMITY_TOO_LOW",
    passes: (policy) => policy.minKAnonymity >= 5,
    passedDetail: "k-anonymity is at least 5.",
    failedDetail: "k-anonymity is below the required threshold of 5.",
    patch: "Set minKAnonymity to at least 5.",
  },
  {
    id: "export-size",
    label: "Maximum export size",
    failureCode: "EXPORT_LIMIT_TOO_HIGH",
    passes: (policy) => policy.maxExportRows <= 10_000,
    passedDetail: "Exports are capped at 10,000 records or fewer.",
    failedDetail: "Exports can exceed 10,000 records.",
    patch: "Set maxExportRows to 10000 or lower.",
  },
  {
    id: "retention",
    label: "Retention window",
    failureCode: "RETENTION_TOO_LONG",
    passes: (policy) => policy.retentionDays <= 30,
    passedDetail: "Retention is capped at 30 days.",
    failedDetail: "Retention exceeds the 30-day limit.",
    patch: "Set retentionDays to 30 or lower.",
  },
  {
    id: "rate-limit",
    label: "Daily request limit",
    failureCode: "RATE_LIMIT_TOO_HIGH",
    passes: (policy) => policy.dailyRequestLimit <= 100,
    passedDetail: "Daily requests are capped at 100.",
    failedDetail: "Daily requests exceed 100.",
    patch: "Set dailyRequestLimit to 100 or lower.",
  },
];

export function evaluatePolicy(policy: DataPolicy): EvaluationReport {
  const checks: RuleResult[] = ruleDefinitions.map((rule) => {
    const passed = rule.passes(policy);
    return {
      id: rule.id,
      label: rule.label,
      passed,
      points: 10,
      detail: passed ? rule.passedDetail : rule.failedDetail,
      ...(passed ? {} : { failureCode: rule.failureCode }),
    };
  });

  const failureCodes = checks.flatMap((check) =>
    check.failureCode ? [check.failureCode] : [],
  );

  return {
    evaluatorVersion: "policy-rubric-v1",
    score: checks.filter((check) => check.passed).length * 10,
    maxScore: 100,
    checks,
    failureCodes,
    safePatchStrategies: ruleDefinitions
      .filter((rule) => failureCodes.includes(rule.failureCode))
      .map((rule) => rule.patch),
  };
}

export function isStrictImprovement(
  previous: EvaluationReport,
  next: EvaluationReport,
): boolean {
  return next.score > previous.score;
}

const correctionByFailure: Record<FailureCode, Partial<DataPolicy>> = {
  MISSING_CONSENT_GATE: { requireConsent: true },
  PII_EXPOSURE: { redactDirectIdentifiers: true },
  NON_RESEARCH_PURPOSE: { researchPurposeOnly: true },
  MISSING_AUDIT_LOG: { auditLogging: true },
  MISSING_REGION_BLOCK: { blockRestrictedRegions: true },
  MISSING_DUAL_APPROVAL: { requireDualApprovalHighVolume: true },
  K_ANONYMITY_TOO_LOW: { minKAnonymity: 5 },
  EXPORT_LIMIT_TOO_HIGH: { maxExportRows: 10_000 },
  RETENTION_TOO_LONG: { retentionDays: 30 },
  RATE_LIMIT_TOO_HIGH: { dailyRequestLimit: 100 },
};

export function applyGuardedImprovements(
  policy: DataPolicy,
  report: EvaluationReport,
  maximumChanges = Number.POSITIVE_INFINITY,
): DataPolicy {
  const next = { ...policy };
  for (const failureCode of report.failureCodes.slice(0, maximumChanges)) {
    Object.assign(next, correctionByFailure[failureCode]);
  }
  return next;
}

const fieldLabels: Record<PolicyField, string> = {
  requireConsent: "Require consent",
  redactDirectIdentifiers: "Redact direct identifiers",
  researchPurposeOnly: "Research-only use",
  auditLogging: "Enable audit logging",
  blockRestrictedRegions: "Block restricted regions",
  requireDualApprovalHighVolume: "Require dual approval",
  minKAnonymity: "Minimum k-anonymity",
  maxExportRows: "Maximum export rows",
  retentionDays: "Retention days",
  dailyRequestLimit: "Daily request limit",
};

export function policyDiff(
  before: DataPolicy,
  after: DataPolicy,
): PolicyChange[] {
  return policyFieldOrder.flatMap((field) => {
    if (before[field] === after[field]) {
      return [];
    }
    return [
      {
        field,
        before: before[field],
        after: after[field],
        label: fieldLabels[field],
      },
    ];
  });
}

export function deterministicCritique(
  version: "V1" | "V2",
  report: EvaluationReport,
): {
  summary: string;
  repairPlan: string[];
} {
  if (report.failureCodes.length === 0) {
    return {
      summary: "The evaluator found no remaining rubric failures.",
      repairPlan: [],
    };
  }
  return {
    summary: `${version} scored ${report.score}/100. ${report.failureCodes.length} deterministic safety checks remain unsatisfied.`,
    repairPlan: report.safePatchStrategies,
  };
}
