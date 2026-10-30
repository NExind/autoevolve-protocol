import {
  createDeterministicCritic,
  createGeminiPolicyGenerator,
  dataDaoPolicyTask,
  createShowcaseRun,
  runAgentLoop,
} from "@autoevolve/core";
import { z } from "zod";

const requestSchema = z
  .object({
    mode: z.enum(["showcase", "live"]).default("showcase"),
  })
  .strict();

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

  try {
    const run = await runAgentLoop({
      task: dataDaoPolicyTask,
      generator: createGeminiPolicyGenerator({
        apiKey,
        model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
      }),
      critic: createDeterministicCritic(),
      // Browser-supplied lessons are intentionally never inserted into a model
      // prompt. Agent Beta integration must use server-side registry → CID →
      // schema-validation retrieval before supplying InheritedLesson values.
      inheritedLessons: [],
    });
    return Response.json({ mode: "live", run });
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
