export const policyFieldOrder = [
  "requireConsent",
  "redactDirectIdentifiers",
  "researchPurposeOnly",
  "auditLogging",
  "blockRestrictedRegions",
  "requireDualApprovalHighVolume",
  "minKAnonymity",
  "maxExportRows",
  "retentionDays",
  "dailyRequestLimit",
] as const;

export type PolicyField = (typeof policyFieldOrder)[number];
export type VersionId = "V1" | "V2" | "V3";
export type RunMode = "showcase" | "live";

export interface DataPolicy {
  requireConsent: boolean;
  redactDirectIdentifiers: boolean;
  researchPurposeOnly: boolean;
  auditLogging: boolean;
  blockRestrictedRegions: boolean;
  requireDualApprovalHighVolume: boolean;
  minKAnonymity: number;
  maxExportRows: number;
  retentionDays: number;
  dailyRequestLimit: number;
}

export interface RuleResult {
  id: string;
  label: string;
  passed: boolean;
  points: 10;
  detail: string;
  failureCode?: FailureCode;
}

export type FailureCode =
  | "MISSING_CONSENT_GATE"
  | "PII_EXPOSURE"
  | "NON_RESEARCH_PURPOSE"
  | "MISSING_AUDIT_LOG"
  | "MISSING_REGION_BLOCK"
  | "MISSING_DUAL_APPROVAL"
  | "K_ANONYMITY_TOO_LOW"
  | "EXPORT_LIMIT_TOO_HIGH"
  | "RETENTION_TOO_LONG"
  | "RATE_LIMIT_TOO_HIGH";

export interface EvaluationReport {
  evaluatorVersion: "policy-rubric-v1";
  score: number;
  maxScore: 100;
  checks: RuleResult[];
  failureCodes: FailureCode[];
  safePatchStrategies: string[];
}

export interface PolicyChange {
  field: PolicyField;
  before: DataPolicy[PolicyField];
  after: DataPolicy[PolicyField];
  label: string;
  reason?: string;
}

export interface PolicyVersion {
  id: VersionId;
  source: "fixture" | "generator" | "guarded-revision";
  policy: DataPolicy;
  evaluation: EvaluationReport;
  changesFromPrevious: PolicyChange[];
  createdAt: string;
  displayCommitment?: string;
}

export interface Critique {
  fromVersion: "V1" | "V2";
  summary: string;
  failureCodes: FailureCode[];
  repairPlan: string[];
  author:
    | "fixture-critic"
    | "gemini-critic"
    | "deterministic-critic"
    | "featherless-critic";
}

export interface AgentEvent {
  at: string;
  stage: "generated" | "evaluated" | "critiqued" | "revised" | "guardrail";
  version: VersionId;
  message: string;
}

export interface InheritedLesson {
  failureCode: FailureCode;
  safePatchStrategy: string;
  sourceRunId?: string;
  sourceCid?: string;
}

export interface TaskDefinition {
  id: string;
  title: string;
  publicSummary: string;
  rubricVersion: "policy-rubric-v1";
}

export interface AgentRun {
  runId: string;
  mode: RunMode;
  task: TaskDefinition;
  userPrompt?: string;
  versions: PolicyVersion[];
  critiques: Critique[];
  events: AgentEvent[];
  inheritedLessons: InheritedLesson[];
  proofBoundary: string;
}

export interface GeneratedPolicy {
  policy: DataPolicy;
  model: string;
}

export interface PolicyGenerator {
  generateInitial(input: {
    task: TaskDefinition;
    inheritedLessons: InheritedLesson[];
    userPrompt?: string;
  }): Promise<GeneratedPolicy>;
  revise(input: {
    task: TaskDefinition;
    previous: PolicyVersion;
    critique: Critique;
    revision: Exclude<VersionId, "V1">;
    userPrompt?: string;
  }): Promise<GeneratedPolicy>;
}

export interface PolicyCritic {
  critique(input: {
    task: TaskDefinition;
    version: PolicyVersion;
  }): Promise<Critique>;
}
