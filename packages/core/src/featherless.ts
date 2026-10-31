/**
 * Featherless API provider for AutoEvolve Protocol.
 *
 * Featherless exposes an OpenAI-compatible endpoint at https://api.featherless.ai/v1.
 * When FEATHERLESS_API_KEY is present, the agent loop uses:
 *   - createFeatherlessPolicyGenerator: LLM-based policy generator
 *   - createFeatherlessCritic: adversarial LLM-based critic (separate model)
 *
 * Both fall back gracefully: the runner selects Gemini or deterministic critic
 * when the Featherless key is absent.
 */

import OpenAI from "openai";
import { cleanJsonText, parseGeneratedPolicyJson } from "./agent";
import { deterministicCritique } from "./evaluator";
import type {
  Critique,
  PolicyCritic,
  PolicyGenerator,
  PolicyVersion,
  TaskDefinition,
} from "./types";

const FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1";

function makeOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: FEATHERLESS_BASE_URL });
}

async function chat(
  client: OpenAI,
  model: string,
  content: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [{ role: "user", content }],
  });
  return response.choices[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function createFeatherlessPolicyGenerator(config: {
  apiKey: string;
  model: string;
}): PolicyGenerator {
  const client = makeOpenAIClient(config.apiKey);

  const produce = async (prompt: string) => {
    const raw = await chat(client, config.model, prompt);
    return parseGeneratedPolicyJson(raw, `featherless:${config.model}`);
  };

  return {
    generateInitial: ({ task, inheritedLessons }) =>
      produce(
        [
          "Return only a JSON DataPolicy object, no commentary.",
          `Task: ${task.publicSummary}`,
          "Create a plausible initial policy with meaningful but incomplete safeguards." +
            " Leave at least four rubric safeguards unmet so two strict revision stages can be evaluated.",
          inheritedLessons.length
            ? `Prior verified lessons: ${inheritedLessons.map((l) => l.safePatchStrategy).join(" ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),

    revise: ({ task, previous, critique, revision }) =>
      produce(
        [
          "Return only a JSON DataPolicy object, no commentary.",
          `Task: ${task.publicSummary}`,
          `This is ${revision}; preserve valid controls while addressing the evaluator critique.`,
          `Previous policy: ${JSON.stringify(previous.policy)}`,
          `Failed checks: ${critique.failureCodes.join(", ")}`,
          `Repair plan: ${critique.repairPlan.join(" ")}`,
        ].join("\n"),
      ),
  };
}

// ---------------------------------------------------------------------------
// Adversarial LLM Critic
// ---------------------------------------------------------------------------

interface FeatherlessCritiqueJson {
  summary?: string;
  repairPlan?: string[];
}

export function createFeatherlessCritic(config: {
  apiKey: string;
  model: string;
}): PolicyCritic {
  const client = makeOpenAIClient(config.apiKey);

  return {
    async critique({
      version,
    }: {
      task: TaskDefinition;
      version: PolicyVersion;
    }): Promise<Critique> {
      // Deterministic fallback values so we never propagate an empty critique.
      const deterministicFallback = deterministicCritique(
        version.id as "V1" | "V2",
        version.evaluation,
      );

      const prompt = [
        "You are an independent data-policy security auditor.",
        "Critique the following DataPolicy JSON against these failed rubric checks.",
        "Return ONLY a JSON object with two keys:",
        '  "summary": a one-paragraph plain-text audit finding,',
        '  "repairPlan": an array of short actionable strings, one per failed check.',
        `Policy: ${JSON.stringify(version.policy)}`,
        `Failed rubric codes: ${version.evaluation.failureCodes.join(", ")}`,
        `Current score: ${version.evaluation.score}/100`,
      ].join("\n");

      try {
        const raw = await chat(client, config.model, prompt);
        const cleaned = cleanJsonText(raw);
        const parsed = JSON.parse(cleaned) as FeatherlessCritiqueJson;

        return {
          fromVersion: version.id as "V1" | "V2",
          summary:
            parsed.summary?.trim() ||
            `Featherless adversarial critic (${config.model}): ${deterministicFallback.summary}`,
          failureCodes: version.evaluation.failureCodes,
          repairPlan:
            Array.isArray(parsed.repairPlan) && parsed.repairPlan.length > 0
              ? parsed.repairPlan
              : deterministicFallback.repairPlan,
          author: "featherless-critic",
        };
      } catch {
        // Fail closed: use deterministic critique so the agent loop never stalls.
        return {
          fromVersion: version.id as "V1" | "V2",
          summary: `Featherless critic unavailable; using deterministic fallback. ${deterministicFallback.summary}`,
          failureCodes: version.evaluation.failureCodes,
          repairPlan: deterministicFallback.repairPlan,
          author: "featherless-critic",
        };
      }
    },
  };
}
