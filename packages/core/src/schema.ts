import { z } from "zod";

export const dataPolicySchema = z
  .object({
    requireConsent: z.boolean(),
    redactDirectIdentifiers: z.boolean(),
    researchPurposeOnly: z.boolean(),
    auditLogging: z.boolean(),
    blockRestrictedRegions: z.boolean(),
    requireDualApprovalHighVolume: z.boolean(),
    minKAnonymity: z.number().int().min(0).max(255),
    maxExportRows: z.number().int().min(1).max(16_383),
    retentionDays: z.number().int().min(1).max(63),
    dailyRequestLimit: z.number().int().min(1).max(127),
  })
  .strict();

export const critiqueSchema = z
  .object({
    summary: z.string().min(1).max(1_000),
    failureCodes: z.array(z.string()).max(10),
    repairPlan: z.array(z.string().min(1).max(300)).max(10),
  })
  .strict();

export const failureCodeSchema = z.enum([
  "MISSING_CONSENT_GATE",
  "PII_EXPOSURE",
  "NON_RESEARCH_PURPOSE",
  "MISSING_AUDIT_LOG",
  "MISSING_REGION_BLOCK",
  "MISSING_DUAL_APPROVAL",
  "K_ANONYMITY_TOO_LOW",
  "EXPORT_LIMIT_TOO_HIGH",
  "RETENTION_TOO_LONG",
  "RATE_LIMIT_TOO_HIGH",
]);

export const inheritedLessonSchema = z
  .object({
    failureCode: failureCodeSchema,
    safePatchStrategy: z.string().min(1).max(500),
    sourceRunId: z.string().max(100).optional(),
    sourceCid: z.string().max(100).optional(),
  })
  .strict();

export const inheritedLessonsSchema = z.array(inheritedLessonSchema).max(10);

export const dataPolicyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
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
  ],
  properties: {
    requireConsent: { type: "boolean" },
    redactDirectIdentifiers: { type: "boolean" },
    researchPurposeOnly: { type: "boolean" },
    auditLogging: { type: "boolean" },
    blockRestrictedRegions: { type: "boolean" },
    requireDualApprovalHighVolume: { type: "boolean" },
    minKAnonymity: { type: "integer", minimum: 0, maximum: 255 },
    maxExportRows: { type: "integer", minimum: 1, maximum: 16383 },
    retentionDays: { type: "integer", minimum: 1, maximum: 63 },
    dailyRequestLimit: { type: "integer", minimum: 1, maximum: 127 },
  },
} as const;
