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
