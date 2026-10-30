import type { Address, Hex } from "viem";

export interface RegistryConfig {
  rpcUrl: string;
  registryAddress: Address;
}

export interface VerifiedMemoryPointer {
  runId: Hex;
  agent: Address;
  version: number;
  score: number;
  cidHash: Hex;
  cid: string;
  exists: boolean;
}

export interface Groth16Proof {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
}
