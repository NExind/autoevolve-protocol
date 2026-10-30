import { createShowcaseRun } from "@autoevolve/core";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { code as rawCodecCode } from "multiformats/codecs/raw";
import { describe, expect, it } from "vitest";
import { buildSnapshotCore } from "./snapshot";
import {
  assertCid,
  assertCidMatchesHash,
  cidHash,
  parseSnapshotCore,
  verifySnapshotIntegrity,
} from "./validation";

const taskHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

async function validCid(value: string): Promise<string> {
  const digest = await sha256.digest(new TextEncoder().encode(value));
  return CID.createV1(rawCodecCode, digest).toString();
}

async function validSnapshot() {
  return buildSnapshotCore({
    run: createShowcaseRun(),
    taskHash,
    model: "fixture",
  });
}

describe("decentralized memory validation", () => {
  it("accepts a canonical safe snapshot and detects content tampering", async () => {
    const snapshot = await validSnapshot();
    expect(parseSnapshotCore(snapshot).runId).toBe(snapshot.runId);
    await expect(verifySnapshotIntegrity(snapshot)).resolves.toEqual(snapshot);

    const tampered = {
      ...snapshot,
      task: { ...snapshot.task, publicSummary: "Tampered gateway response." },
    };
    await expect(verifySnapshotIntegrity(tampered)).rejects.toThrow(
      "canonical payload hash",
    );
  });

  it("rejects unsafe fields and malformed CIDs before a card can be inherited", async () => {
    const snapshot = await validSnapshot();
    const card = snapshot.memory.cards[0];
    expect(() =>
      parseSnapshotCore({
        ...snapshot,
        memory: {
          cards: [{ ...card, systemPrompt: "do not publish this" }],
        },
      }),
    ).toThrow("Unsafe field");

    expect(() =>
      parseSnapshotCore({
        ...snapshot,
        memory: {
          cards: [{ ...card, sourceCid: "not-a-cid" }],
        },
      }),
    ).toThrow();
  });

  it("checks the CID text against the registry CID hash", async () => {
    const cid = await validCid("autoevolve-cid-binding");
    const anotherCid = await validCid("different-content");
    expect(assertCid(cid)).toBe(cid);
    expect(() => assertCid("bafy-not-a-real-cid")).toThrow();

    expect(() => assertCidMatchesHash(cid, cidHash(cid))).not.toThrow();
    expect(() => assertCidMatchesHash(anotherCid, cidHash(cid))).toThrow(
      "does not match",
    );
  });
});
