import type { DataPolicy, FailureCode, PolicyChange } from "@autoevolve/core";
import type { Address, Hex } from "viem";

export interface MemoryCard {
  id: string;
  failureCode: FailureCode;
  safePatchStrategy: string;
  sourceRunId: string;
  sourceVersion: "V1" | "V2";
  sourceCid?: string;
  embedding?: number[];
}

export interface SnapshotCore {
  schemaVersion: "autoevolve-memory/v1";
  runId: string;
  task: {
    taskId: string;
    taskHash: string;
    publicSummary: string;
    tags: string[];
  };
  agent: {
    wallet?: string;
    model: string;
    deterministicConfig: { temperature: 0 };
    systemPromptStored: false;
  };
  versions: Array<{
    id: "V1" | "V2" | "V3";
    policy: DataPolicy;
    score: number;
    outputHash: string;
  }>;
  transitions: Array<{
    from: "V1" | "V2";
    to: "V2" | "V3";
    critiqueSummary: string;
    failureCodes: FailureCode[];
    safePatchStrategies: string[];
    changes: PolicyChange[];
  }>;
  memory: {
    cards: MemoryCard[];
  };
  integrity: {
    canonicalPayloadHash: string;
  };
}

export interface PinResult {
  cid: string;
  gatewayUrl: string;
}

export interface Embedder {
  embed(text: string): Promise<number[]>;
}

export interface SettlementProofJson {
  a: readonly [string, string];
  b: readonly [readonly [string, string], readonly [string, string]];
  c: readonly [string, string];
}

export interface SettlementArtifact {
  schemaVersion: "autoevolve-settlement/v1";
  locallyVerified: true;
  verifiedAt?: string;
  publicSignalOrder: "outputs-first-v1";
  proof: SettlementProofJson;
  publicSignals: readonly string[];
}

export interface SettlementReceiptsArtifact {
  network: "base-sepolia";
  registry: string;
  runId: string;
  taskHash: string;
  rubricHash: string;
  cid: string;
  agent: string;
  finalVersion: number;
  finalScore: number;
  receipts: {
    startRun?: string;
    v1ToV2?: string;
    v2ToV3?: string;
  };
}

export type AttestationLifecycleStatus =
  | "prepared"
  | "pinned"
  | "locally verified"
  | "on-chain settled"
  | "error";

export interface VerifiedMemoryPointer {
  runId: Hex | string;
  agent: Address | string;
  version: number;
  score: number;
  cidHash: Hex | string;
  cid: string;
  exists: boolean;
}

