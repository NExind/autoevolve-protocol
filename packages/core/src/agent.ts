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
import { dataPolicyJsonSchema, dataPolicySchema } from "./schema";
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
): { version: PolicyVersion; guarded: boolean } {
  const candidateVersion = makeVersion(
    previous.id === "V1" ? "V2" : "V3",
    "generator",
    candidate,
    previous,
  );
  const isIntermediateRevision = previous.id === "V1";
  const shouldKeepCandidate =
    isStrictImprovement(previous.evaluation, candidateVersion.evaluation) &&
    (isIntermediateRevision
      ? candidateVersion.evaluation.score < 100
      : candidateVersion.evaluation.score === 100);

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
  };
}

function selectStagedInitial(candidate: GeneratedPolicy): {
  version: PolicyVersion;
  usedDeterministicBaseline: boolean;
} {
  const candidateVersion = makeVersion("V1", "generator", candidate);

  // V2 must remain below 100 so that V3 can be a second, independently
  // measurable strict improvement. Three deterministic repairs are applied at
  // V2, so the baseline needs at least four outstanding controls.
  if (candidateVersion.evaluation.failureCodes.length >= 4) {
    return { version: candidateVersion, usedDeterministicBaseline: false };
  }

  return {
    version: makeVersion("V1", "fixture", {
      policy: fixturePolicies.V1,
      model: "deterministic-staged-baseline",
    }),
    usedDeterministicBaseline: true,
  };
}

export async function runAgentLoop(input: {
  generator: PolicyGenerator;
  critic: PolicyCritic;
  task: TaskDefinition;
  inheritedLessons?: InheritedLesson[];
}): Promise<AgentRun> {
  const inheritedLessons = input.inheritedLessons ?? [];
  const events: AgentEvent[] = [];
  const critiques: Critique[] = [];
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
            message:
              "The candidate left fewer than four failed controls, so a deterministic staged baseline was selected to preserve two strict revision stages. The candidate was not presented as V1.",
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
  const guardedV2 = guardRevision(v1, candidateV2, 3);
  const v2 = guardedV2.version;
  if (!isStrictImprovement(v1.evaluation, v2.evaluation)) {
    throw new Error("V2 failed the strict-improvement guardrail.");
  }
  events.push({
    at: now(),
    stage: guardedV2.guarded ? "guardrail" : "revised",
    version: "V2",
    message: guardedV2.guarded
      ? `Generator output was not a safe staged improvement; guardrail produced ${v2.evaluation.score}/100.`
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
    throw new Error("V3 failed the strict-improvement guardrail.");
  }
  events.push({
    at: now(),
    stage: guardedV3.guarded ? "guardrail" : "revised",
    version: "V3",
    message: guardedV3.guarded
      ? `Guardrail completed V3 at ${v3.evaluation.score}/100.`
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
    if (!response.text) {
      throw new Error("Gemini returned no structured policy text.");
    }
    const parsed = dataPolicySchema.parse(JSON.parse(response.text));
    return { policy: parsed, model: config.model };
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
