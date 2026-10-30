import type { DataPolicy, FailureCode, PolicyChange } from "@autoevolve/core";

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
