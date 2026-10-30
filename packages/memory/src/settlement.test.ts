import { describe, expect, it } from "vitest";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { code as rawCodecCode } from "multiformats/codecs/raw";
import { keccak256, stringToHex } from "viem";
import { hashToUint128Limbs } from "@autoevolve/core";
import {
  loadLocalSettlementProofs,
  loadSettlementArtifact,
  loadSettlementReceipts,
} from "./settlement";
import type { SettlementArtifact, SettlementReceiptsArtifact } from "./types";
import {
  parseSettlementArtifact,
  parseSettlementReceipts,
  validateSettlementBinding,
} from "./validation";

async function validCid(value: string): Promise<string> {
  const digest = await sha256.digest(new TextEncoder().encode(value));
  return CID.createV1(rawCodecCode, digest).toString();
}

function createValidSettlementArtifact(
  overrides?: Partial<SettlementArtifact>,
): SettlementArtifact {
  return {
    schemaVersion: "autoevolve-settlement/v1",
    locallyVerified: true,
    verifiedAt: new Date().toISOString(),
    publicSignalOrder: "outputs-first-v1",
    proof: {
      a: ["123", "456"],
      b: [
        ["12", "34"],
        ["56", "78"],
      ],
      c: ["789", "1011"],
    },
    publicSignals: [
      "40", // previousScore
      "70", // nextScore
      "1", // binding
      "10", // previousPolicyCommitment
      "20", // nextPolicyCommitment
      "100", // runIdLow
      "200", // runIdHigh
      "300", // cidHashLow
      "400", // cidHashHigh
      "1", // agent
      "2", // stage
      "500", // rubricHashLow
      "600", // rubricHashHigh
    ],
    ...overrides,
  };
}

describe("Groth16 Settlement Artifact & Receipts Validation", () => {
  it("validates a compliant settlement artifact schema", () => {
    const artifact = createValidSettlementArtifact();
    const parsed = parseSettlementArtifact(artifact);
    expect(parsed.schemaVersion).toBe("autoevolve-settlement/v1");
    expect(parsed.locallyVerified).toBe(true);
    expect(parsed.publicSignals).toHaveLength(13);
  });

  it("rejects non-compliant settlement artifacts", () => {
    const base = createValidSettlementArtifact();

    // Wrong schema version
    expect(() =>
      parseSettlementArtifact({ ...base, schemaVersion: "v2" as never }),
    ).toThrow();

    // locallyVerified is false
    expect(() =>
      parseSettlementArtifact({ ...base, locallyVerified: false as never }),
    ).toThrow();

    // Wrong signal count
    expect(() =>
      parseSettlementArtifact({
        ...base,
        publicSignals: base.publicSignals.slice(0, 10),
      }),
    ).toThrow();

    // Non-improving score in signals
    expect(() =>
      parseSettlementArtifact({
        ...base,
        publicSignals: ["70", "40", ...base.publicSignals.slice(2)],
      }),
    ).toThrow("strictly improve");

    // Equal score
    expect(() =>
      parseSettlementArtifact({
        ...base,
        publicSignals: ["70", "70", ...base.publicSignals.slice(2)],
      }),
    ).toThrow("strictly improve");

    // Non-decimal proof strings
    expect(() =>
      parseSettlementArtifact({
        ...base,
        proof: { ...base.proof, a: ["abc", "123"] },
      }),
    ).toThrow();
  });

  it("validates public signal bindings to runId, CID, and stage", async () => {
    const cid = await validCid("test-binding-cid");
    const runId = "test-run-001";
    const cidHash = keccak256(stringToHex(cid));
    const cidLimbs = hashToUint128Limbs(cidHash);
    const runIdHash = keccak256(stringToHex(runId));
    const runLimbs = hashToUint128Limbs(runIdHash);

    const artifact = createValidSettlementArtifact({
      publicSignals: [
        "40",
        "70",
        "1",
        "10",
        "20",
        runLimbs.low.toString(),
        runLimbs.high.toString(),
        cidLimbs.low.toString(),
        cidLimbs.high.toString(),
        "1",
        "2", // stage 2
        "500",
        "600",
      ],
    });

    // Valid binding
    expect(() =>
      validateSettlementBinding(artifact, { runId, cid, stage: 2 }),
    ).not.toThrow();

    // Valid binding with only runId
    expect(() =>
      validateSettlementBinding(artifact, { runId, stage: 2 }),
    ).not.toThrow();

    // Valid binding with only cid
    expect(() =>
      validateSettlementBinding(artifact, { cid, stage: 2 }),
    ).not.toThrow();

    // Rejects non-canonical or invalid CID syntax
    expect(() =>
      validateSettlementBinding(artifact, {
        cid: "invalid-cid-syntax",
        stage: 2,
      }),
    ).toThrow("Expected a valid CIDv0 or CIDv1 IPFS identifier");

    // Wrong stage
    expect(() =>
      validateSettlementBinding(artifact, { runId, cid, stage: 3 }),
    ).toThrow("stage mismatch");

    // Wrong CID
    const wrongCid = await validCid("wrong-cid");
    expect(() =>
      validateSettlementBinding(artifact, { runId, cid: wrongCid, stage: 2 }),
    ).toThrow("CID hash binding mismatch");

    // Wrong runId
    expect(() =>
      validateSettlementBinding(artifact, {
        runId: "different-run",
        cid,
        stage: 2,
      }),
    ).toThrow("runId binding mismatch");
  });

  it("validates compliant settlement receipts artifact schema", async () => {
    const cid = await validCid("receipt-cid");
    const validReceipts: SettlementReceiptsArtifact = {
      network: "base-sepolia",
      registry: "0x1111111111111111111111111111111111111111",
      runId:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      taskHash:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      rubricHash:
        "0x3333333333333333333333333333333333333333333333333333333333333333",
      cid,
      agent: "0x4444444444444444444444444444444444444444",
      finalVersion: 3,
      finalScore: 100,
      receipts: {
        startRun:
          "0x4444444444444444444444444444444444444444444444444444444444444444",
        v1ToV2:
          "0x5555555555555555555555555555555555555555555555555555555555555555",
        v2ToV3:
          "0x6666666666666666666666666666666666666666666666666666666666666666",
      },
    };

    const parsed = parseSettlementReceipts(validReceipts);
    expect(parsed.network).toBe("base-sepolia");
    expect(parsed.finalScore).toBe(100);

    // Rejects non-Base Sepolia networks (never mainnet)
    expect(() =>
      parseSettlementReceipts({
        ...validReceipts,
        network: "mainnet" as never,
      }),
    ).toThrow();

    // Rejects invalid registry address
    expect(() =>
      parseSettlementReceipts({ ...validReceipts, registry: "0xinvalid" }),
    ).toThrow();
  });

  it("returns null when artifacts or receipts are not found on disk", async () => {
    const missingArtifact = await loadSettlementArtifact(
      "nonexistent/path/artifact.json",
    );
    expect(missingArtifact).toBeNull();

    const missingReceipts = await loadSettlementReceipts(
      "nonexistent/path/receipts.json",
    );
    expect(missingReceipts).toBeNull();

    const missingProofs = await loadLocalSettlementProofs({
      proofDir: "nonexistent/circuits/proofs",
    });
    expect(missingProofs).toBeNull();
  });
});
