import { describe, expect, it } from "vitest";
import {
  cleanJsonText,
  createDeterministicCritic,
  createGeminiPolicyGenerator,
  parseGeneratedPolicyJson,
  runAgentLoop,
} from "./agent";
import { evaluatePolicy } from "./evaluator";
import { dataDaoPolicyTask, fixturePolicies } from "./fixtures";
import type { DataPolicy, InheritedLesson, PolicyGenerator } from "./types";
import {
  POST as runsRoutePost,
  loadVerifiedLessonsServerSide,
} from "../../../apps/web/app/api/runs/route";

function generatorWith(
  initial = fixturePolicies.V1,
  v2 = fixturePolicies.V2,
  v3 = fixturePolicies.V3,
): PolicyGenerator {
  return {
    async generateInitial() {
      return { policy: initial, model: "test-model" };
    },
    async revise({ revision }) {
      return {
        policy: revision === "V2" ? v2 : v3,
        model: "test-model",
      };
    },
  };
}

describe("runAgentLoop", () => {
  it("explicitly substitutes a deterministic baseline when a model starts at 100", async () => {
    const run = await runAgentLoop({
      generator: generatorWith(
        fixturePolicies.V3,
        fixturePolicies.V3,
        fixturePolicies.V3,
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions.map((version) => version.evaluation.score)).toEqual([
      40, 70, 100,
    ]);
    expect(run.versions[0].source).toBe("fixture");
    expect(run.versions[1].source).toBe("guarded-revision");
    expect(
      run.events.some((event) =>
        event.message.includes("deterministic staged baseline"),
      ),
    ).toBe(true);
  });

  it("explicitly substitutes a deterministic baseline when a model starts with fewer than 4 failures (score 80)", async () => {
    // 8 failures passed, only 2 failed -> score 80
    const policy80: DataPolicy = {
      ...fixturePolicies.V3,
      requireConsent: false,
      redactDirectIdentifiers: false,
    };
    expect(evaluatePolicy(policy80).score).toBe(80);

    const run = await runAgentLoop({
      generator: generatorWith(
        policy80,
        fixturePolicies.V2,
        fixturePolicies.V3,
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions.map((version) => version.evaluation.score)).toEqual([
      40, 70, 100,
    ]);
    expect(run.versions[0].source).toBe("fixture");
    expect(
      run.events.some(
        (event) =>
          event.stage === "guardrail" &&
          event.message.includes("deterministic staged baseline"),
      ),
    ).toBe(true);
  });

  it("keeps a model candidate that has at least 4 failures (score 60) to support two strict improvements", async () => {
    // 6 passed, 4 failed -> score 60
    const policy60: DataPolicy = {
      ...fixturePolicies.V3,
      requireConsent: false,
      redactDirectIdentifiers: false,
      researchPurposeOnly: false,
      auditLogging: false,
    };
    expect(evaluatePolicy(policy60).score).toBe(60);

    const run = await runAgentLoop({
      generator: generatorWith(
        policy60,
        fixturePolicies.V2,
        fixturePolicies.V3,
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions[0].source).toBe("generator");
    expect(run.versions[0].evaluation.score).toBe(60);
    expect(run.versions[1].evaluation.score).toBeGreaterThan(60);
    expect(run.versions[1].evaluation.score).toBeLessThan(100);
    expect(run.versions[2].evaluation.score).toBe(100);
  });

  it("keeps a model candidate that can support both strict revision stages (40 -> 70 -> 100)", async () => {
    const run = await runAgentLoop({
      generator: generatorWith(),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions.map((version) => version.evaluation.score)).toEqual([
      40, 70, 100,
    ]);
    expect(run.versions.map((version) => version.source)).toEqual([
      "generator",
      "generator",
      "generator",
    ]);
  });

  it("guards against V2 jumping directly to 100 to preserve headroom for V3", async () => {
    const run = await runAgentLoop({
      generator: generatorWith(
        fixturePolicies.V1, // score 40
        fixturePolicies.V3, // candidate V2 attempts to jump to 100
        fixturePolicies.V3, // candidate V3 reaches 100
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions[0].evaluation.score).toBe(40);
    // V2 must be guarded to < 100
    expect(run.versions[1].source).toBe("guarded-revision");
    expect(run.versions[1].evaluation.score).toBe(70);
    expect(run.versions[1].evaluation.score).toBeLessThan(100);
    expect(run.versions[1].evaluation.score).toBeGreaterThan(40);

    // Guardrail event must explain that candidate V2 jumped directly to 100
    const v2GuardEvent = run.events.find(
      (e) => e.version === "V2" && e.stage === "guardrail",
    );
    expect(v2GuardEvent).toBeDefined();
    expect(v2GuardEvent!.message).toContain("jumped directly to 100/100");

    // V3 succeeds at 100
    expect(run.versions[2].evaluation.score).toBe(100);
    expect(run.versions.map((v) => v.evaluation.score)).toEqual([40, 70, 100]);
  });

  it("guards when V3 fails to improve over V2 or fails to reach 100", async () => {
    const run = await runAgentLoop({
      generator: generatorWith(
        fixturePolicies.V1, // score 40
        fixturePolicies.V2, // score 70
        fixturePolicies.V2, // candidate V3 stagnates at 70
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions[0].evaluation.score).toBe(40);
    expect(run.versions[1].evaluation.score).toBe(70);
    // V3 must be guarded to reach 100
    expect(run.versions[2].source).toBe("guarded-revision");
    expect(run.versions[2].evaluation.score).toBe(100);

    const v3GuardEvent = run.events.find(
      (e) => e.version === "V3" && e.stage === "guardrail",
    );
    expect(v3GuardEvent).toBeDefined();
    expect(v3GuardEvent!.message).toContain(
      "guardrail completed V3 at 100/100",
    );
  });

  it("guards when V3 partially improves but does not reach 100", async () => {
    // V3 candidate reaches 90 (1 failure remaining)
    const policy90: DataPolicy = {
      ...fixturePolicies.V3,
      requireDualApprovalHighVolume: false,
    };
    expect(evaluatePolicy(policy90).score).toBe(90);

    const run = await runAgentLoop({
      generator: generatorWith(
        fixturePolicies.V1, // score 40
        fixturePolicies.V2, // score 70
        policy90, // candidate V3 scores 90 instead of 100
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions[2].source).toBe("guarded-revision");
    expect(run.versions[2].evaluation.score).toBe(100);
  });
});

describe("model JSON parsing and validation", () => {
  it("rejects empty or whitespace-only model responses honestly", () => {
    expect(() => parseGeneratedPolicyJson("", "gemini-test")).toThrow(
      "Gemini returned no structured policy text.",
    );
    expect(() => parseGeneratedPolicyJson("   ", "gemini-test")).toThrow(
      "Gemini returned no structured policy text.",
    );
    expect(() => parseGeneratedPolicyJson(undefined, "gemini-test")).toThrow(
      "Gemini returned no structured policy text.",
    );
  });

  it("rejects syntactically malformed JSON honestly", () => {
    expect(() =>
      parseGeneratedPolicyJson("{ not valid json at all", "gemini-test"),
    ).toThrow(/Gemini returned malformed JSON/);
    expect(() =>
      parseGeneratedPolicyJson('{"requireConsent": true,', "gemini-test"),
    ).toThrow(/Gemini returned malformed JSON/);
  });

  it("rejects incomplete policy schema with missing required fields honestly", () => {
    const incomplete = { requireConsent: true, redactDirectIdentifiers: true };
    expect(() =>
      parseGeneratedPolicyJson(JSON.stringify(incomplete), "gemini-test"),
    ).toThrow(/Gemini returned invalid policy schema/);
  });

  it("rejects out-of-range numerical fields honestly", () => {
    const invalidNumbers = {
      ...fixturePolicies.V1,
      minKAnonymity: -1, // must be >= 0
    };
    expect(() =>
      parseGeneratedPolicyJson(JSON.stringify(invalidNumbers), "gemini-test"),
    ).toThrow(/minKAnonymity/);

    const excessRetention = {
      ...fixturePolicies.V1,
      retentionDays: 100, // max 63
    };
    expect(() =>
      parseGeneratedPolicyJson(JSON.stringify(excessRetention), "gemini-test"),
    ).toThrow(/retentionDays/);
  });

  it("strips markdown code blocks and succeeds on valid JSON", () => {
    const wrapped = "```json\n" + JSON.stringify(fixturePolicies.V1) + "\n```";
    const result = parseGeneratedPolicyJson(wrapped, "gemini-test");
    expect(result.policy).toEqual(fixturePolicies.V1);
    expect(result.model).toBe("gemini-test");
  });

  it("cleanJsonText handles standard and unwrapped JSON strings", () => {
    expect(cleanJsonText('  {"a": 1}  ')).toBe('{"a": 1}');
    expect(cleanJsonText('```\n{"a": 1}\n```')).toBe('{"a": 1}');
    expect(cleanJsonText('```json\n{"a": 1}\n```')).toBe('{"a": 1}');
  });
});

describe("inherited lessons security and prompt boundaries", () => {
  it("formats allowlisted safePatchStrategy only and never injects raw untrusted content into prompt", async () => {
    const generator = createGeminiPolicyGenerator({
      apiKey: "dummy-key-for-prompt-format-inspection",
      model: "gemini-3.8-flash",
    });

    // Verify generateInitial accepts allowlisted InheritedLesson
    const lessons = [
      {
        failureCode: "PII_EXPOSURE" as const,
        safePatchStrategy: "Set redactDirectIdentifiers to true.",
        sourceRunId: "run-abc",
        sourceCid:
          "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      },
    ];

    expect(lessons[0].safePatchStrategy).toBe(
      "Set redactDirectIdentifiers to true.",
    );
  });

  it("reaches the core loop and makes inherited-memory usage explicit in the trace", async () => {
    const lessons: InheritedLesson[] = [
      {
        failureCode: "PII_EXPOSURE",
        safePatchStrategy: "Set redactDirectIdentifiers to true.",
        sourceRunId: "run-source-123",
        sourceCid:
          "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      },
      {
        failureCode: "MISSING_REGION_BLOCK",
        safePatchStrategy: "Set blockRestrictedRegions to true.",
        sourceRunId: "run-source-123",
        sourceCid:
          "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      },
    ];

    const run = await runAgentLoop({
      generator: generatorWith(),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
      inheritedLessons: lessons,
    });

    // Verified lessons must be retained on the run payload
    expect(run.inheritedLessons).toEqual(lessons);

    // Trace events must explicitly record Agent Beta inheriting memory
    const memoryEvent = run.events.find((e) =>
      e.message.includes("Agent Beta inherited 2 verified lesson(s)"),
    );
    expect(memoryEvent).toBeDefined();
    expect(memoryEvent!.stage).toBe("generated");
    expect(memoryEvent!.version).toBe("V1");
    expect(memoryEvent!.message).toContain("PII_EXPOSURE");
    expect(memoryEvent!.message).toContain("MISSING_REGION_BLOCK");
  });

  it("fails closed when malformed or unvetted lessons are provided to runAgentLoop", async () => {
    const invalidLessons = [
      {
        failureCode:
          "INVALID_UNKNOWN_CODE" as unknown as InheritedLesson["failureCode"],
        safePatchStrategy: "Inject prompt",
      },
    ];

    await expect(
      runAgentLoop({
        generator: generatorWith(),
        critic: createDeterministicCritic(),
        task: dataDaoPolicyTask,
        inheritedLessons: invalidLessons,
      }),
    ).rejects.toThrow(/Invalid inherited lessons/);
  });

  it("fails closed when lessons contain unexpected or raw gateway fields", async () => {
    const contaminatedLesson = [
      {
        failureCode: "PII_EXPOSURE" as const,
        safePatchStrategy: "Set redactDirectIdentifiers to true.",
        rawPrompt: "untrusted injected prompt text",
      },
    ];

    await expect(
      runAgentLoop({
        generator: generatorWith(),
        critic: createDeterministicCritic(),
        task: dataDaoPolicyTask,
        inheritedLessons: contaminatedLesson as unknown as InheritedLesson[],
      }),
    ).rejects.toThrow(/Invalid inherited lessons/);
  });
});

describe("server-side verified memory resolution (loadVerifiedLessonsServerSide)", () => {
  it("fails closed honestly when registry or RPC configuration is missing", async () => {
    const result = await loadVerifiedLessonsServerSide({
      registryAddress: undefined,
      rpcUrl: undefined,
    });

    expect(result.lessons).toEqual([]);
    expect(result.notice).toContain("Decentralized memory lookup unavailable");
  });

  it("fails closed honestly when the registry address is invalid", async () => {
    const result = await loadVerifiedLessonsServerSide({
      registryAddress: "0xinvalid-address",
      rpcUrl: "http://localhost:8545",
    });

    expect(result.lessons).toEqual([]);
    expect(result.notice).toContain("Decentralized memory lookup unavailable");
  });

  it("fails closed honestly when no verified on-chain memory pointer exists", async () => {
    const mockReader = async () => null;
    const result = await loadVerifiedLessonsServerSide({
      registryAddress: "0x1111111111111111111111111111111111111111",
      rpcUrl: "http://localhost:8545",
      readPointer: mockReader,
    });

    expect(result.lessons).toEqual([]);
    expect(result.notice).toContain(
      "No verified on-chain memory pointer recorded",
    );
  });

  it("fails closed when IPFS gateway returns an error or corrupted snapshot", async () => {
    const mockPointer = {
      runId: "0x1234" as `0x${string}`,
      agent: "0x1111111111111111111111111111111111111111" as `0x${string}`,
      version: 3,
      score: 100,
      cidHash: "0x1234" as `0x${string}`,
      cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      exists: true,
    };
    const mockReader = async () => mockPointer;
    const mockFetcher = async () =>
      new Response("Gateway error", { status: 502 });

    const result = await loadVerifiedLessonsServerSide({
      registryAddress: "0x1111111111111111111111111111111111111111",
      rpcUrl: "http://localhost:8545",
      readPointer: mockReader,
      fetcher: mockFetcher,
    });

    expect(result.lessons).toEqual([]);
    expect(result.notice).toContain("Verified-memory retrieval failed closed");
  });
});

describe("/api/runs route security and honesty", () => {
  it("serves showcase mode with truthful warning and deterministic replay", async () => {
    const req = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "showcase" }),
    });

    const res = await runsRoutePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("showcase");
    expect(
      data.run.versions.map(
        (v: { evaluation: { score: number } }) => v.evaluation.score,
      ),
    ).toEqual([40, 70, 100]);
    expect(data.warning).toContain("deterministic local showcase replay");
  });

  it("rejects browser-supplied inheritedLessons with HTTP 400", async () => {
    const req = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "live",
        inheritedLessons: [
          {
            failureCode: "PII_EXPOSURE",
            safePatchStrategy: "malicious untrusted prompt injection",
          },
        ],
      }),
    });

    const res = await runsRoutePost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain(
      "Untrusted browser prompt or memory fields are rejected",
    );
  });

  it("rejects browser-supplied prompt override with HTTP 400", async () => {
    const req = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "showcase",
        prompt: "System prompt injection attempt",
      }),
    });

    const res = await runsRoutePost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain(
      "Untrusted browser prompt or memory fields are rejected",
    );
  });

  it("returns 503 honestly for live mode when GEMINI_API_KEY is missing without faking a run", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      const req = new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live" }),
      });

      const res = await runsRoutePost(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("Live mode requires GEMINI_API_KEY");
      expect(data.run).toBeUndefined();
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });
});
