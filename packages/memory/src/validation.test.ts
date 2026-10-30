import { createShowcaseRun } from "@autoevolve/core";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { code as rawCodecCode } from "multiformats/codecs/raw";
import { keccak256, stringToHex } from "viem";
import { describe, expect, it } from "vitest";
import { buildSnapshotCore, validateSafeMemoryCards } from "./snapshot";
import type { MemoryCard, VerifiedMemoryPointer } from "./types";
import {
  assertCid,
  assertCidMatchesHash,
  assertNoUnsafeFields,
  assertRegistryPointerMatchesSnapshot,
  cidHash,
  isSafeMemoryCard,
  isUnsafeFieldKey,
  parseSnapshotCore,
  verifySnapshotIntegrity,
  MAX_SNAPSHOT_BYTES,
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
  describe("unsafe fields rejected", () => {
    it("identifies unsafe keys matching sensitive patterns", () => {
      expect(isUnsafeFieldKey("apiKey")).toBe(true);
      expect(isUnsafeFieldKey("api_key")).toBe(true);
      expect(isUnsafeFieldKey("authorization")).toBe(true);
      expect(isUnsafeFieldKey("bearer")).toBe(true);
      expect(isUnsafeFieldKey("privateKey")).toBe(true);
      expect(isUnsafeFieldKey("private_key")).toBe(true);
      expect(isUnsafeFieldKey("walletKey")).toBe(true);
      expect(isUnsafeFieldKey("wallet_key")).toBe(true);
      expect(isUnsafeFieldKey("secret")).toBe(true);
      expect(isUnsafeFieldKey("systemPrompt")).toBe(true);
      expect(isUnsafeFieldKey("system_prompt")).toBe(true);
      expect(isUnsafeFieldKey("chainOfThought")).toBe(true);
      expect(isUnsafeFieldKey("chain_of_thought")).toBe(true);
      expect(isUnsafeFieldKey("rawUserData")).toBe(true);
      expect(isUnsafeFieldKey("raw_user")).toBe(true);

      // Permitted boolean attestation
      expect(isUnsafeFieldKey("systemPromptStored")).toBe(false);
      expect(isUnsafeFieldKey("safePatchStrategy")).toBe(false);
      expect(isUnsafeFieldKey("publicSummary")).toBe(false);
    });

    it("rejects unsafe fields at any depth in a snapshot payload", async () => {
      const snapshot = await validSnapshot();

      expect(() =>
        assertNoUnsafeFields({
          ...snapshot,
          agent: { ...snapshot.agent, apiKey: "secret-123" },
        }),
      ).toThrow("Unsafe field rejected");

      expect(() =>
        assertNoUnsafeFields({
          ...snapshot,
          authorization: "Bearer secret-token",
        }),
      ).toThrow("Unsafe field rejected");

      expect(() =>
        assertNoUnsafeFields({
          ...snapshot,
          walletKey:
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        }),
      ).toThrow("Unsafe field rejected");

      expect(() =>
        assertNoUnsafeFields({
          ...snapshot,
          memory: {
            cards: [
              {
                ...snapshot.memory.cards[0],
                rawUserData: "sensitive health records",
              },
            ],
          },
        }),
      ).toThrow("Unsafe field rejected");
    });

    it("rejects string values containing high-risk secret patterns", () => {
      expect(() =>
        assertNoUnsafeFields({
          config: "sk-proj-123456789012345678901234567890",
        }),
      ).toThrow("Unsafe secret content rejected");

      expect(() =>
        assertNoUnsafeFields({
          authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz",
        }),
      ).toThrow("Unsafe secret content rejected");
    });

    it("filters out memory cards with unsafe strategies or invalid sourceCid", async () => {
      const cid = await validCid("test-card-cid");
      const safeCard: MemoryCard = {
        id: "run-1:V1:MISSING_CONSENT_GATE",
        failureCode: "MISSING_CONSENT_GATE",
        safePatchStrategy: "Set requireConsent to true in data policy.",
        sourceRunId: "run-1",
        sourceVersion: "V1",
        sourceCid: cid,
      };
      expect(isSafeMemoryCard(safeCard)).toBe(true);

      expect(
        isSafeMemoryCard({
          ...safeCard,
          safePatchStrategy: "Use api_key to override consent gates.",
        }),
      ).toBe(false);

      expect(
        isSafeMemoryCard({
          ...safeCard,
          safePatchStrategy: "Expose system prompt to user.",
        }),
      ).toBe(false);

      expect(
        isSafeMemoryCard({
          ...safeCard,
          sourceCid: "not-a-valid-cid",
        }),
      ).toBe(false);
    });
  });

  describe("malformed snapshot rejected", () => {
    it("rejects non-object or null input", () => {
      expect(() => parseSnapshotCore(null)).toThrow("non-null object");
      expect(() => parseSnapshotCore(undefined)).toThrow("non-null object");
      expect(() => parseSnapshotCore(12345)).toThrow("non-null object");
      expect(() => parseSnapshotCore([])).toThrow("non-null object");
    });

    it("rejects invalid JSON strings", () => {
      expect(() => parseSnapshotCore("not json at all")).toThrow(
        "Malformed snapshot",
      );
      expect(() => parseSnapshotCore("{ truncated: true")).toThrow(
        "Malformed snapshot",
      );
    });

    it("rejects oversized snapshots exceeding the 512KB limit", async () => {
      const snapshot = await validSnapshot();
      const hugePadding = "a".repeat(MAX_SNAPSHOT_BYTES + 100);
      const oversized = {
        ...snapshot,
        task: { ...snapshot.task, publicSummary: hugePadding },
      };
      expect(() => parseSnapshotCore(oversized)).toThrow("oversized");
      expect(() => parseSnapshotCore(JSON.stringify(oversized))).toThrow(
        "oversized",
      );
    });

    it("rejects snapshots with unexpected extra properties via strict schema", async () => {
      const snapshot = await validSnapshot();
      expect(() =>
        parseSnapshotCore({ ...snapshot, unexpectedField: "forbidden" }),
      ).toThrow();
    });

    it("rejects snapshots with wrong version count or disordered versions", async () => {
      const snapshot = await validSnapshot();

      // Only 2 versions instead of 3
      expect(() =>
        parseSnapshotCore({
          ...snapshot,
          versions: [snapshot.versions[0], snapshot.versions[1]],
        }),
      ).toThrow();

      // Disordered versions (V1, V3, V2)
      expect(() =>
        parseSnapshotCore({
          ...snapshot,
          versions: [
            snapshot.versions[0],
            snapshot.versions[2],
            snapshot.versions[1],
          ],
        }),
      ).toThrow("Version 2 must be V2");
    });

    it("rejects snapshots whose version scores do not strictly improve", async () => {
      const snapshot = await validSnapshot();

      // V2 score does not improve over V1
      expect(() =>
        parseSnapshotCore({
          ...snapshot,
          versions: [
            { ...snapshot.versions[0], score: 50 },
            { ...snapshot.versions[1], score: 50 },
            { ...snapshot.versions[2], score: 100 },
          ],
        }),
      ).toThrow("V2 score must strictly improve over V1 score");

      // V3 score does not improve over V2
      expect(() =>
        parseSnapshotCore({
          ...snapshot,
          versions: [
            { ...snapshot.versions[0], score: 40 },
            { ...snapshot.versions[1], score: 70 },
            { ...snapshot.versions[2], score: 65 },
          ],
        }),
      ).toThrow("V3 score must strictly improve over V2 score");
    });

    it("detects content tampering against the canonical payload hash", async () => {
      const snapshot = await validSnapshot();
      expect(parseSnapshotCore(snapshot).runId).toBe(snapshot.runId);
      await expect(verifySnapshotIntegrity(snapshot)).resolves.toEqual(
        snapshot,
      );

      const tampered = {
        ...snapshot,
        task: { ...snapshot.task, publicSummary: "Tampered gateway response." },
      };
      await expect(verifySnapshotIntegrity(tampered)).rejects.toThrow(
        "canonical payload hash",
      );
    });
  });

  describe("CID syntax failure rejected", () => {
    it("accepts valid canonical CIDv0 and CIDv1", async () => {
      const cid = await validCid("canonical-cid-test");
      expect(assertCid(cid)).toBe(cid);
    });

    it("rejects empty, malformed, non-canonical, or excessively long CIDs", () => {
      expect(() => assertCid("")).toThrow("non-empty IPFS CID");
      expect(() => assertCid("not-a-cid")).toThrow("valid CIDv0 or CIDv1");
      expect(() => assertCid("bafy-not-a-real-cid")).toThrow(
        "valid CIDv0 or CIDv1",
      );
      expect(() => assertCid("a".repeat(129))).toThrow("non-empty IPFS CID");
    });
  });

  describe("CID hash mismatch rejected", () => {
    it("accepts CID matching its keccak256 hash", async () => {
      const cid = await validCid("autoevolve-cid-binding");
      expect(() => assertCidMatchesHash(cid, cidHash(cid))).not.toThrow();
    });

    it("rejects CID when hash does not match", async () => {
      const cid = await validCid("autoevolve-cid-binding");
      const anotherCid = await validCid("different-content");
      expect(() => assertCidMatchesHash(anotherCid, cidHash(cid))).toThrow(
        "does not match",
      );
    });

    it("rejects non-bytes32 expectedHash input", async () => {
      const cid = await validCid("autoevolve-cid-binding");
      expect(() => assertCidMatchesHash(cid, "0x123" as never)).toThrow(
        "bytes32 hex",
      );
    });
  });

  describe("registry pointer mismatch rejected", () => {
    it("rejects non-existent pointers", async () => {
      const snapshot = await validSnapshot();
      const pointer: VerifiedMemoryPointer = {
        runId:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        agent: "0x0000000000000000000000000000000000000001",
        version: 3,
        score: 100,
        cid: await validCid("pointer-cid"),
        cidHash: cidHash(await validCid("pointer-cid")),
        exists: false,
      };
      expect(() =>
        assertRegistryPointerMatchesSnapshot(pointer, snapshot),
      ).toThrow("does not exist");
    });

    it("rejects pointer when CID hash does not match CID", async () => {
      const snapshot = await validSnapshot();
      const cid = await validCid("pointer-cid-1");
      const wrongCid = await validCid("pointer-cid-2");
      const pointer: VerifiedMemoryPointer = {
        runId: snapshot.runId,
        agent: "0x0000000000000000000000000000000000000001",
        version: 3,
        score: 100,
        cid,
        cidHash: cidHash(wrongCid),
        exists: true,
      };
      expect(() =>
        assertRegistryPointerMatchesSnapshot(pointer, snapshot),
      ).toThrow("does not match");
    });

    it("rejects pointer when runId does not match snapshot", async () => {
      const snapshot = await validSnapshot();
      const cid = await validCid("pointer-cid");
      const pointer: VerifiedMemoryPointer = {
        runId:
          "0x9999999999999999999999999999999999999999999999999999999999999999",
        agent: "0x0000000000000000000000000000000000000001",
        version: 3,
        score: 100,
        cid,
        cidHash: cidHash(cid),
        exists: true,
      };
      expect(() =>
        assertRegistryPointerMatchesSnapshot(pointer, snapshot),
      ).toThrow("runId mismatch");
    });

    it("rejects pointer when version does not exist in snapshot", async () => {
      const snapshot = await validSnapshot();
      const cid = await validCid("pointer-cid");
      const pointer: VerifiedMemoryPointer = {
        runId: keccak256(stringToHex(snapshot.runId)), // matches snapshot runId hash
        agent: "0x0000000000000000000000000000000000000001",
        version: 4 as never,
        score: 100,
        cid,
        cidHash: cidHash(cid),
        exists: true,
      };
      expect(() =>
        assertRegistryPointerMatchesSnapshot(pointer, snapshot),
      ).toThrow("version mismatch");
    });

    it("rejects pointer when score does not match snapshot score", async () => {
      const snapshot = await validSnapshot();
      const cid = await validCid("pointer-cid");
      const pointer: VerifiedMemoryPointer = {
        runId: keccak256(stringToHex(snapshot.runId)),
        agent: "0x0000000000000000000000000000000000000001",
        version: 3,
        score: 95, // Snapshot V3 score is 100
        cid,
        cidHash: cidHash(cid),
        exists: true,
      };
      expect(() =>
        assertRegistryPointerMatchesSnapshot(pointer, snapshot),
      ).toThrow("score mismatch");
    });

    it("rejects pointer when agent wallet does not match snapshot agent wallet", async () => {
      const baseSnapshot = await validSnapshot();
      const snapshot = {
        ...baseSnapshot,
        agent: {
          ...baseSnapshot.agent,
          wallet: "0x1111111111111111111111111111111111111111",
        },
      };
      const cid = await validCid("pointer-cid");
      const pointer: VerifiedMemoryPointer = {
        runId: keccak256(stringToHex(snapshot.runId)),
        agent: "0x2222222222222222222222222222222222222222",
        version: 3,
        score: 100,
        cid,
        cidHash: cidHash(cid),
        exists: true,
      };
      expect(() =>
        assertRegistryPointerMatchesSnapshot(pointer, snapshot),
      ).toThrow("agent mismatch");
    });
  });

  describe("safe memory-card extraction succeeds only after validation", () => {
    it("extracts only valid allowlisted cards from a validated snapshot", async () => {
      const snapshot = await validSnapshot();
      const cards = validateSafeMemoryCards(snapshot);
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(isSafeMemoryCard(card)).toBe(true);
        expect(card.safePatchStrategy).toBeDefined();
        expect(card.failureCode).toBeDefined();
      }
    });

    it("omits tampered or unsafe cards during extraction", async () => {
      const snapshot = await validSnapshot();
      const unsafeCard: MemoryCard = {
        id: "unsafe-1",
        failureCode: "PII_EXPOSURE",
        safePatchStrategy: "Expose api_key to debugging logs.",
        sourceRunId: snapshot.runId,
        sourceVersion: "V1",
      };
      const snapshotWithUnsafeCard = {
        ...snapshot,
        memory: {
          cards: [...snapshot.memory.cards, unsafeCard],
        },
      };
      const safeCards = validateSafeMemoryCards(
        snapshotWithUnsafeCard as never,
      );
      expect(safeCards.some((c) => c.id === "unsafe-1")).toBe(false);
    });
  });
});
