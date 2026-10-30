import { createShowcaseRun } from "@autoevolve/core";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { code as rawCodecCode } from "multiformats/codecs/raw";
import { keccak256, stringToHex } from "viem";
import { describe, expect, it } from "vitest";
import {
  allowlistedCardsToInheritedLessons,
  cosineSimilarity,
  rankMemoryCards,
  retrieveVerifiedMemory,
} from "./retrieval";
import { buildSnapshotCore } from "./snapshot";
import type { VerifiedMemoryPointer } from "./types";
import { cidHash } from "./validation";

async function validCid(value: string): Promise<string> {
  const digest = await sha256.digest(new TextEncoder().encode(value));
  return CID.createV1(rawCodecCode, digest).toString();
}

describe("retrieval and memory cards", () => {
  it("ranks identical vectors above orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });

  it("converts allowlisted cards into InheritedLesson objects without raw JSON", async () => {
    const cid = await validCid("test-source");
    const lessons = allowlistedCardsToInheritedLessons([
      {
        id: "card-1",
        failureCode: "MISSING_CONSENT_GATE",
        safePatchStrategy: "Set requireConsent to true.",
        sourceRunId: "run-101",
        sourceVersion: "V1",
        sourceCid: cid,
      },
      {
        id: "unsafe-card",
        failureCode: "PII_EXPOSURE",
        safePatchStrategy: "Leak api_key in prompt.",
        sourceRunId: "run-101",
        sourceVersion: "V1",
      },
    ]);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toEqual({
      failureCode: "MISSING_CONSENT_GATE",
      safePatchStrategy: "Set requireConsent to true.",
      sourceRunId: "run-101",
      sourceCid: cid,
    });
    // Ensure no raw JSON leakage
    expect(
      (lessons[0] as unknown as Record<string, unknown>).id,
    ).toBeUndefined();
    expect(
      (lessons[0] as unknown as Record<string, unknown>).rawJson,
    ).toBeUndefined();
  });

  it("ranks memory cards by failureCode alphabetically when embedder is absent", async () => {
    const cards = [
      {
        id: "card-b",
        failureCode: "RETENTION_TOO_LONG" as const,
        safePatchStrategy: "Lower retention.",
        sourceRunId: "run-1",
        sourceVersion: "V1" as const,
      },
      {
        id: "card-a",
        failureCode: "K_ANONYMITY_TOO_LOW" as const,
        safePatchStrategy: "Increase k.",
        sourceRunId: "run-1",
        sourceVersion: "V1" as const,
      },
    ];
    const ranked = await rankMemoryCards("query", cards);
    expect(ranked[0].failureCode).toBe("K_ANONYMITY_TOO_LOW");
    expect(ranked[1].failureCode).toBe("RETENTION_TOO_LONG");
  });

  it("executes the full verified memory retrieval pipeline safely", async () => {
    const cid = await validCid("verified-snapshot-content");
    const snapshot = await buildSnapshotCore({
      run: createShowcaseRun(),
      taskHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      model: "fixture",
    });

    const pointer: VerifiedMemoryPointer = {
      runId: keccak256(stringToHex(snapshot.runId)),
      agent: "0x0000000000000000000000000000000000000001",
      version: 3,
      score: 100,
      cid,
      cidHash: cidHash(cid),
      exists: true,
    };

    const mockFetcher = async () =>
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await retrieveVerifiedMemory({
      pointer,
      fetcher: mockFetcher,
    });

    expect(result.snapshot.runId).toBe(snapshot.runId);
    expect(result.safeCards.length).toBeGreaterThan(0);
    expect(result.lessons.length).toBeGreaterThan(0);
    for (const card of result.safeCards) {
      expect(card.sourceCid).toBe(cid);
    }
  });

  it("fails closed when IPFS gateway returns an HTTP error", async () => {
    const cid = await validCid("error-gateway-snapshot");
    const pointer: VerifiedMemoryPointer = {
      runId:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      agent: "0x0000000000000000000000000000000000000001",
      version: 3,
      score: 100,
      cid,
      cidHash: cidHash(cid),
      exists: true,
    };

    const failingFetcher = async () =>
      new Response("Not Found", { status: 404 });

    await expect(
      retrieveVerifiedMemory({ pointer, fetcher: failingFetcher }),
    ).rejects.toThrow("IPFS gateway responded 404");
  });
});
