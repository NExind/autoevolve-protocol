import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SettlementArtifact, SettlementReceiptsArtifact } from "./types";
import {
  parseSettlementArtifact,
  parseSettlementReceipts,
  validateSettlementBinding,
} from "./validation";

/**
 * Safely loads and strictly validates a Groth16 settlement artifact from disk.
 * Returns null if the file does not exist or fails validation.
 */
export async function loadSettlementArtifact(
  filePath: string,
): Promise<SettlementArtifact | null> {
  try {
    const raw = await readFile(
      resolve(/*turbopackIgnore: true*/ filePath),
      "utf8",
    );
    const json = JSON.parse(raw);
    return parseSettlementArtifact(json);
  } catch {
    return null;
  }
}

/**
 * Safely loads and strictly validates on-chain settlement receipts from disk.
 * Returns null if the file does not exist or fails validation.
 */
export async function loadSettlementReceipts(
  filePath?: string,
): Promise<SettlementReceiptsArtifact | null> {
  const path =
    filePath ??
    process.env.SETTLEMENT_RECEIPTS_PATH ??
    "circuits/proofs/on-chain-settlement/settlement-receipts.json";
  try {
    const raw = await readFile(resolve(/*turbopackIgnore: true*/ path), "utf8");
    const json = JSON.parse(raw);
    return parseSettlementReceipts(json);
  } catch {
    return null;
  }
}

/**
 * Attempts to load both V1->V2 and V2->V3 settlement proofs.
 * If runId and cid are provided, validates that public signals bind to them.
 */
export async function loadLocalSettlementProofs(options?: {
  proofDir?: string;
  runId?: string;
  cid?: string;
}): Promise<{
  v1v2: SettlementArtifact;
  v2v3: SettlementArtifact;
} | null> {
  const baseDir =
    options?.proofDir ?? process.env.PROOF_ARTIFACTS_DIR ?? "circuits/proofs";

  const v1v2Path = resolve(baseDir, "v1-v2", "settlement.json");
  const v2v3Path = resolve(baseDir, "v2-v3", "settlement.json");

  const [v1v2, v2v3] = await Promise.all([
    loadSettlementArtifact(v1v2Path),
    loadSettlementArtifact(v2v3Path),
  ]);

  if (!v1v2 || !v2v3) {
    return null;
  }

  // Ensure continuous run
  if (
    v1v2.publicSignals[4] !== v2v3.publicSignals[3] ||
    v1v2.publicSignals[1] !== v2v3.publicSignals[0]
  ) {
    return null;
  }

  if (options?.runId || options?.cid) {
    try {
      validateSettlementBinding(v1v2, {
        ...(options.runId ? { runId: options.runId } : {}),
        ...(options.cid ? { cid: options.cid } : {}),
        stage: 2,
      });
      validateSettlementBinding(v2v3, {
        ...(options.runId ? { runId: options.runId } : {}),
        ...(options.cid ? { cid: options.cid } : {}),
        stage: 3,
      });
    } catch {
      return null;
    }
  }

  return { v1v2, v2v3 };
}
