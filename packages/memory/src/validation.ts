import {
  canonicalJson,
  dataPolicySchema,
  sha256Hex,
  type DataPolicy,
  type FailureCode,
  type PolicyChange,
} from "@autoevolve/core";
import { CID } from "multiformats/cid";
import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";
import type { MemoryCard, SnapshotCore } from "./types";

const failureCodeValues = [
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
] as const satisfies readonly FailureCode[];

const policyFieldValues = [
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

const hex32 = /^0x[a-fA-F0-9]{64}$/;

// `systemPromptStored` is an intentional boolean attestation that no prompt was
// published. Any actual prompt field remains prohibited.
const unsafeFieldPattern =
  /(api[_-]?key|authorization|private[_-]?key|secret|chain[_-]?of[_-]?thought)/i;
const systemPromptPattern = /system[_-]?prompt/i;
const unsafeContentPattern =
  /(api[_ -]?key|authorization|private[_ -]?key|secret|system[_ -]?prompt|chain[_ -]?of[_ -]?thought)/i;

export function isUnsafeFieldKey(key: string): boolean {
  return (
    unsafeFieldPattern.test(key) ||
    (systemPromptPattern.test(key) && key !== "systemPromptStored")
  );
}

export function assertNoUnsafeFields(value: unknown, path = "snapshot"): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      assertNoUnsafeFields(child, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeFieldKey(key)) {
      throw new Error(`Unsafe field rejected at ${path}.${key}.`);
    }
    assertNoUnsafeFields(child, `${path}.${key}`);
  }
}

const policyChangeSchema = z
  .object({
    field: z.enum(policyFieldValues),
    before: z.union([z.boolean(), z.number().int()]),
    after: z.union([z.boolean(), z.number().int()]),
    label: z.string().min(1).max(120),
    reason: z.string().min(1).max(300).optional(),
  })
  .strict();

const memoryCardSchema = z
  .object({
    id: z.string().min(1).max(180),
    failureCode: z.enum(failureCodeValues),
    safePatchStrategy: z.string().min(1).max(300),
    sourceRunId: z.string().min(1).max(128),
    sourceVersion: z.enum(["V1", "V2"]),
    sourceCid: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => {
        try {
          assertCid(value);
          return true;
        } catch {
          return false;
        }
      }, "sourceCid must be a canonical CIDv0 or CIDv1 value.")
      .optional(),
    embedding: z.array(z.number().finite()).min(1).max(4096).optional(),
  })
  .strict();

export const snapshotCoreSchema = z
  .object({
    schemaVersion: z.literal("autoevolve-memory/v1"),
    runId: z.string().min(1).max(128),
    task: z
      .object({
        taskId: z.string().min(1).max(128),
        taskHash: z.string().regex(hex32, "taskHash must be bytes32 hex."),
        publicSummary: z.string().min(1).max(2_000),
        tags: z.array(z.string().min(1).max(80)).max(12),
      })
      .strict(),
    agent: z
      .object({
        wallet: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .optional(),
        model: z.string().min(1).max(160),
        deterministicConfig: z.object({ temperature: z.literal(0) }).strict(),
        systemPromptStored: z.literal(false),
      })
      .strict(),
    versions: z
      .array(
        z
          .object({
            id: z.enum(["V1", "V2", "V3"]),
            policy: dataPolicySchema,
            score: z.number().int().min(0).max(100),
            outputHash: z
              .string()
              .regex(hex32, "outputHash must be bytes32 hex."),
          })
          .strict(),
      )
      .length(3)
      .superRefine((versions, context) => {
        const order = ["V1", "V2", "V3"] as const;
        for (const [index, expected] of order.entries()) {
          if (versions[index]?.id !== expected) {
            context.addIssue({
              code: "custom",
              message: `Version ${index + 1} must be ${expected}.`,
              path: [index, "id"],
            });
          }
        }
      }),
    transitions: z
      .array(
        z
          .object({
            from: z.enum(["V1", "V2"]),
            to: z.enum(["V2", "V3"]),
            critiqueSummary: z.string().min(1).max(1_000),
            failureCodes: z.array(z.enum(failureCodeValues)).max(10),
            safePatchStrategies: z.array(z.string().min(1).max(300)).max(10),
            changes: z.array(policyChangeSchema).max(10),
          })
          .strict(),
      )
      .length(2)
      .superRefine((transitions, context) => {
        const expected = [
          ["V1", "V2"],
          ["V2", "V3"],
        ] as const;
        for (const [index, transition] of transitions.entries()) {
          if (
            transition.from !== expected[index][0] ||
            transition.to !== expected[index][1]
          ) {
            context.addIssue({
              code: "custom",
              message: "Transitions must be V1→V2 and V2→V3 in order.",
              path: [index],
            });
          }
        }
      }),
    memory: z.object({ cards: z.array(memoryCardSchema).max(20) }).strict(),
    integrity: z
      .object({
        canonicalPayloadHash: z
          .string()
          .regex(hex32, "canonicalPayloadHash must be bytes32 hex."),
      })
      .strict(),
  })
  .strict();

