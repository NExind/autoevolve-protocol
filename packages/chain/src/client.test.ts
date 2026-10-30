import { describe, expect, it } from "vitest";
import { buildPublicSignals } from "./client";

describe("public-signal builder", () => {
  it("keeps the circuit/registry order at 13 values", () => {
    const signals = buildPublicSignals({
      previousPolicyCommitment: 1n,
      nextPolicyCommitment: 2n,
      runId:
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      cid: "bafybeigdyrztshowcasecidplaceholder",
      agent: "0x0000000000000000000000000000000000000001",
      stage: 2,
      rubricHash:
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      previousScore: 40,
      nextScore: 70,
      binding: 3n,
    });
    expect(signals).toHaveLength(13);
    expect(signals[0]).toBe(40n);
    expect(signals[1]).toBe(70n);
    expect(signals[2]).toBe(3n);
  });
});
