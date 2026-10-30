import { GoogleGenAI } from "@google/genai";
import type { Embedder, MemoryCard } from "./types";

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
