import { GoogleGenAI } from "@google/genai";
import { sha256Hex } from "./canonical";
import {
  applyGuardedImprovements,
  deterministicCritique,
  evaluatePolicy,
  isStrictImprovement,
  policyDiff,
} from "./evaluator";
import { fixturePolicies } from "./fixtures";
import {
  dataPolicyJsonSchema,
  dataPolicySchema,
  inheritedLessonsSchema,
} from "./schema";
import type {
  AgentEvent,
  AgentRun,
  Critique,
  GeneratedPolicy,
  InheritedLesson,
  PolicyCritic,
  PolicyGenerator,
  PolicyVersion,
  TaskDefinition,
  VersionId,
} from "./types";

function now(): string {
  return new Date().toISOString();
}

function makeVersion(
  id: VersionId,
  source: PolicyVersion["source"],
  generated: GeneratedPolicy,
  previous?: PolicyVersion,
): PolicyVersion {
  const evaluation = evaluatePolicy(generated.policy);
  return {
    id,
    source,
    policy: generated.policy,
    evaluation,
    changesFromPrevious: previous
      ? policyDiff(previous.policy, generated.policy)
      : [],
    createdAt: now(),
  };
}

function guardRevision(
  previous: PolicyVersion,
  candidate: GeneratedPolicy,
  changesToApply: number,
): { version: PolicyVersion; guarded: boolean; reason?: string } {
  const candidateVersion = makeVersion(
    previous.id === "V1" ? "V2" : "V3",
    "generator",
    candidate,
    previous,
  );
  const isIntermediateRevision = previous.id === "V1";

  let reason: string | undefined;
  if (!isStrictImprovement(previous.evaluation, candidateVersion.evaluation)) {
    reason = `Candidate revision did not improve score (${candidateVersion.evaluation.score}/100 <= ${previous.evaluation.score}/100)`;
  } else if (
    isIntermediateRevision &&
    candidateVersion.evaluation.score >= 100
  ) {
    reason =
      "Candidate V2 jumped directly to 100/100, leaving no headroom for a second strict improvement in V3";
  } else if (
    !isIntermediateRevision &&
    candidateVersion.evaluation.score !== 100
  ) {
    reason = `Candidate V3 scored ${candidateVersion.evaluation.score}/100 but must achieve 100/100 to satisfy all rubric controls`;
  }

  const shouldKeepCandidate = reason === undefined;

  if (shouldKeepCandidate) {
    return { version: candidateVersion, guarded: false };
  }

  const policy = applyGuardedImprovements(
    previous.policy,
    previous.evaluation,
    changesToApply,
  );
  return {
    version: makeVersion(
      previous.id === "V1" ? "V2" : "V3",
      "guarded-revision",
      { policy, model: "deterministic-guardrail" },
      previous,
    ),
    guarded: true,
    reason,
  };
}

function selectStagedInitial(candidate: GeneratedPolicy): {
  version: PolicyVersion;
  usedDeterministicBaseline: boolean;
  candidateScore: number;
} {
  const candidateVersion = makeVersion("V1", "generator", candidate);
  const candidateScore = candidateVersion.evaluation.score;

  // V2 must remain below 100 so that V3 can be a second, independently
  // measurable strict improvement. Three deterministic repairs are applied at
  // V2, so the baseline needs at least four outstanding controls.
  if (candidateVersion.evaluation.failureCodes.length >= 4) {
    return {
      version: candidateVersion,
      usedDeterministicBaseline: false,
      candidateScore,
    };
  }

  return {
    version: makeVersion("V1", "fixture", {
      policy: fixturePolicies.V1,
      model: "deterministic-staged-baseline",
    }),
    usedDeterministicBaseline: true,
    candidateScore,
  };
}

