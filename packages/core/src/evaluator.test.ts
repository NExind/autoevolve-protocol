import { describe, expect, it } from "vitest";
import {
  applyGuardedImprovements,
  evaluatePolicy,
  isStrictImprovement,
} from "./evaluator";
import { fixturePolicies } from "./fixtures";

describe("policy evaluator", () => {
  it("scores the showcase policies 40, 70, and 100", () => {
    expect(evaluatePolicy(fixturePolicies.V1).score).toBe(40);
    expect(evaluatePolicy(fixturePolicies.V2).score).toBe(70);
    expect(evaluatePolicy(fixturePolicies.V3).score).toBe(100);
  });

  it("derives strict improvement from the evaluator rather than a claimed score", () => {
    const v1 = evaluatePolicy(fixturePolicies.V1);
    const v2 = evaluatePolicy(fixturePolicies.V2);
    expect(isStrictImprovement(v1, v2)).toBe(true);
    expect(isStrictImprovement(v2, v1)).toBe(false);
  });

  it("guardedly patches failed controls without weakening compliant ones", () => {
    const v1 = evaluatePolicy(fixturePolicies.V1);
    const repaired = applyGuardedImprovements(fixturePolicies.V1, v1, 3);
    expect(repaired.requireConsent).toBe(true);
    expect(repaired.redactDirectIdentifiers).toBe(true);
    expect(evaluatePolicy(repaired).score).toBeGreaterThan(v1.score);
  });
});
