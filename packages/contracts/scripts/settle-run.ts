import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  autoEvolveRegistryAbi,
  hashTaskId,
  hashUtf8ToBytes32,
  textOrBytes32ToHash,
} from "@autoevolve/chain";
import { type Address, type Hex } from "viem";
import { agentSettlementClients, requiredAddress } from "./deploy-utils.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const mask128 = (1n << 128n) - 1n;

type SettlementArtifact = {
  schemaVersion: "autoevolve-settlement/v1";
  locallyVerified: true;
  publicSignalOrder: "outputs-first-v1";
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicSignals: string[];
};

type SolidityProof = {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
};

type ChainRun = {
  agent: Address;
  policyCommitment: bigint;
  score: number;
  version: number;
};

function parseArguments(values: string[]) {
  const result: Record<string, string> = {};
  const argumentsWithoutSeparator =
    values[0] === "--" ? values.slice(1) : values;
  for (let index = 0; index < argumentsWithoutSeparator.length; index += 1) {
    const flag = argumentsWithoutSeparator[index];
    if (!flag.startsWith("--")) {
      throw new Error("Expected a --name value argument.");
    }
    const key = flag.slice(2);
    const value = argumentsWithoutSeparator[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --" + key + ".");
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function required(options: Record<string, string>, name: string) {
  const value = options[name];
  if (!value) {
    throw new Error("Missing required --" + name + " argument.");
  }
  return value;
}

function decimal(value: string, name: string): bigint {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(name + " must be a non-negative decimal string.");
  }
  return BigInt(value);
}

function loadSettlement(
  value: unknown,
  name: string,
): { publicSignals: bigint[]; proof: SolidityProof } {
  if (!value || typeof value !== "object") {
    throw new Error(name + " is not a JSON object.");
  }
  const artifact = value as SettlementArtifact;
  if (
    artifact.schemaVersion !== "autoevolve-settlement/v1" ||
    artifact.locallyVerified !== true ||
    artifact.publicSignalOrder !== "outputs-first-v1" ||
    !Array.isArray(artifact.publicSignals) ||
    artifact.publicSignals.length !== 13
  ) {
    throw new Error(
      name + " is not a locally verified 13-signal settlement artifact.",
    );
  }
  const publicSignals = artifact.publicSignals.map((item, index) =>
    decimal(item, name + ".publicSignals[" + index + "]"),
  );
  const proof: SolidityProof = {
    a: [
      decimal(artifact.proof.a[0], name + ".proof.a[0]"),
      decimal(artifact.proof.a[1], name + ".proof.a[1]"),
    ],
    b: [
      [
        decimal(artifact.proof.b[0][0], name + ".proof.b[0][0]"),
        decimal(artifact.proof.b[0][1], name + ".proof.b[0][1]"),
      ],
      [
        decimal(artifact.proof.b[1][0], name + ".proof.b[1][0]"),
        decimal(artifact.proof.b[1][1], name + ".proof.b[1][1]"),
      ],
    ],
    c: [
      decimal(artifact.proof.c[0], name + ".proof.c[0]"),
      decimal(artifact.proof.c[1], name + ".proof.c[1]"),
    ],
  };
  return { publicSignals, proof };
}

function low128(value: Hex) {
  return BigInt(value) & mask128;
}

function high128(value: Hex) {
  return BigInt(value) >> 128n;
}

function validateCommonBindings(
  publicSignals: bigint[],
  expected: {
    runId: Hex;
    cid: string;
    agent: Address;
    stage: bigint;
    rubricHash: Hex;
  },
  label: string,
) {
  const cidHash = hashUtf8ToBytes32(expected.cid);
  if (
    publicSignals[5] !== low128(expected.runId) ||
    publicSignals[6] !== high128(expected.runId)
  ) {
    throw new Error(label + " run ID does not match --run-id.");
  }
  if (
    publicSignals[7] !== low128(cidHash) ||
    publicSignals[8] !== high128(cidHash)
  ) {
    throw new Error(label + " CID does not match --cid.");
  }
  if (publicSignals[9] !== BigInt(expected.agent)) {
    throw new Error(label + " agent binding does not match AGENT_PRIVATE_KEY.");
  }
  if (publicSignals[10] !== expected.stage) {
    throw new Error(label + " stage binding is wrong.");
  }
  if (
    publicSignals[11] !== low128(expected.rubricHash) ||
    publicSignals[12] !== high128(expected.rubricHash)
  ) {
    throw new Error(label + " rubric binding does not match --rubric.");
  }
  if (publicSignals[1] <= publicSignals[0] || publicSignals[1] > 100n) {
    throw new Error(
      label + " does not contain a valid strict score improvement.",
    );
  }
}

async function waitForSuccess(
  publicClient: any,
  transactionHash: Hex,
  label: string,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });
  if (receipt.status !== "success") {
    throw new Error(label + " transaction failed: " + transactionHash);
  }
  return receipt;
}

