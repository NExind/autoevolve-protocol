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
  DataPolicy,
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

export function synthesizeDefaultSolutionDocument(
  id: VersionId,
  policy: DataPolicy,
  title = "Autonomous Domain Solution",
): string {
  const p = policy;
  if (id === "V1") {
    return `# ${id} Baseline Draft: ${title}

## Executive Summary
This preliminary release charter outlines baseline access controls, operational protocols, and retention gates generated for the target scenario.

### Draft Parameters & Controls
- **Explicit Participant Consent**: ${p.requireConsent ? "Enforced" : "Omitted (Unverified access permitted)"}
- **Direct Identifier Redaction**: ${p.redactDirectIdentifiers ? "Active" : "Disabled (Potential PII exposure)"}
- **Research Purpose Gate**: ${p.researchPurposeOnly ? "Strictly restricted" : "Open access"}
- **Audit Logging**: ${p.auditLogging ? "Tamper-evident logs enabled" : "No immutable logging"}
- **Restricted Region Fence**: ${p.blockRestrictedRegions ? "Active" : "Disabled"}
- **Dual Approval for High Volume**: ${p.requireDualApprovalHighVolume ? "Enabled" : "Disabled"}
- **k-Anonymity Threshold**: ${p.minKAnonymity}
- **Max Export Rows**: ${p.maxExportRows.toLocaleString()} rows
- **Data Retention Window**: ${p.retentionDays} days
- **Daily Request Limit**: ${p.dailyRequestLimit} requests / day

### Identified Risks & Incomplete Safeguards
Initial candidate features relaxed constraints to allow rapid testing. Awaiting formal critique from the independent adversarial auditor to guide V2 revision.`;
  }

  if (id === "V2") {
    return `# ${id} Guarded Revision: ${title}

## Evolution & Remediation Summary
Revision incorporates actionable repair strategies from the adversarial critic. High-risk controls have been hardened while balancing domain operational requirements.

### Updated Safeguards & Mitigations
- **k-Anonymity**: Set to ${p.minKAnonymity} (strengthened against quasi-identifier re-identification)
- **PII Protection**: ${p.redactDirectIdentifiers ? "Direct identifiers systematically redacted" : "Pending"}
- **Geographic Gate**: ${p.blockRestrictedRegions ? "Restricted region blocking active" : "Pending"}
- **Audit Logging**: ${p.auditLogging ? "Immutable logging active" : "Pending"}

### Remaining Enhancements for V3
Outstanding controls require remediation before production certification and zero-knowledge witness generation.`;
  }

  return `# ${id} Production-Ready Solution: ${title}

## Final Hardened Architecture
All 10 deterministic security controls in policy-rubric-v1 have been achieved (100/100 Rubric Score). Validated for cryptographic Groth16 witness generation and Base Sepolia settlement.

### Production Controls Matrix
1. **Explicit Participant Consent**: Enforced (Mandatory participant authorization gate)
2. **Direct Identifier Redaction**: Active (Automated field stripping & tokenization)
3. **Research-Only Restriction**: Active (Non-research and commercial use blocked)
4. **Tamper-Evident Audit Logging**: Active (Append-only query accountability)
5. **Restricted Region Blocking**: Active (Geo-fencing perimeter active)
6. **Dual Approval for High Volume**: Active (Dual signature required for large queries)
7. **k-Anonymity Floor**: Floor ${p.minKAnonymity} enforced (Protects micro-cohorts)
8. **Export Limit**: Capped at ${p.maxExportRows.toLocaleString()} rows per query
9. **Retention Window**: Strictly limited to ${p.retentionDays} days
10. **Daily Request Quota**: Rate-limited to ${p.dailyRequestLimit} requests/day`;
}

function makeVersion(
  id: VersionId,
  source: PolicyVersion["source"],
  generated: GeneratedPolicy,
  previous?: PolicyVersion,
  taskTitle?: string,
): PolicyVersion {
  const evaluation = evaluatePolicy(generated.policy);
  const solutionDocument =
    generated.solutionDocument ??
    previous?.solutionDocument ??
    synthesizeDefaultSolutionDocument(id, generated.policy, taskTitle);

  return {
    id,
    source,
    policy: generated.policy,
    evaluation,
    changesFromPrevious: previous
      ? policyDiff(previous.policy, generated.policy)
      : [],
    createdAt: now(),
    solutionDocument,
  };
}

