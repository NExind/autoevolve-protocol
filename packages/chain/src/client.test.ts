import { describe, expect, it } from "vitest";
import {
  buildPublicSignals,
  bytes32ToLimbs,
  hashTaskId,
  hashUtf8ToBytes32,
  keccakToLimbs,
  settlementArtifactToSolidityProof,
  textOrBytes32ToHash,
} from "./client";

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

  it("rejects public score inputs that do not represent strict improvement", () => {
    const baseInput = {
      previousPolicyCommitment: 1n,
      nextPolicyCommitment: 2n,
      runId:
        "0x0000000000000000000000000000000000000000000000000000000000000001" as const,
      cid: "bafybeigdyrztshowcasecidplaceholder",
      agent: "0x0000000000000000000000000000000000000001" as const,
      stage: 2 as const,
      rubricHash:
        "0x0000000000000000000000000000000000000000000000000000000000000002" as const,
      binding: 3n,
    };

    // nextScore equal to previousScore
    expect(() =>
      buildPublicSignals({ ...baseInput, previousScore: 50, nextScore: 50 }),
    ).toThrow("strict improvement");

    // nextScore less than previousScore
    expect(() =>
      buildPublicSignals({ ...baseInput, previousScore: 70, nextScore: 40 }),
    ).toThrow("strict improvement");

    // scores out of bounds
    expect(() =>
      buildPublicSignals({ ...baseInput, previousScore: -1, nextScore: 70 }),
    ).toThrow("strict improvement");

    expect(() =>
      buildPublicSignals({ ...baseInput, previousScore: 40, nextScore: 101 }),
    ).toThrow("strict improvement");
  });

  it("rejects commitments that exceed the BN254 scalar field", () => {
    const snarkScalarField =
      21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    expect(() =>
      buildPublicSignals({
        previousPolicyCommitment: snarkScalarField,
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
      }),
    ).toThrow("BN254 scalar field");
  });
});

describe("textOrBytes32ToHash and limb helpers", () => {
  it("preserves a bytes32 value and hashes arbitrary text", () => {
    const bytes32 =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    expect(textOrBytes32ToHash(bytes32)).toBe(bytes32);
    expect(textOrBytes32ToHash("showcase-run")).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hashTaskId("task-123")).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("splits hashes into low and high 128-bit limbs", () => {
    const limbs = bytes32ToLimbs(
      "0x0000000000000000000000000000000100000000000000000000000000000002",
    );
    expect(limbs.low).toBe(2n);
    expect(limbs.high).toBe(1n);

    const cidLimbs = keccakToLimbs("bafytest");
    expect(cidLimbs.low).toBeGreaterThan(0n);
    expect(cidLimbs.high).toBeGreaterThan(0n);
  });

  it("converts string settlement artifact to viem Solidity bigints", () => {
    const artifact = {
      proof: {
        a: ["101", "102"] as const,
        b: [["201", "202"] as const, ["203", "204"] as const] as const,
        c: ["301", "302"] as const,
      },
      publicSignals: [
        "40",
        "70",
        "3",
        "1",
        "2",
        "100",
        "200",
        "300",
        "400",
        "500",
        "2",
        "600",
        "700",
      ],
    };
    const solidity = settlementArtifactToSolidityProof(artifact);
    expect(solidity.proof.a).toEqual([101n, 102n]);
    expect(solidity.proof.b).toEqual([
      [201n, 202n],
      [203n, 204n],
    ]);
    expect(solidity.proof.c).toEqual([301n, 302n]);
    expect(solidity.publicSignals).toHaveLength(13);
    expect(solidity.publicSignals[0]).toBe(40n);
    expect(solidity.publicSignals[1]).toBe(70n);
  });

  it("rejects settlement artifact with invalid public signal count", () => {
    const artifact = {
      proof: {
        a: ["1", "2"] as const,
        b: [["1", "2"] as const, ["3", "4"] as const] as const,
        c: ["1", "2"] as const,
      },
      publicSignals: ["40", "70"],
    };
    expect(() => settlementArtifactToSolidityProof(artifact)).toThrow(
      "Expected exactly 13 Groth16 public signals",
    );
  });
});
