import { describe, expect, it } from "vitest";
import { createDeterministicCritic, runAgentLoop } from "./agent";
import { dataDaoPolicyTask, fixturePolicies } from "./fixtures";
import type { PolicyGenerator } from "./types";

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
  it("explicitly substitutes a deterministic baseline when a model starts too strong", async () => {
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

  it("keeps a model candidate that can support both strict revision stages", async () => {
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

  it("uses the guardrail when a V3 model revision does not complete the rubric", async () => {
    const run = await runAgentLoop({
      generator: generatorWith(
        fixturePolicies.V1,
        fixturePolicies.V2,
        fixturePolicies.V2,
      ),
      critic: createDeterministicCritic(),
      task: dataDaoPolicyTask,
    });

    expect(run.versions[2].evaluation.score).toBe(100);
    expect(run.versions[2].source).toBe("guarded-revision");
  });
});