function guardRevision(
  previous: PolicyVersion,
  candidate: GeneratedPolicy,
  changesToApply: number,
  taskTitle?: string,
): { version: PolicyVersion; guarded: boolean; reason?: string } {
  const candidateVersion = makeVersion(
    previous.id === "V1" ? "V2" : "V3",
    "generator",
    candidate,
    previous,
    taskTitle,
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
      {
        policy,
        model: "deterministic-guardrail",
        solutionDocument:
          candidate.solutionDocument ??
          previous.solutionDocument ??
          synthesizeDefaultSolutionDocument(
            previous.id === "V1" ? "V2" : "V3",
            policy,
            taskTitle,
          ),
      },
      previous,
      taskTitle,
    ),
    guarded: true,
    reason,
  };
}

function selectStagedInitial(
  candidate: GeneratedPolicy,
  taskTitle?: string,
): {
  version: PolicyVersion;
  usedDeterministicBaseline: boolean;
  candidateScore: number;
} {
  const candidateVersion = makeVersion(
    "V1",
    "generator",
    candidate,
    undefined,
    taskTitle,
  );
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
    version: makeVersion(
      "V1",
      "fixture",
      {
        policy: fixturePolicies.V1,
        model: "deterministic-staged-baseline",
        solutionDocument: candidate.solutionDocument,
      },
      undefined,
      taskTitle,
    ),
    usedDeterministicBaseline: true,
    candidateScore,
  };
}

