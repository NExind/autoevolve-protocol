import { hashToUint128Limbs } from "@autoevolve/core";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { autoEvolveRegistryAbi } from "./abi";
import type {
  Groth16Proof,
  RegistryConfig,
  VerifiedMemoryPointer,
} from "./types";

const snarkScalarField =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function createRegistryPublicClient(config: RegistryConfig) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });
}

export async function readLatestVerifiedMemory(
  config: RegistryConfig,
  taskHash: Hex,
): Promise<VerifiedMemoryPointer | null> {
  const client = createRegistryPublicClient(config);
  const value = await client.readContract({
    address: config.registryAddress,
    abi: autoEvolveRegistryAbi,
    functionName: "getLatestVerifiedMemory",
    args: [taskHash],
  });
  const pointer = value as {
    runId: Hex;
    agent: Address;
    version: number;
    score: number;
    cidHash: Hex;
    cid: string;
    exists: boolean;
  };
  return pointer.exists ? pointer : null;
}

export function keccakToLimbs(value: string): { low: bigint; high: bigint } {
  return hashToUint128Limbs(hashUtf8ToBytes32(value));
}

export function hashUtf8ToBytes32(value: string): Hex {
  return keccak256(stringToHex(value));
}

export function hashTaskId(taskId: string): Hex {
  return hashUtf8ToBytes32(taskId);
}

export function bytes32ToLimbs(value: Hex): { low: bigint; high: bigint } {
  return hashToUint128Limbs(value);
}

export function buildPublicSignals(input: {
  previousPolicyCommitment: bigint;
  nextPolicyCommitment: bigint;
  runId: Hex;
  cid: string;
  agent: Address;
  stage: 2 | 3;
  rubricHash: Hex;
  previousScore: number;
  nextScore: number;
  binding: bigint;
}): readonly bigint[] {
  if (
    input.previousPolicyCommitment >= snarkScalarField ||
    input.nextPolicyCommitment >= snarkScalarField ||
    input.binding >= snarkScalarField
  ) {
    throw new Error("Poseidon commitments must fit the BN254 scalar field.");
  }
  if (
    input.previousScore < 0 ||
    input.previousScore > 100 ||
    input.nextScore <= input.previousScore ||
    input.nextScore > 100
  ) {
    throw new Error("Public score inputs do not represent strict improvement.");
  }
  const run = bytes32ToLimbs(input.runId);
  const cid = keccakToLimbs(input.cid);
  const rubric = bytes32ToLimbs(input.rubricHash);
  // Circom/snakejs serializes all main-component outputs before the explicit
  // public inputs. Keep this order byte-for-byte aligned with the generated
  // Groth16 verifier and AutoEvolveRegistry.
  return [
    BigInt(input.previousScore),
    BigInt(input.nextScore),
    input.binding,
    input.previousPolicyCommitment,
    input.nextPolicyCommitment,
    run.low,
    run.high,
    cid.low,
    cid.high,
    BigInt(input.agent),
    BigInt(input.stage),
    rubric.low,
    rubric.high,
  ] as const;
}

export async function submitStartRun(input: {
  config: RegistryConfig;
  privateKey: Hex;
  runId: Hex;
  taskHash: Hex;
  rubricHash: Hex;
  initialPolicyCommitment: bigint;
  initialScore: number;
  initialCid: string;
}): Promise<Hex> {
  const account = privateKeyToAccount(input.privateKey);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(input.config.rpcUrl),
  });
  return wallet.writeContract({
    address: input.config.registryAddress,
    abi: autoEvolveRegistryAbi,
    functionName: "startRun",
    args: [
      input.runId,
      input.taskHash,
      input.rubricHash,
      input.initialPolicyCommitment,
      input.initialScore,
      input.initialCid,
    ],
  });
}

export async function submitSettlement(input: {
  config: RegistryConfig;
  privateKey: Hex;
  runId: Hex;
  fromVersion: 1 | 2;
  toVersion: 2 | 3;
  nextPolicyCommitment: bigint;
  cid: string;
  proof: Groth16Proof;
  publicSignals: readonly bigint[];
}): Promise<Hex> {
  if (input.publicSignals.length !== 13) {
    throw new Error("Expected exactly 13 Groth16 public signals.");
  }
  const account = privateKeyToAccount(input.privateKey);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(input.config.rpcUrl),
  });
  return wallet.writeContract({
    address: input.config.registryAddress,
    abi: autoEvolveRegistryAbi,
    functionName: "settleImprovement",
    args: [
      input.runId,
      input.fromVersion,
      input.toVersion,
      input.nextPolicyCommitment,
      input.cid,
      input.proof,
      input.publicSignals as readonly [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
      ],
    ],
  });
}
