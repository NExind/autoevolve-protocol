import { type AgentRun } from "@autoevolve/core";
import { hashTaskId } from "@autoevolve/chain";
import {
  buildSnapshotCore,
  createGeminiEmbedder,
  pinSnapshotToPinata,
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
      { error: "Expected a JSON request with a completed run." },
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
      { error: "A completed V1-to-V2-to-V3 run is required." },
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
        error:
          error instanceof Error
            ? error.message
            : "Run could not be safely prepared for memory.",
      },
      { status: 400 },
    );
  }

  if (!process.env.PINATA_JWT) {
    return Response.json({
      status: "prepared",
      message:
        "Snapshot was sanitized and prepared locally. Configure PINATA_JWT to create a real public IPFS CID; no CID or proof is claimed.",
      snapshotHash: snapshot.integrity.canonicalPayloadHash,
    });
  }

  try {
    const pin = await pinSnapshotToPinata(snapshot, {
      jwt: process.env.PINATA_JWT,
      gateway: process.env.PINATA_GATEWAY,
    });
    return Response.json({
      status: "pinned",
      cid: pin.cid,
      gatewayUrl: pin.gatewayUrl,
      snapshotHash: snapshot.integrity.canonicalPayloadHash,
      nextStep:
        "CID is real. Generate the Groth16 proof and call the deployed Base Sepolia registry before marking it verified.",
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Pinata upload failed.",
      },
      { status: 502 },
    );
  }
}
