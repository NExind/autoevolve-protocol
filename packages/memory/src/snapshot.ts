import {
  canonicalJson,
  sha256Hex,
  type AgentRun,
  type FailureCode,
} from "@autoevolve/core";
import type { Embedder, MemoryCard, SnapshotCore } from "./types";
import {
  isUnsafeFieldKey,
  isSafeMemoryCard,
  parseSnapshotCore,
} from "./validation";

export function stripUnsafeFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeFields);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isUnsafeFieldKey(key))
        .map(([key, child]) => [key, stripUnsafeFields(child)]),
    );
  }
  return value;
}

function cardsForFailureCodes(
  runId: string,
  version: "V1" | "V2",
  failureCodes: FailureCode[],
  strategies: string[],
): MemoryCard[] {
  return failureCodes.map((failureCode, index) => ({
    id: `${runId}:${version}:${failureCode}`,
    failureCode,
    safePatchStrategy:
      strategies[index] ?? "Apply the matching deterministic rubric repair.",
    sourceRunId: runId,
    sourceVersion: version,
  }));
}

export async function buildSnapshotCore(input: {
  run: AgentRun;
  taskHash: string;
  model: string;
  wallet?: string;
  tags?: string[];
  embedder?: Embedder;
}): Promise<SnapshotCore> {
  const { run } = input;
  const cards = run.critiques.flatMap((critique) =>
    cardsForFailureCodes(
      run.runId,
      critique.fromVersion,
      critique.failureCodes,
      critique.repairPlan,
    ),
  );
  const cardsWithEmbeddings = input.embedder
    ? await Promise.all(
        cards.map(async (card) => {
          const embedding = await input.embedder!.embed(
            card.failureCode + ": " + card.safePatchStrategy,
          );
          if (
            !embedding.length ||
            embedding.length > 4096 ||
            embedding.some((value) => !Number.isFinite(value))
          ) {
            throw new Error("Embedder returned an invalid memory vector.");
          }
          return { ...card, embedding };
        }),
      )
    : cards;
  const draft = {
    schemaVersion: "autoevolve-memory/v1" as const,
    runId: run.runId,
    task: {
      taskId: run.task.id,
      taskHash: input.taskHash,
      publicSummary: run.task.publicSummary,
      tags: input.tags ?? ["policy-repair", "privacy", "safety"],
    },
    agent: {
      ...(input.wallet ? { wallet: input.wallet } : {}),
      model: input.model,
      deterministicConfig: { temperature: 0 as const },
      systemPromptStored: false as const,
    },
    versions: await Promise.all(
      run.versions.map(async (version) => ({
        id: version.id,
        policy: version.policy,
        score: version.evaluation.score,
        outputHash: await sha256Hex(version.policy),
      })),
    ),
    transitions: run.critiques.map((critique, index) => {
      const nextVersion = run.versions[index + 1];
      return {
        from: critique.fromVersion,
        to: nextVersion.id as "V2" | "V3",
        critiqueSummary: critique.summary,
        failureCodes: critique.failureCodes,
        safePatchStrategies: critique.repairPlan,
        changes: nextVersion.changesFromPrevious,
      };
    }),
    memory: { cards: cardsWithEmbeddings },
  };

  const sanitized = stripUnsafeFields(draft) as typeof draft;
  const snapshot = {
    ...sanitized,
    integrity: {
      canonicalPayloadHash: await sha256Hex(canonicalJson(sanitized)),
    },
  } satisfies SnapshotCore;
  return parseSnapshotCore(snapshot);
}

export function validateSafeMemoryCards(snapshot: SnapshotCore): MemoryCard[] {
  const validated = parseSnapshotCore(snapshot);
  return validated.memory.cards.filter(isSafeMemoryCard);
}