function asSnapshotCore(
  value: z.infer<typeof snapshotCoreSchema>,
): SnapshotCore {
  return value as SnapshotCore;
}

/** Validates IPFS CIDv0/CIDv1 syntax and rejects non-canonical encodings. */
export function assertCid(cid: string): string {
  if (typeof cid !== "string" || cid.length === 0 || cid.length > 128) {
    throw new Error("Expected a non-empty IPFS CID.");
  }
  let parsed: CID;
  try {
    parsed = CID.parse(cid);
  } catch {
    throw new Error("Expected a valid CIDv0 or CIDv1 IPFS identifier.");
  }
  if (parsed.version !== 0 && parsed.version !== 1) {
    throw new Error("Only CIDv0 and CIDv1 snapshots are supported.");
  }
  if (parsed.toString() !== cid) {
    throw new Error("CID must use canonical textual encoding.");
  }
  return cid;
}

export function cidHash(cid: string): Hex {
  return keccak256(stringToHex(assertCid(cid)));
}

/**
 * Rejects a gateway response whose CID does not match the CID hash committed by
 * AutoEvolveRegistry. Hashing the CID text mirrors Solidity's keccak256(bytes(cid)).
 */
export function assertCidMatchesHash(cid: string, expectedHash: Hex): void {
  if (!hex32.test(expectedHash)) {
    throw new Error("Expected CID hash must be a bytes32 hex value.");
  }
  if (cidHash(cid).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error("CID does not match the registry's committed CID hash.");
  }
}

export function parseSnapshotCore(value: unknown): SnapshotCore {
  assertNoUnsafeFields(value);
  const parsed = snapshotCoreSchema.parse(value);
  return asSnapshotCore(parsed);
}

/** Verifies the canonical payload hash after schema and secret-field validation. */
export async function verifySnapshotIntegrity(
  snapshot: SnapshotCore,
): Promise<SnapshotCore> {
  const { integrity: _integrity, ...payload } = snapshot;
  const actualHash = await sha256Hex(canonicalJson(payload));
  if (
    actualHash.toLowerCase() !==
    snapshot.integrity.canonicalPayloadHash.toLowerCase()
  ) {
    throw new Error(
      "Snapshot canonical payload hash does not match its contents.",
    );
  }
  return snapshot;
}

export function isSafeMemoryCard(card: MemoryCard): boolean {
  try {
    assertNoUnsafeFields(card, "memoryCard");
    const parsed = memoryCardSchema.parse(card);
    if (unsafeContentPattern.test(parsed.safePatchStrategy)) {
      return false;
    }
    if (parsed.sourceCid) {
      assertCid(parsed.sourceCid);
    }
    return true;
  } catch {
    return false;
  }
}

export type ValidatedPolicyChange = PolicyChange;
export type ValidatedDataPolicy = DataPolicy;
