import { readLatestVerifiedMemory } from "@autoevolve/chain";
import {
  createDeterministicCritic,
  createGeminiPolicyGenerator,
  createShowcaseRun,
  dataDaoPolicyTask,
  runAgentLoop,
  type InheritedLesson,
} from "@autoevolve/core";
import { retrieveVerifiedMemory } from "@autoevolve/memory";
import {
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

const requestSchema = z
  .object({
    mode: z.enum(["showcase", "live"]).default("showcase"),
  })
  .strict();

export interface ServerSideMemoryResolution {
  lessons: InheritedLesson[];
  notice?: string;
  sourceCid?: string;
}

export async function loadVerifiedLessonsServerSide(options?: {
  registryAddress?: string;
  rpcUrl?: string;
  gateway?: string;
  taskHash?: Hex;
  fetcher?: (url: string) => Promise<Response>;
  readPointer?: (
    config: { registryAddress: Address; rpcUrl: string },
    taskHash: Hex,
  ) => Promise<any>;
}): Promise<ServerSideMemoryResolution> {
  const registryAddress =
    options?.registryAddress ?? process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const rpcUrl = options?.rpcUrl ?? process.env.BASE_SEPOLIA_RPC_URL;

  if (!registryAddress || !isAddress(registryAddress) || !rpcUrl) {
    return {
      lessons: [],
      notice:
        "Decentralized memory lookup unavailable: NEXT_PUBLIC_REGISTRY_ADDRESS or BASE_SEPOLIA_RPC_URL not configured.",
    };
  }

  const taskHash =
    options?.taskHash ?? keccak256(stringToHex(dataDaoPolicyTask.id));

  try {
    const pointerReader = options?.readPointer ?? readLatestVerifiedMemory;
    const pointer = await pointerReader(
      { registryAddress: registryAddress as Address, rpcUrl },
      taskHash,
    );
    if (!pointer || !pointer.exists) {
      return {
        lessons: [],
        notice: "No verified on-chain memory pointer recorded for this task.",
      };
    }

    const { lessons } = await retrieveVerifiedMemory({
      pointer,
      gateway:
        options?.gateway ??
        (process.env.PINATA_GATEWAY
          ? `https://${process.env.PINATA_GATEWAY}`
          : undefined),
      fetcher: options?.fetcher,
    });

    if (!lessons.length) {
      return {
        lessons: [],
        sourceCid: pointer.cid,
        notice: `Verified snapshot at ${pointer.cid} contained no allowlisted lessons.`,
      };
    }

    return {
      lessons,
      sourceCid: pointer.cid,
      notice: `Retrieved ${lessons.length} verified lesson(s) from on-chain CID ${pointer.cid}.`,
    };
  } catch (error) {
    // Fail closed: never propagate corrupt, mismatched, or unverified data into the model loop.
    return {
      lessons: [],
      notice: `Verified-memory retrieval failed closed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parseResult = requestSchema.safeParse(json);
  if (!parseResult.success) {
    const details = parseResult.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return Response.json(
      {
        error: `Invalid request payload: ${details}. Untrusted browser prompt or memory fields are rejected.`,
      },
      { status: 400 },
    );
  }

  const body = parseResult.data;
  if (body.mode === "showcase") {
    return Response.json({
      mode: "showcase",
      run: createShowcaseRun(),
      warning:
        "This is a deterministic local showcase replay. No proof, CID, or on-chain transaction is claimed.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Live mode requires GEMINI_API_KEY. The dashboard will not substitute a replay for a live model run.",
      },
      { status: 503 },
    );
  }

  // Server-side-only safe decentralized memory retrieval.
  // Browser inputs cannot supply lessons, prompts, or CIDs.
  const memoryResolution = await loadVerifiedLessonsServerSide();

  try {
    const run = await runAgentLoop({
      task: dataDaoPolicyTask,
      generator: createGeminiPolicyGenerator({
        apiKey,
        model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
      }),
      critic: createDeterministicCritic(),
      inheritedLessons: memoryResolution.lessons,
    });

    return Response.json({
      mode: "live",
      run,
      ...(memoryResolution.notice
        ? { memoryNotice: memoryResolution.notice }
        : {}),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Live agent execution failed.",
      },
      { status: 502 },
    );
  }
}
