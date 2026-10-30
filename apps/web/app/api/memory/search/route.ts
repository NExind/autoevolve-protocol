import { readLatestVerifiedMemory } from "@autoevolve/chain";
import {
  createGeminiEmbedder,
  rankMemoryCards,
  retrieveVerifiedMemory,
} from "@autoevolve/memory";
import { isAddress, type Address, type Hex } from "viem";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const taskHash = url.searchParams.get("taskHash") as Hex | null;
  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as
    | Address
    | undefined;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;

  if (!taskHash || !/^0x[a-fA-F0-9]{64}$/.test(taskHash)) {
    return Response.json(
      { status: "error", error: "A bytes32 taskHash is required." },
      { status: 400 },
    );
  }
  if (!registryAddress || !isAddress(registryAddress) || !rpcUrl) {
    return Response.json({
      status: "unconfigured",
      message:
        "Registry lookup is unavailable until NEXT_PUBLIC_REGISTRY_ADDRESS and BASE_SEPOLIA_RPC_URL are configured.",
    });
  }

  try {
    const pointer = await readLatestVerifiedMemory(
      { registryAddress, rpcUrl },
      taskHash,
    );
    if (!pointer) {
      return Response.json({ status: "not-found", cards: [] });
    }
    const { snapshot, safeCards } = await retrieveVerifiedMemory({
      pointer,
      gateway: process.env.PINATA_GATEWAY
        ? `https://${process.env.PINATA_GATEWAY}`
        : undefined,
    });
    const embedder =
      process.env.MEMORY_EMBEDDINGS_ENABLED === "true" &&
      process.env.GEMINI_API_KEY &&
      safeCards.some((card) => card.embedding?.length)
        ? createGeminiEmbedder({
            apiKey: process.env.GEMINI_API_KEY,
            model: process.env.GEMINI_EMBEDDING_MODEL,
          })
        : undefined;
    const cards = await rankMemoryCards(
      snapshot.task.publicSummary,
      safeCards,
      embedder,
    );
    return Response.json({
      status: "verified-memory",
      pointer,
      cards,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Verified-memory lookup failed.",
      },
      { status: 502 },
    );
  }
}