export async function runAgentLoop(input: {
  generator: PolicyGenerator;
  critic: PolicyCritic;
  task: TaskDefinition;
  inheritedLessons?: InheritedLesson[];
}): Promise<AgentRun> {
  const rawLessons = input.inheritedLessons ?? [];
  const parsedLessons = inheritedLessonsSchema.safeParse(rawLessons);
  if (!parsedLessons.success) {
    const details = parsedLessons.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    throw new Error(
      `Invalid inherited lessons provided to agent loop: ${details}`,
    );
  }
  const inheritedLessons = parsedLessons.data;

  const events: AgentEvent[] = [];
  const critiques: Critique[] = [];

  if (inheritedLessons.length > 0) {
    const summary = inheritedLessons
      .map(
        (l) =>
          `${l.failureCode} (${l.sourceCid ? l.sourceCid.slice(0, 10) + "…" : "allowlisted"})`,
      )
      .join(", ");
    events.push({
      at: now(),
      stage: "generated",
      version: "V1",
      message: `Agent Beta inherited ${inheritedLessons.length} verified lesson(s) from decentralized memory: [${summary}].`,
    });
  }

  const initial = await input.generator.generateInitial({
    task: input.task,
    inheritedLessons,
  });
  const selectedInitial = selectStagedInitial(initial);
  const v1 = selectedInitial.version;
  events.push(
    {
      at: now(),
      stage: "generated",
      version: "V1",
      message: `Generator (${initial.model}) produced an initial candidate at ${evaluatePolicy(initial.policy).score}/100.`,
    },
    ...(selectedInitial.usedDeterministicBaseline
      ? [
          {
            at: now(),
            stage: "guardrail" as const,
            version: "V1" as const,
            message: `The candidate scored ${selectedInitial.candidateScore}/100 with fewer than four failed controls, so a deterministic staged baseline (40/100) was selected to preserve two strict revision stages. The candidate was not presented as V1.`,
          },
        ]
      : []),
    {
      at: now(),
      stage: "evaluated",
      version: "V1",
      message: `Deterministic evaluator recorded ${v1.evaluation.score}/100.`,
    },
  );

  const critique1 = await input.critic.critique({
    task: input.task,
    version: v1,
  });
  critiques.push(critique1);
  events.push({
    at: now(),
    stage: "critiqued",
    version: "V1",
    message: "Critic mapped failed rubric checks to repairs.",
  });

  const candidateV2 = await input.generator.revise({
    task: input.task,
    previous: v1,
    critique: critique1,
    revision: "V2",
  });
  const maxAllowedV2Changes = Math.min(
    3,
    Math.max(1, v1.evaluation.failureCodes.length - 1),
  );
  const guardedV2 = guardRevision(v1, candidateV2, maxAllowedV2Changes);
  const v2 = guardedV2.version;
  if (!isStrictImprovement(v1.evaluation, v2.evaluation)) {
    throw new Error(
      "V2 failed the strict-improvement guardrail: V2 score must exceed V1.",
    );
  }
  if (v2.evaluation.score >= 100) {
    throw new Error(
      "V2 failed the staged guardrail: V2 score must remain strictly below 100.",
    );
  }
  events.push({
    at: now(),
    stage: guardedV2.guarded ? "guardrail" : "revised",
    version: "V2",
    message: guardedV2.guarded
      ? `Generator output was not a safe staged improvement (${guardedV2.reason}); guardrail produced ${v2.evaluation.score}/100.`
      : `Generator revision reached ${v2.evaluation.score}/100.`,
  });

  const critique2 = await input.critic.critique({
    task: input.task,
    version: v2,
  });
  critiques.push(critique2);
  events.push({
    at: now(),
    stage: "critiqued",
    version: "V2",
    message: "Critic isolated remaining failed rubric checks.",
  });

  const candidateV3 = await input.generator.revise({
    task: input.task,
    previous: v2,
    critique: critique2,
    revision: "V3",
  });
  const guardedV3 = guardRevision(v2, candidateV3, Number.POSITIVE_INFINITY);
  const v3 = guardedV3.version;
  if (!isStrictImprovement(v2.evaluation, v3.evaluation)) {
    throw new Error(
      "V3 failed the strict-improvement guardrail: V3 score must exceed V2.",
    );
  }
  if (v3.evaluation.score !== 100) {
    throw new Error(
      "V3 failed to reach the required maximum score of 100/100.",
    );
  }
  events.push({
    at: now(),
    stage: guardedV3.guarded ? "guardrail" : "revised",
    version: "V3",
    message: guardedV3.guarded
      ? `Generator output required completion (${guardedV3.reason}); guardrail completed V3 at ${v3.evaluation.score}/100.`
      : `Generator revision reached ${v3.evaluation.score}/100.`,
  });

  const runSeed = await sha256Hex({
    task: input.task.id,
    at: v1.createdAt,
    policy: v1.policy,
  });
  return {
    runId: `run-${runSeed.slice(2, 14)}`,
    mode: "live",
    task: input.task,
    versions: [v1, v2, v3],
    critiques,
    events,
    inheritedLessons,
    proofBoundary:
      "Live agent output is evaluated by a deterministic rubric. If an initial model candidate cannot support two strict improvement stages, the run explicitly substitutes a deterministic staged baseline. A later attestation can prove rubric score increases for the selected policies; it does not prove model reasoning.",
  };
}

export function createDeterministicCritic(): PolicyCritic {
  return {
    async critique({ version }) {
      const derived = deterministicCritique(
        version.id as "V1" | "V2",
        version.evaluation,
      );
      return {
        fromVersion: version.id as "V1" | "V2",
        summary: derived.summary,
        failureCodes: version.evaluation.failureCodes,
        repairPlan: derived.repairPlan,
        author: "deterministic-critic",
      };
    },
  };
}

export function cleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

export function parseGeneratedPolicyJson(
  rawText: string | undefined | null,
  modelName: string,
): GeneratedPolicy {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("Gemini returned no structured policy text.");
  }

  const cleaned = cleanJsonText(rawText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(
      `Gemini returned malformed JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    );
  }

  const schemaResult = dataPolicySchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    const details = schemaResult.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Gemini returned invalid policy schema: ${details}`);
  }

  return { policy: schemaResult.data, model: modelName };
}

export function createGeminiPolicyGenerator(config: {
  apiKey: string;
  model: string;
}): PolicyGenerator {
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const produce = async (prompt: string): Promise<GeneratedPolicy> => {
    const response = await (
      client.models.generateContent as unknown as (args: unknown) => Promise<{
        text?: string;
      }>
    )({
      model: config.model,
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: dataPolicyJsonSchema,
      },
    });
    return parseGeneratedPolicyJson(response.text, config.model);
  };

  return {
    generateInitial: ({ task, inheritedLessons }) =>
      produce(
        [
          "Return only a JSON DataPolicy.",
          `Task: ${task.publicSummary}`,
          "Create a plausible initial policy with meaningful but incomplete safeguards. Leave at least four rubric safeguards unmet so two strict revision stages can be evaluated; do not include commentary.",
          inheritedLessons.length
            ? `Prior verified lessons: ${inheritedLessons.map((lesson) => lesson.safePatchStrategy).join(" ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    revise: ({ task, previous, critique, revision }) =>
      produce(
        [
          "Return only a JSON DataPolicy.",
          `Task: ${task.publicSummary}`,
          `This is ${revision}; preserve valid controls while addressing the evaluator critique.`,
          `Previous policy: ${JSON.stringify(previous.policy)}`,
          `Failed checks: ${critique.failureCodes.join(", ")}`,
          `Repair plan: ${critique.repairPlan.join(" ")}`,
        ].join("\n"),
      ),
  };
}
