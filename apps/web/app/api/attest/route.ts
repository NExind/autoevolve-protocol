import { type AgentRun } from "@autoevolve/core";
import { hashTaskId, textOrBytes32ToHash } from "@autoevolve/chain";
import {
  buildSnapshotCore,
  createGeminiEmbedder,
  loadLocalSettlementProofs,
  loadSettlementReceipts,
  pinSnapshotToPinata,
  validateSafeMemoryCards,
  type SnapshotCore,
} from "@autoevolve/memory";
import { z } from "zod";

const requestSchema = z
  .object({
    run: z.unknown(),
  })
  .strict();

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return Response.json(
      {
        status: "error",
        error: "Expected a JSON request with a completed run.",
      },
      { status: 400 },
    );
  }

  const run = body.run as AgentRun;
  if (
    !run?.runId ||
    !Array.isArray(run.versions) ||
    run.versions.length !== 3
  ) {
    return Response.json(
      { status: "error", error: "A completed V1-to-V2-to-V3 run is required." },
      { status: 400 },
    );
  }

  let snapshot: SnapshotCore;
  try {
    const embedder =
      process.env.MEMORY_EMBEDDINGS_ENABLED === "true" &&
      process.env.GEMINI_API_KEY
        ? createGeminiEmbedder({
            apiKey: process.env.GEMINI_API_KEY,
            model: process.env.GEMINI_EMBEDDING_MODEL,
          })
        : undefined;
    snapshot = await buildSnapshotCore({
      run,
      taskHash: hashTaskId(run.task.id),
      model:
        process.env.GEMINI_MODEL ??
        (run.mode === "live" ? "gemini" : "fixture"),
      ...(embedder ? { embedder } : {}),
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Run could not be safely prepared for memory.",
      },
      { status: 400 },
    );
  }

  const safeCards = validateSafeMemoryCards(snapshot);

  let cid: string | undefined;
  let gatewayUrl: string | undefined;
  if (process.env.PINATA_JWT) {
    try {
      const pin = await pinSnapshotToPinata(snapshot, {
        jwt: process.env.PINATA_JWT,
        gateway: process.env.PINATA_GATEWAY,
      });
      cid = pin.cid;
      gatewayUrl = pin.gatewayUrl;
    } catch (error) {
      return Response.json(
        {
          status: "error",
          error: error instanceof Error ? error.message : "Pinata upload failed.",
        },
        { status: 502 },
      );
    }
  }

  const runIdHash = textOrBytes32ToHash(run.runId);
  const settlementReceipts = await loadSettlementReceipts();
  if (
    settlementReceipts &&
    settlementReceipts.runId.toLowerCase() === runIdHash.toLowerCase() &&
    settlementReceipts.finalVersion === 3
  ) {
    const settledCid = settlementReceipts.cid;
    const txHash =
      settlementReceipts.receipts.v2ToV3 ??
      settlementReceipts.receipts.v1ToV2 ??
      settlementReceipts.receipts.startRun;
    return Response.json({
      status: "on-chain settled",
      cid: settledCid,
      gatewayUrl:
        gatewayUrl ?? `https://gateway.pinata.cloud/ipfs/${settledCid}`,
      snapshotHash: snapshot.integrity.canonicalPayloadHash,
      cardCount: safeCards.length,
      safeCards: safeCards.map((card) => ({
        ...card,
        sourceCid: settledCid,
      })),
      txHash,
      registryAddress: settlementReceipts.registry,
      message:
        "Run improvement proofs verified and settled on Base Sepolia.",
    });
  }

  const localProofs = await loadLocalSettlementProofs({
    runId: run.runId,
    ...(cid ? { cid } : {}),
  });
  if (localProofs?.v1v2 && localProofs?.v2v3) {
    return Response.json({
      status: "locally verified",
      cid,
      gatewayUrl,
      snapshotHash: snapshot.integrity.canonicalPayloadHash,
      cardCount: safeCards.length,
      safeCards: cid
        ? safeCards.map((card) => ({ ...card, sourceCid: cid }))
        : safeCards,
      nextStep:
        "Groth16 proofs verified locally. Settle via Base Sepolia registry to complete on-chain verification.",
    });
  }

  if (cid && gatewayUrl) {
    return Response.json({
      status: "pinned",
      cid,
      gatewayUrl,
      snapshotHash: snapshot.integrity.canonicalPayloadHash,
      cardCount: safeCards.length,
      safeCards: safeCards.map((card) => ({
        ...card,
        sourceCid: cid,
      })),
      nextStep:
        "CID is real storage evidence. Generate the Groth16 proof and settle via Base Sepolia registry before marking it verified.",
    });
  }

  return Response.json({
    status: "prepared",
    message:
      "Snapshot was sanitized and prepared locally. Configure PINATA_JWT to create a real public IPFS CID; no CID, proof, or on-chain settlement is claimed.",
    snapshotHash: snapshot.integrity.canonicalPayloadHash,
    cardCount: safeCards.length,
    safeCards,
  });
}