const options = parseArguments(process.argv.slice(2));
const runIdText =
  options["run-id"] ??
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const taskId = options["task-id"] ?? "data-sharing-policy-repair";
const cid = options.cid ?? "bafybeigdyrztshowcasecidplaceholder";
const v1v2Path = resolve(
  process.cwd(),
  options["v1-v2"] ?? "../../circuits/proofs/v1-v2/settlement.json",
);
const v2v3Path = resolve(
  process.cwd(),
  options["v2-v3"] ?? "../../circuits/proofs/v2-v3/settlement.json",
);
const runId = textOrBytes32ToHash(runIdText);
const taskHash = hashTaskId(taskId);
const rubricHash = textOrBytes32ToHash(options.rubric ?? "policy-rubric-v1");
const registry = requiredAddress("REGISTRY_ADDRESS");
const { account, publicClient, walletClient } = agentSettlementClients();

const [v1v2Json, v2v3Json] = await Promise.all([
  readFile(v1v2Path, "utf8"),
  readFile(v2v3Path, "utf8"),
]);
const v1v2 = loadSettlement(JSON.parse(v1v2Json), "v1-v2");
const v2v3 = loadSettlement(JSON.parse(v2v3Json), "v2-v3");
validateCommonBindings(
  v1v2.publicSignals,
  { runId, cid, agent: account.address, stage: 2n, rubricHash },
  "V1-to-V2",
);
validateCommonBindings(
  v2v3.publicSignals,
  { runId, cid, agent: account.address, stage: 3n, rubricHash },
  "V2-to-V3",
);
if (
  v1v2.publicSignals[4] !== v2v3.publicSignals[3] ||
  v1v2.publicSignals[1] !== v2v3.publicSignals[0]
) {
  throw new Error(
    "The two proof artifacts do not form one continuous V1-to-V2-to-V3 run.",
  );
}

const receipts: Record<string, Hex> = {};
let run: ChainRun;
try {
  run = (await publicClient.readContract({
    address: registry,
    abi: autoEvolveRegistryAbi,
    functionName: "getRun",
    args: [runId],
  })) as unknown as ChainRun;
} catch {
  const startHash = await walletClient.writeContract({
    address: registry,
    abi: autoEvolveRegistryAbi,
    functionName: "startRun",
    args: [
      runId,
      taskHash,
      rubricHash,
      v1v2.publicSignals[3],
      Number(v1v2.publicSignals[0]),
      cid,
    ],
  });
  await waitForSuccess(publicClient, startHash, "startRun");
  receipts.startRun = startHash;
  run = {
    agent: account.address,
    policyCommitment: v1v2.publicSignals[3],
    score: Number(v1v2.publicSignals[0]),
    version: 1,
  };
}

if (
  run.agent.toLowerCase() !== account.address.toLowerCase() ||
  run.policyCommitment !== v1v2.publicSignals[3] ||
  run.score !== Number(v1v2.publicSignals[0])
) {
  throw new Error(
    "Existing run does not match the supplied V1 proof artifact.",
  );
}

if (run.version === 1) {
  const v1v2Hash = await walletClient.writeContract({
    address: registry,
    abi: autoEvolveRegistryAbi,
    functionName: "settleImprovement",
    args: [
      runId,
      1,
      2,
      v1v2.publicSignals[4],
      cid,
      v1v2.proof,
      v1v2.publicSignals as unknown as readonly [
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
  await waitForSuccess(publicClient, v1v2Hash, "V1-to-V2 settlement");
  receipts.v1ToV2 = v1v2Hash;
  run = {
    ...run,
    policyCommitment: v1v2.publicSignals[4],
    score: Number(v1v2.publicSignals[1]),
    version: 2,
  };
}

if (run.version === 2) {
  const v2v3Hash = await walletClient.writeContract({
    address: registry,
    abi: autoEvolveRegistryAbi,
    functionName: "settleImprovement",
    args: [
      runId,
      2,
      3,
      v2v3.publicSignals[4],
      cid,
      v2v3.proof,
      v2v3.publicSignals as unknown as readonly [
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
  await waitForSuccess(publicClient, v2v3Hash, "V2-to-V3 settlement");
  receipts.v2ToV3 = v2v3Hash;
}

const finalRun = await publicClient.readContract({
  address: registry,
  abi: autoEvolveRegistryAbi,
  functionName: "getRun",
  args: [runId],
});
const finalVersion = Number((finalRun as { version: number }).version);
const finalScore = Number((finalRun as { score: number }).score);
if (finalVersion !== 3 || finalScore !== Number(v2v3.publicSignals[1])) {
  throw new Error("Run did not reach the expected verified V3 state.");
}

const outputDirectory = resolve(
  process.cwd(),
  options.out ?? "../../circuits/proofs/on-chain-settlement",
);
await mkdir(outputDirectory, { recursive: true });
const evidence = {
  network: "base-sepolia",
  registry,
  runId,
  taskHash,
  rubricHash,
  cid,
  agent: account.address,
  finalVersion,
  finalScore,
  receipts,
};
await writeFile(
  resolve(outputDirectory, "settlement-receipts.json"),
  JSON.stringify(evidence, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(evidence, null, 2));
