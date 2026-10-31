import { readLatestVerifiedMemory } from "@autoevolve/chain";
import {
  createDeterministicCritic,
  createFeatherlessCritic,
  createFeatherlessPolicyGenerator,
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
    userPrompt: z
      .string()
      .max(500, "userPrompt must not exceed 500 characters")
      .optional(),
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
  const rawPrompt = body.userPrompt?.trim();
  const sanitizedPrompt = rawPrompt
    ? rawPrompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 500)
    : undefined;

  if (body.mode === "showcase") {
    const showcaseRun = createShowcaseRun();
    if (sanitizedPrompt) {
      showcaseRun.userPrompt = sanitizedPrompt;
    }
    return Response.json({
      mode: "showcase",
      run: showcaseRun,
      warning:
        "This is a deterministic local showcase replay. No proof, CID, or on-chain transaction is claimed.",
    });
  }

  const featherlessKey = process.env.FEATHERLESS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!featherlessKey && !geminiKey) {
    return Response.json(
      {
        error:
          "Live mode requires GEMINI_API_KEY or FEATHERLESS_API_KEY. The dashboard will not substitute a replay for a live model run.",
      },
      { status: 503 },
    );
  }

  // Server-side-only safe decentralized memory retrieval.
  // Browser inputs cannot supply lessons, prompts, or CIDs.
  const memoryResolution = await loadVerifiedLessonsServerSide();

  // Select provider: Featherless (adversarial LLM critic) takes priority when key is present.
  const generator = featherlessKey
    ? createFeatherlessPolicyGenerator({
        apiKey: featherlessKey,
        model:
          process.env.FEATHERLESS_GENERATOR_MODEL ??
          "Qwen/Qwen2.5-Coder-32B-Instruct",
      })
    : createGeminiPolicyGenerator({
        apiKey: geminiKey!,
        model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      });

  const critic =
    featherlessKey && process.env.FEATHERLESS_CRITIC_MODEL
      ? createFeatherlessCritic({
          apiKey: featherlessKey,
          model: process.env.FEATHERLESS_CRITIC_MODEL,
        })
      : createDeterministicCritic();

  try {
    const run = await runAgentLoop({
      task: dataDaoPolicyTask,
      generator,
      critic,
      inheritedLessons: memoryResolution.lessons,
      userPrompt: sanitizedPrompt,
    });

    return Response.json({
      mode: "live",
      run,
      provider: featherlessKey ? "featherless" : "gemini",
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
