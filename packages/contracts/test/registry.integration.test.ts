import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

type Artifact = {
  abi: Abi;
  bytecode: Hex;
};

type GanacheAccount = {
  secretKey: Hex;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const artifactDirectory = resolve(packageDirectory, "artifacts");
const rewardWei = 100000000000000n;
const cid = "bafybeigdyrztshowcasecidplaceholder";
const otherCid = "bafybeigdyrztdifferentcidplaceholder";
const mask128 = (1n << 128n) - 1n;

const localChain = defineChain({
  id: 31337,
  name: "AutoEvolve local test chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

async function artifact(sourceName: string, contractName: string) {
  const artifactPath = resolve(
    artifactDirectory,
    sourceName,
    `${contractName}.json`,
  );
  return JSON.parse(await readFile(artifactPath, "utf8")) as Artifact;
}

function limbs(value: Hex) {
  const number = BigInt(value);
  return [number & mask128, number >> 128n] as const;
}

// Ganache currently depends on a native LevelDB binding that is unavailable on
// Windows ARM. CI runs this suite on Ubuntu; dynamically importing it lets the
// rest of the repository remain testable on local Windows ARM devices.
const integrationDescribe =
  process.platform === "win32" && process.arch === "arm64"
    ? describe.skip
    : describe;

integrationDescribe("AutoEvolveRegistry local integration", () => {
  // Artifacts are loaded dynamically, so viem cannot infer their ABI literals
  // in this black-box integration test. Runtime behavior remains fully tested.
  let publicClient: any;
  let ownerClient: any;
  let agentClient: any;
  let outsiderClient: any;
  let agent: ReturnType<typeof privateKeyToAccount>;

  let mockVerifierArtifact: Artifact;
  let registryArtifact: Artifact;
  let registry: Address;
  let runId: Hex;
  let taskHash: Hex;
  let rubricHash: Hex;
  let proof: {
    a: readonly [bigint, bigint];
    b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
    c: readonly [bigint, bigint];
  };
  let publicSignals: readonly bigint[];

  beforeAll(async () => {
    const { default: ganache } = await import("ganache");
    const provider = ganache.provider({
      chain: { chainId: localChain.id },
      wallet: { totalAccounts: 3, defaultBalance: 100 },
      logging: { quiet: true },
    });
    const transport = custom(provider as never);
    publicClient = createPublicClient({ chain: localChain, transport });
    const initialAccounts = Object.values(
      (
        provider as unknown as {
          getInitialAccounts: () => Record<string, GanacheAccount>;
        }
      ).getInitialAccounts(),
    );
    const owner = privateKeyToAccount(initialAccounts[0].secretKey);
    agent = privateKeyToAccount(initialAccounts[1].secretKey);
    const outsider = privateKeyToAccount(initialAccounts[2].secretKey);
    ownerClient = createWalletClient({
      account: owner,
      chain: localChain,
      transport,
    });
    agentClient = createWalletClient({
      account: agent,
      chain: localChain,
      transport,
    });
    outsiderClient = createWalletClient({
      account: outsider,
      chain: localChain,
      transport,
    });

    [mockVerifierArtifact, registryArtifact] = await Promise.all([
      artifact("mocks/MockVerifier.sol", "MockVerifier"),
      artifact("AutoEvolveRegistry.sol", "AutoEvolveRegistry"),
    ]);

    const verifierHash = await ownerClient.deployContract({
      abi: mockVerifierArtifact.abi,
      bytecode: mockVerifierArtifact.bytecode,
    });
    const verifierReceipt = await publicClient.waitForTransactionReceipt({
      hash: verifierHash,
    });
    const mockVerifier = verifierReceipt.contractAddress;
    if (!mockVerifier) {
      throw new Error("Mock verifier deployment did not return an address.");
    }

    const registryHash = await ownerClient.deployContract({
      abi: registryArtifact.abi,
      bytecode: registryArtifact.bytecode,
      args: [mockVerifier, rewardWei],
    });
    const registryReceipt = await publicClient.waitForTransactionReceipt({
      hash: registryHash,
    });
    if (!registryReceipt.contractAddress) {
      throw new Error("Registry deployment did not return an address.");
    }
    registry = registryReceipt.contractAddress;

    const fundHash = await ownerClient.sendTransaction({
      to: registry,
      value: rewardWei * 2n,
    });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });

    runId = keccak256(stringToHex("registry-integration-run"));
    taskHash = keccak256(stringToHex("data-sharing-policy-repair"));
    rubricHash = keccak256(stringToHex("policy-rubric-v1"));
    const [runIdLow, runIdHigh] = limbs(runId);
    const [cidHashLow, cidHashHigh] = limbs(keccak256(stringToHex(cid)));
    const [rubricHashLow, rubricHashHigh] = limbs(rubricHash);

    // Circom exposes output signals first, followed by declared public inputs.
    publicSignals = [
      40n,
      70n,
      1n,
      11n,
      22n,
      runIdLow,
      runIdHigh,
      cidHashLow,
      cidHashHigh,
      BigInt(agent.address),
      2n,
      rubricHashLow,
      rubricHashHigh,
    ];
    proof = {
      a: [0n, 0n],
      b: [
        [0n, 0n],
        [0n, 0n],
      ],
      c: [0n, 0n],
    };

    const startHash = await agentClient.writeContract({
      address: registry,
      abi: registryArtifact.abi,
      functionName: "startRun",
      args: [runId, taskHash, rubricHash, 11n, 40, cid],
    });
    await publicClient.waitForTransactionReceipt({ hash: startHash });
  });

  it("rejects a CID that is not bound by the supplied public signals", async () => {
    await expect(
      agentClient.writeContract({
        address: registry,
        abi: registryArtifact.abi,
        functionName: "settleImprovement",
        args: [runId, 1, 2, 22n, otherCid, proof, publicSignals],
      }),
    ).rejects.toThrow();
  });

  it("rejects settlement sent by an address other than the run agent", async () => {
    await expect(
      outsiderClient.writeContract({
        address: registry,
        abi: registryArtifact.abi,
        functionName: "settleImprovement",
        args: [runId, 1, 2, 22n, cid, proof, publicSignals],
      }),
    ).rejects.toThrow();
  });

  it("settles a verified transition, records its pointer, pays once, and prevents replay", async () => {
    const settleHash = await agentClient.writeContract({
      address: registry,
      abi: registryArtifact.abi,
      functionName: "settleImprovement",
      args: [runId, 1, 2, 22n, cid, proof, publicSignals],
    });
    await publicClient.waitForTransactionReceipt({ hash: settleHash });

    const run = (await publicClient.readContract({
      address: registry,
      abi: registryArtifact.abi,
      functionName: "getRun",
      args: [runId],
    })) as unknown as {
      policyCommitment: bigint;
      score: number;
      version: number;
      latestCid: string;
    };
    expect(run.policyCommitment).toBe(22n);
    expect(run.score).toBe(70);
    expect(run.version).toBe(2);
    expect(run.latestCid).toBe(cid);

    const pointer = (await publicClient.readContract({
      address: registry,
      abi: registryArtifact.abi,
      functionName: "getLatestVerifiedMemory",
      args: [taskHash],
    })) as unknown as {
      runId: Hex;
      agent: Address;
      version: number;
      score: number;
      cid: string;
      exists: boolean;
    };
    expect(pointer.exists).toBe(true);
    expect(pointer.runId).toBe(runId);
    expect(pointer.agent).toBe(agent.address);
    expect(pointer.version).toBe(2);
    expect(pointer.score).toBe(70);
    expect(pointer.cid).toBe(cid);
    expect(await publicClient.getBalance({ address: registry })).toBe(
      rewardWei,
    );

    await expect(
      agentClient.writeContract({
        address: registry,
        abi: registryArtifact.abi,
        functionName: "settleImprovement",
        args: [runId, 1, 2, 22n, cid, proof, publicSignals],
      }),
    ).rejects.toThrow();
  });
});
