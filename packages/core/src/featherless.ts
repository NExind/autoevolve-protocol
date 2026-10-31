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

const DATA_POLICY_SCHEMA_SPEC = `You must return a raw JSON object with EXACTLY these 10 fields and NO others:
{
  "requireConsent": boolean,
  "redactDirectIdentifiers": boolean,
  "researchPurposeOnly": boolean,
  "auditLogging": boolean,
  "blockRestrictedRegions": boolean,
  "requireDualApprovalHighVolume": boolean,
  "minKAnonymity": integer between 0 and 20 (passing is >= 5),
  "maxExportRows": integer between 500 and 15000 (passing is <= 10000),
  "retentionDays": integer between 1 and 60 (passing is <= 30),
  "dailyRequestLimit": integer between 1 and 120 (passing is <= 100)
}

STRICT CIRCUIT BITWIDTH BOUNDARIES (values outside will fail schema validation):
- minKAnonymity: must be between 0 and 255
- maxExportRows: must be between 1 and 16383 (strict upper limit: 16383)
- retentionDays: must be between 1 and 63 (strict upper limit: 63)
- dailyRequestLimit: must be between 1 and 127 (strict upper limit: 127)

Rubric criteria to achieve up to 100 points:
- requireConsent must be true (+10 pts)
- redactDirectIdentifiers must be true (+10 pts)
- researchPurposeOnly must be true (+10 pts)
- auditLogging must be true (+10 pts)
- blockRestrictedRegions must be true (+10 pts)
- requireDualApprovalHighVolume must be true (+10 pts)
- minKAnonymity must be >= 5 (+10 pts)
- maxExportRows must be <= 10000 (+10 pts)
- retentionDays must be <= 30 (+10 pts)
- dailyRequestLimit must be <= 100 (+10 pts)`;

function makeOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: FEATHERLESS_BASE_URL });
}

async function chat(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
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
  const systemPrompt =
    "You are an autonomous AI policy engine. Output raw JSON only adhering strictly to the required DataPolicy schema with no wrapping key and no conversational filler.";

  const produce = async (prompt: string) => {
    const raw = await chat(client, config.model, systemPrompt, prompt);
    return parseGeneratedPolicyJson(raw, `featherless:${config.model}`);
  };

  return {
    generateInitial: ({ task, inheritedLessons, userPrompt }) =>
      produce(
        [
          "Return only a flat JSON object matching this exact schema specification, with no wrapping key and no commentary.",
          DATA_POLICY_SCHEMA_SPEC,
          `Task: ${task.publicSummary}`,
          userPrompt ? `Domain scenario / User guidance: ${userPrompt}` : "",
          "Tailor all policy fields specifically to the given task and domain scenario. Create a plausible initial policy with meaningful but incomplete safeguards. Leave at least four rubric safeguards unmet so two strict revision stages can be evaluated.",
          inheritedLessons.length
            ? `Prior verified lessons: ${inheritedLessons.map((l) => l.safePatchStrategy).join(" ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),

    revise: ({ task, previous, critique, revision, userPrompt }) =>
      produce(
        [
          "Return only a flat JSON object matching this exact schema specification, with no wrapping key and no commentary.",
          DATA_POLICY_SCHEMA_SPEC,
          `Task: ${task.publicSummary}`,
          userPrompt ? `Domain scenario / User guidance: ${userPrompt}` : "",
          `This is ${revision}; preserve valid controls and tailor fields to the domain scenario while addressing the evaluator critique.`,
          `Previous policy: ${JSON.stringify(previous.policy)}`,
          `Failed checks: ${critique.failureCodes.join(", ")}`,
          `Repair plan: ${critique.repairPlan.join(" ")}`,
        ]
          .filter(Boolean)
          .join("\n"),
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
  const systemPrompt =
    "You are an independent data-policy security auditor. Return a raw JSON object with keys 'summary' and 'repairPlan'.";

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
        "Critique the following DataPolicy JSON against these failed rubric checks.",
        "Return ONLY a JSON object with two keys:",
        '  "summary": a one-paragraph plain-text audit finding,',
        '  "repairPlan": an array of short actionable strings, one per failed check.',
        `Policy: ${JSON.stringify(version.policy)}`,
        `Failed rubric codes: ${version.evaluation.failureCodes.join(", ")}`,
        `Current score: ${version.evaluation.score}/100`,
      ].join("\n");

      try {
        const raw = await chat(client, config.model, systemPrompt, prompt);
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
