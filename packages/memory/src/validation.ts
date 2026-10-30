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
import type { MemoryCard, SnapshotCore, VerifiedMemoryPointer } from "./types";

export const MAX_SNAPSHOT_BYTES = 512 * 1024; // 512 KB

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
  /(api[_-]?key|authorization|bearer|token|credentials|private[_-]?key|wallet[_-]?(private[_-]?)?key|secret[_-]?key|secret|mnemonic|chain[_-]?of[_-]?thought|raw[_-]?(cot|thought)|(raw[_-]?)?user([_-]?data)?|raw[_-]?prompt)/i;
const systemPromptPattern = /system[_-]?prompt/i;
const unsafeContentPattern =
  /(api[_ -]?key|authorization|bearer\s+[a-z0-9_\-\.]|sk-[a-zA-Z0-9_\-]{15,}|private[_ -]?key|wallet[_ -]?key|secret|system[_ -]?prompt|chain[_ -]?of[_ -]?thought|raw[_ -]?(cot|thought)|raw[_ -]?user)/i;

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
    if (typeof value === "string") {
      if (
        /^(sk-[a-zA-Z0-9_\-]{20,}|bearer\s+[a-z0-9_\-\.]{20,})/i.test(value)
      ) {
        throw new Error(`Unsafe secret content rejected at ${path}.`);
      }
    }
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

export const memoryCardSchema = z
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
        if (
          versions[0] &&
          versions[1] &&
          versions[1].score <= versions[0].score
        ) {
          context.addIssue({
            code: "custom",
            message: "V2 score must strictly improve over V1 score.",
            path: [1, "score"],
          });
        }
        if (
          versions[1] &&
          versions[2] &&
          versions[2].score <= versions[1].score
        ) {
          context.addIssue({
            code: "custom",
            message: "V3 score must strictly improve over V2 score.",
            path: [2, "score"],
          });
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

/**
 * Asserts that a registry memory pointer matches the fetched snapshot's metadata.
 * Validates existence, CID hash binding, runId binding, stage/version, score, and agent wallet.
 */
export function assertRegistryPointerMatchesSnapshot(
  pointer: VerifiedMemoryPointer,
  snapshot: SnapshotCore,
): void {
  if (!pointer.exists) {
    throw new Error("Registry memory pointer does not exist.");
  }
  assertCid(pointer.cid);
  assertCidMatchesHash(pointer.cid, pointer.cidHash as Hex);

  const snapshotRunIdHash = hex32.test(snapshot.runId)
    ? (snapshot.runId.toLowerCase() as Hex)
    : keccak256(stringToHex(snapshot.runId));
  if (pointer.runId.toLowerCase() !== snapshotRunIdHash.toLowerCase()) {
    throw new Error(
      `Registry pointer runId mismatch: pointer has ${pointer.runId}, but snapshot has ${snapshotRunIdHash} (from "${snapshot.runId}").`,
    );
  }

  const expectedVersionId = `V${pointer.version}` as "V1" | "V2" | "V3";
  const matchingVersion = snapshot.versions.find(
    (version) => version.id === expectedVersionId,
  );
  if (!matchingVersion) {
    throw new Error(
      `Registry pointer version mismatch: snapshot contains no version ${expectedVersionId}.`,
    );
  }

  if (matchingVersion.score !== pointer.score) {
    throw new Error(
      `Registry pointer score mismatch: pointer recorded score ${pointer.score}, but snapshot version ${expectedVersionId} has score ${matchingVersion.score}.`,
    );
  }

  if (snapshot.agent.wallet) {
    if (snapshot.agent.wallet.toLowerCase() !== pointer.agent.toLowerCase()) {
      throw new Error(
        `Registry pointer agent mismatch: pointer recorded agent ${pointer.agent}, but snapshot has wallet ${snapshot.agent.wallet}.`,
      );
    }
  }
}

export function parseSnapshotCore(value: unknown): SnapshotCore {
  let target = value;
  if (typeof value === "string") {
    const rawBytes = new TextEncoder().encode(value).length;
    if (rawBytes > MAX_SNAPSHOT_BYTES) {
      throw new Error(
        `Snapshot payload is oversized (${rawBytes} bytes exceeds ${MAX_SNAPSHOT_BYTES} bytes limit).`,
      );
    }
    try {
      target = JSON.parse(value);
    } catch {
      throw new Error("Malformed snapshot: input is not valid JSON.");
    }
  }
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error("Expected snapshot to be a non-null object.");
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(target);
  } catch {
    throw new Error("Malformed snapshot: object cannot be serialized to JSON.");
  }
  const byteLength = new TextEncoder().encode(serialized).length;
  if (byteLength > MAX_SNAPSHOT_BYTES) {
    throw new Error(
      `Snapshot payload is oversized (${byteLength} bytes exceeds ${MAX_SNAPSHOT_BYTES} bytes limit).`,
    );
  }
  assertNoUnsafeFields(target);
  const parsed = snapshotCoreSchema.parse(target);
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
