import { GoogleGenAI } from "@google/genai";
import type { InheritedLesson } from "@autoevolve/core";
import type { Hex } from "viem";
import { validateSafeMemoryCards } from "./snapshot";
import type {
  Embedder,
  MemoryCard,
  SnapshotCore,
  VerifiedMemoryPointer,
} from "./types";
import {
  assertCid,
  assertCidMatchesHash,
  assertRegistryPointerMatchesSnapshot,
  isSafeMemoryCard,
  parseSnapshotCore,
  verifySnapshotIntegrity,
} from "./validation";

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export async function rankMemoryCards(
  query: string,
  cards: MemoryCard[],
  embedder?: Embedder,
): Promise<MemoryCard[]> {
  if (!embedder) {
    return [...cards].sort((a, b) =>
      a.failureCode.localeCompare(b.failureCode),
    );
  }
  const queryEmbedding = await embedder.embed(query);
  return [...cards].sort(
    (a, b) =>
      cosineSimilarity(queryEmbedding, b.embedding ?? []) -
      cosineSimilarity(queryEmbedding, a.embedding ?? []),
  );
}

export function allowlistedCardsToInheritedLessons(
  cards: MemoryCard[],
): InheritedLesson[] {
  return cards.filter(isSafeMemoryCard).map((card) => ({
    failureCode: card.failureCode,
    safePatchStrategy: card.safePatchStrategy,
    sourceRunId: card.sourceRunId,
    sourceCid: card.sourceCid,
  }));
}

/**
 * Executes the exact decentralized memory retrieval pipeline:
 * registry pointer → CID hash check → IPFS fetch → runtime schema validation →
 * pointer match check → allowlisted MemoryCard extraction.
 */
export async function retrieveVerifiedMemory(input: {
  pointer: VerifiedMemoryPointer;
  gateway?: string;
  fetcher?: (url: string) => Promise<Response>;
}): Promise<{
  snapshot: SnapshotCore;
  safeCards: MemoryCard[];
  lessons: InheritedLesson[];
}> {
  const { pointer } = input;
  if (!pointer.exists) {
    throw new Error("Registry pointer does not exist.");
  }
  const canonicalCid = assertCid(pointer.cid);
  assertCidMatchesHash(canonicalCid, pointer.cidHash as Hex);

  const gateway = (input.gateway ?? "https://gateway.pinata.cloud").replace(
    /\/$/,
    "",
  );
  const url = `${gateway}/ipfs/${canonicalCid}`;
  const response = input.fetcher
    ? await input.fetcher(url)
    : await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`IPFS gateway responded ${response.status}.`);
  }
  const text = await response.text();
  const snapshot = await verifySnapshotIntegrity(parseSnapshotCore(text));

  assertRegistryPointerMatchesSnapshot(pointer, snapshot);

  const safeCards = validateSafeMemoryCards(snapshot).map((card) => ({
    ...card,
    sourceCid: canonicalCid,
  }));
  const lessons = allowlistedCardsToInheritedLessons(safeCards);

  return { snapshot, safeCards, lessons };
}

export function createGeminiEmbedder(config: {
  apiKey: string;
  model?: string;
}): Embedder {
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  return {
    async embed(text: string): Promise<number[]> {
      const response = await (
        client.models.embedContent as unknown as (args: unknown) => Promise<{
          embeddings?: Array<{ values?: number[] }>;
        }>
      )({
        model: config.model ?? "gemini-embedding-2",
        contents: text,
      });
      const values = response.embeddings?.[0]?.values;
      if (!values?.length) {
        throw new Error("Gemini embedding endpoint returned no vector.");
      }
      return values;
    },
  };
}