export async function runAgentLoop(input: {
  generator: PolicyGenerator;
  critic: PolicyCritic;
  task: TaskDefinition;
  inheritedLessons?: InheritedLesson[];
  userPrompt?: string;
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

  if (input.userPrompt) {
    events.push({
      at: now(),
      stage: "generated",
      version: "V1",
      message: `Active domain guidance: "${input.userPrompt}".`,
    });
  }

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
    userPrompt: input.userPrompt,
  });
  const selectedInitial = selectStagedInitial(initial, input.task.title);
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
    userPrompt: input.userPrompt,
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
    userPrompt: input.userPrompt,
  });
  const maxAllowedV2Changes = Math.min(
    3,
    Math.max(1, v1.evaluation.failureCodes.length - 1),
  );
  const guardedV2 = guardRevision(
    v1,
    candidateV2,
    maxAllowedV2Changes,
    input.task.title,
  );
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
    userPrompt: input.userPrompt,
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
    userPrompt: input.userPrompt,
  });
  const guardedV3 = guardRevision(
    v2,
    candidateV3,
    Number.POSITIVE_INFINITY,
    input.task.title,
  );
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
    userPrompt: input.userPrompt,
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
  // Check if there are markdown code fences anywhere in the string
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  // If no fences, find first '{' and last '}'
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
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

  const isWrapped =
    parsedJson &&
    typeof parsedJson === "object" &&
    "policy" in parsedJson &&
    typeof (parsedJson as Record<string, unknown>).policy === "object" &&
    (parsedJson as Record<string, unknown>).policy !== null;

  const candidatePolicy = isWrapped
    ? (parsedJson as Record<string, unknown>).policy
    : parsedJson;

  const solutionDocument =
    parsedJson &&
    typeof parsedJson === "object" &&
    "solutionDocument" in parsedJson &&
    typeof (parsedJson as Record<string, unknown>).solutionDocument === "string"
      ? ((parsedJson as Record<string, unknown>).solutionDocument as string)
      : undefined;

  const schemaResult = dataPolicySchema.safeParse(candidatePolicy);
  if (!schemaResult.success) {
    const details = schemaResult.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Gemini returned invalid policy schema: ${details}`);
  }

  return {
    policy: schemaResult.data,
    model: modelName,
    ...(solutionDocument ? { solutionDocument } : {}),
  };
}

export const geminiOutputJsonSchema = {
  type: "object",
  required: ["policy", "solutionDocument"],
  properties: {
    policy: dataPolicyJsonSchema,
    solutionDocument: {
      type: "string",
      description:
        "A full, rich Markdown-formatted solution, study roadmap, or operational governance document tailored specifically to the given task and domain prompt.",
    },
  },
} as const;

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
        responseJsonSchema: geminiOutputJsonSchema,
      },
    });
    return parseGeneratedPolicyJson(response.text, config.model);
  };

  return {
    generateInitial: ({ task, inheritedLessons, userPrompt }) =>
      produce(
        [
          "Return a JSON object with 'policy' (matching the DataPolicy schema) and 'solutionDocument' (a comprehensive markdown formatted roadmap, guide, or policy document).",
          `Task: ${task.publicSummary}`,
          userPrompt ? `Domain scenario / User guidance: ${userPrompt}` : "",
          "Tailor all policy fields and write the solution document specifically to satisfy the given task and domain scenario. For 'policy', create a plausible initial policy with meaningful but incomplete safeguards. Leave at least four rubric safeguards unmet so two strict revision stages can be evaluated.",
          inheritedLessons.length
            ? `Prior verified lessons: ${inheritedLessons.map((lesson) => lesson.safePatchStrategy).join(" ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    revise: ({ task, previous, critique, revision, userPrompt }) =>
      produce(
        [
          "Return a JSON object with 'policy' (matching the DataPolicy schema) and 'solutionDocument' (a revised, updated markdown formatted roadmap, guide, or policy document).",
          `Task: ${task.publicSummary}`,
          userPrompt ? `Domain scenario / User guidance: ${userPrompt}` : "",
          `This is ${revision}; preserve valid controls and tailor fields and written text to the domain scenario while addressing the evaluator critique.`,
          `Previous policy: ${JSON.stringify(previous.policy)}`,
          `Failed checks: ${critique.failureCodes.join(", ")}`,
          `Repair plan: ${critique.repairPlan.join(" ")}`,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
  };
}

export function createGeminiCritic(config: {
  apiKey: string;
  model: string;
}): PolicyCritic {
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  return {
    async critique({ task, version, userPrompt }) {
      const deterministicFallback = deterministicCritique(
        version.id as "V1" | "V2",
        version.evaluation,
      );

      const prompt = [
        "You are an independent adversarial AI security auditor in AutoEvolve Protocol.",
        `Scenario / Target Objective: ${userPrompt || task.publicSummary}`,
        `Auditing Version: ${version.id}`,
        `Current Score: ${version.evaluation.score}/100`,
        `Failed Rubric Checks: ${version.evaluation.failureCodes.join(", ") || "None"}`,
        `Current Policy Config: ${JSON.stringify(version.policy)}`,
        version.solutionDocument
          ? `Current Document Excerpt:\n${version.solutionDocument.slice(0, 1000)}`
          : "",
        "Critique this candidate strictly in the context of the user's domain prompt.",
        "Return ONLY a JSON object with two keys:",
        '  "summary": A sharp 1-2 paragraph audit finding explaining specifically why this version is inadequate or risky for the given scenario.',
        '  "repairPlan": An array of concrete, actionable repair steps addressing both the domain requirements and failed rubric controls.',
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const response = await (
          client.models.generateContent as unknown as (
            args: unknown,
          ) => Promise<{
            text?: string;
          }>
        )({
          model: config.model,
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });

        const cleaned = cleanJsonText(response.text ?? "");
        const parsed = JSON.parse(cleaned) as {
          summary?: string;
          repairPlan?: string[];
        };

        return {
          fromVersion: version.id as "V1" | "V2",
          summary:
            typeof parsed?.summary === "string" && parsed.summary.trim()
              ? parsed.summary.trim()
              : `Gemini AI critic (${config.model}): ${deterministicFallback.summary}`,
          failureCodes: version.evaluation.failureCodes,
          repairPlan:
            Array.isArray(parsed?.repairPlan) && parsed.repairPlan.length > 0
              ? parsed.repairPlan.map(String)
              : deterministicFallback.repairPlan,
          author: "gemini-critic",
        };
      } catch {
        return {
          fromVersion: version.id as "V1" | "V2",
          summary: `Gemini critic fallback: ${deterministicFallback.summary}`,
          failureCodes: version.evaluation.failureCodes,
          repairPlan: deterministicFallback.repairPlan,
          author: "deterministic-critic",
        };
      }
    },
  };
}
