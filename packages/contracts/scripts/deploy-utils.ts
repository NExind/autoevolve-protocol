import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const artifactDirectory = resolve(packageDirectory, "artifacts");
const workspaceRoot = resolve(packageDirectory, "../..");

// Next.js uses .env.local while the standalone deployment scripts run in Node.
// Load the same uncommitted file, with AUTOEVOLVE_ENV_FILE available for a
// different local path. Never add an environment file to Git.
loadDotenv({
  path: process.env.AUTOEVOLVE_ENV_FILE ?? resolve(workspaceRoot, ".env.local"),
  quiet: true,
});
loadDotenv({ quiet: true });

export type ContractArtifact = {
  contractName: string;
  sourceName: string;
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
};

export async function loadArtifact(
  sourceName: string,
  contractName: string,
): Promise<ContractArtifact> {
  const artifactPath = resolve(
    artifactDirectory,
    sourceName,
    `${contractName}.json`,
  );
  try {
    return JSON.parse(await readFile(artifactPath, "utf8")) as ContractArtifact;
  } catch {
    throw new Error(
      `Missing artifact for ${sourceName}:${contractName}. Run \`pnpm compile\` first.`,
    );
  }
}

export function requiredAddress(name: string): Address {
  const value = process.env[name];
  if (!value || !isAddress(value)) {
    throw new Error(`${name} must be a valid 0x EVM address.`);
  }
  return value;
}

export function requiredPositiveWei(name: string, fallback?: bigint): bigint {
  const value = process.env[name];
  const parsed = value ? BigInt(value) : fallback;
  if (!parsed || parsed <= 0n) {
    throw new Error(`${name} must be a positive integer amount of wei.`);
  }
  return parsed;
}

export function deploymentClients() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key.",
    );
  }

  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { account, publicClient, walletClient };
}

export function agentSettlementClients() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "AGENT_PRIVATE_KEY must be a 32-byte 0x-prefixed private key.",
    );
  }

  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { account, publicClient, walletClient };
}

export async function deployArtifact(
  artifact: ContractArtifact,
  args: readonly unknown[] = [],
) {
  const { account, publicClient, walletClient } = deploymentClients();
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(
      `Deployment transaction ${hash} did not create a contract.`,
    );
  }

  return {
    deployer: account.address,
    transactionHash: hash,
    contractAddress: receipt.contractAddress,
    blockNumber: receipt.blockNumber.toString(),
  };
}
