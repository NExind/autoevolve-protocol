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
import {
  cleanJsonText,
  parseGeneratedPolicyJson,
  synthesizeDefaultSolutionDocument,
} from "./agent";
import { deterministicCritique } from "./evaluator";
import type {
  Critique,
  PolicyCritic,
  PolicyGenerator,
  PolicyVersion,
  TaskDefinition,
  VersionId,
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

async function generateFeatherlessDocumentText(
  client: OpenAI,
  model: string,
  userPrompt: string | undefined,
  task: TaskDefinition,
  version: VersionId,
  critiqueSummary?: string,
): Promise<string> {
  const effectivePrompt = userPrompt || task.publicSummary;
  const versionInstructions =
    version === "V1"
      ? "Write the Initial Baseline Draft (V1). Provide an introductory executive overview, foundational modules/milestones, tools, and technical breakdown. Note any open challenges, provisional assumptions, or areas needing hardening."
      : version === "V2"
        ? `Write the Guarded Revision (V2). Incorporate improvements addressing the adversarial audit critique: "${critiqueSummary || "Harden defensive controls and add comprehensive verification."}". Detail enhanced modules, practical security/hardening controls, and deeper technical depth.`
        : "Write the Final Production-Ready Solution (V3). Provide a complete, hardened, production-grade deliverable with end-to-end tooling, operational verification checkpoints, and production sign-offs.";

  const prompt = [
    "You are an expert technical lead and domain architect.",
    `Objective: ${effectivePrompt}`,
    `Document Stage: Version ${version}`,
    versionInstructions,
    "Format your response in clean, professional GitHub-flavored Markdown. Include a main title (# ...), structured subheadings (##, ###), bullet lists, and technical specifics. Do NOT wrap the entire response in a JSON object or code block. Return direct Markdown text.",
  ].join("\n\n");

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical architect and author. You write comprehensive, structured, professional Markdown documentation directly addressing user objectives.",
        },
        { role: "user", content: prompt },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
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

  const producePolicy = async (prompt: string) => {
    const raw = await chat(client, config.model, systemPrompt, prompt);
    try {
      const parsed = JSON.parse(cleanJsonText(raw)) as Record<string, unknown>;
      const target =
        parsed &&
        typeof parsed === "object" &&
        "policy" in parsed &&
        typeof (parsed as Record<string, unknown>).policy === "object"
          ? ((parsed as Record<string, unknown>).policy as Record<
              string,
              unknown
            >)
          : parsed;

      if (target && typeof target === "object") {
        if (typeof target.minKAnonymity === "number") {
          target.minKAnonymity = Math.max(
            0,
            Math.min(255, Math.round(target.minKAnonymity)),
          );
        }
        if (typeof target.maxExportRows === "number") {
          target.maxExportRows = Math.max(
            1,
            Math.min(16383, Math.round(target.maxExportRows)),
          );
        }
        if (typeof target.retentionDays === "number") {
          target.retentionDays = Math.max(
            1,
            Math.min(63, Math.round(target.retentionDays)),
          );
        }
        if (typeof target.dailyRequestLimit === "number") {
          target.dailyRequestLimit = Math.max(
            1,
            Math.min(127, Math.round(target.dailyRequestLimit)),
          );
        }
        return parseGeneratedPolicyJson(
          JSON.stringify(parsed),
          `featherless:${config.model}`,
        );
      }
    } catch {
      // Let parseGeneratedPolicyJson handle malformed JSON
    }
    return parseGeneratedPolicyJson(raw, `featherless:${config.model}`);
  };

  return {
    generateInitial: async ({ task, inheritedLessons, userPrompt }) => {
      const policyPrompt = [
        DATA_POLICY_SCHEMA_SPEC,
        `Task: ${task.publicSummary}`,
        userPrompt ? `Domain scenario / User guidance: ${userPrompt}` : "",
        "Create a plausible initial policy with meaningful but incomplete safeguards. Leave at least four rubric safeguards unmet so two strict revision stages can be evaluated.",
        inheritedLessons.length
          ? `Prior verified lessons: ${inheritedLessons.map((l) => l.safePatchStrategy).join(" ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const [policyResult, docText] = await Promise.all([
        producePolicy(policyPrompt),
        generateFeatherlessDocumentText(
          client,
          config.model,
          userPrompt,
          task,
          "V1",
        ).catch(() => ""),
      ]);

      return {
        ...policyResult,
        solutionDocument:
          docText ||
          synthesizeDefaultSolutionDocument(
            "V1",
            policyResult.policy,
            userPrompt,
            task,
          ),
      };
    },

    revise: async ({ task, previous, critique, revision, userPrompt }) => {
      const revisePrompt = [
        DATA_POLICY_SCHEMA_SPEC,
        `Task: ${task.publicSummary}`,
        userPrompt ? `Domain scenario / User guidance: ${userPrompt}` : "",
        `This is ${revision}; preserve valid controls and tailor fields to the domain scenario while addressing the evaluator critique.`,
        `Previous policy: ${JSON.stringify(previous.policy)}`,
        `Failed checks: ${critique.failureCodes.join(", ")}`,
        `Repair plan: ${critique.repairPlan.join(" ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      const [policyResult, docText] = await Promise.all([
        producePolicy(revisePrompt),
        generateFeatherlessDocumentText(
          client,
          config.model,
          userPrompt,
          task,
          revision,
          critique.summary,
        ).catch(() => ""),
      ]);

      return {
        ...policyResult,
        solutionDocument:
          docText ||
          synthesizeDefaultSolutionDocument(
            revision,
            policyResult.policy,
            userPrompt,
            task,
          ),
      };
    },
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
      task,
      version,
      userPrompt,
    }: {
      task: TaskDefinition;
      version: PolicyVersion;
      userPrompt?: string;
    }): Promise<Critique> {
      // Deterministic fallback values so we never propagate an empty critique.
      const deterministicFallback = deterministicCritique(
        version.id as "V1" | "V2",
        version.evaluation,
      );

      const prompt = [
        "You are an independent adversarial AI security auditor in AutoEvolve Protocol.",
        `Scenario / Target Objective: ${userPrompt || task.publicSummary}`,
        `Auditing Version: ${version.id}`,
        `Current Score: ${version.evaluation.score}/100`,
        `Failed Rubric Codes: ${version.evaluation.failureCodes.join(", ") || "None"}`,
        `Current Policy: ${JSON.stringify(version.policy)}`,
        version.solutionDocument
          ? `Current Document Excerpt:\n${version.solutionDocument.slice(0, 1000)}`
          : "",
        "Critique this candidate strictly in the context of the user's domain prompt.",
        "Return ONLY a JSON object with two keys:",
        '  "summary": A concise plain-text audit finding explaining specifically why this version is inadequate or risky for the given scenario.',
        '  "repairPlan": An array of short actionable strings addressing the domain requirements and failed rubric checks.',
      ]
        .filter(Boolean)
        .join("\n");

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
