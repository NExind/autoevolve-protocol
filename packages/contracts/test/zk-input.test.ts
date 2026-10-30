import { execFile as execFileCallback } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(testDirectory, "..");
const inputScript = resolve(packageDirectory, "scripts/zk/generate-input.mjs");
const bytes32RunId =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const cid = "bafybeigdyrztshowcasecidplaceholder";
const agent = "0x0000000000000000000000000000000000000001";

type InputPreview = {
  fixture: string;
  previousScore: number;
  nextScore: number;
  expectedPublicSignals: string[];
};

async function generateInput(fixture: "v1-v2" | "v2-v3", stage: 2 | 3) {
  const { stdout, stderr } = await execFile(
    process.execPath,
    [
      inputScript,
      "--fixture",
      fixture,
      "--run-id",
      bytes32RunId,
      "--cid",
      cid,
      "--agent",
      agent,
      "--stage",
      String(stage),
    ],
    { cwd: packageDirectory },
  );
  return {
    input: JSON.parse(stdout) as Record<string, string>,
    preview: JSON.parse(stderr) as InputPreview,
  };
}

describe("ZK input generator", () => {
  it("emits two continuous output-first public-signal packages", async () => {
    const [v1v2, v2v3] = await Promise.all([
      generateInput("v1-v2", 2),
      generateInput("v2-v3", 3),
    ]);

    expect(v1v2.preview.expectedPublicSignals).toHaveLength(13);
    expect(v2v3.preview.expectedPublicSignals).toHaveLength(13);
    expect([v1v2.preview.previousScore, v1v2.preview.nextScore]).toEqual([
      40, 70,
    ]);
    expect([v2v3.preview.previousScore, v2v3.preview.nextScore]).toEqual([
      70, 100,
    ]);

    // Groth16 public signals: outputs (scores, binding) followed by public inputs.
    expect(v1v2.preview.expectedPublicSignals[0]).toBe("40");
    expect(v1v2.preview.expectedPublicSignals[1]).toBe("70");
    expect(v1v2.preview.expectedPublicSignals[10]).toBe("2");
    expect(v2v3.preview.expectedPublicSignals[0]).toBe("70");
    expect(v2v3.preview.expectedPublicSignals[1]).toBe("100");
    expect(v2v3.preview.expectedPublicSignals[10]).toBe("3");

    // V2 commitment and score must become V3's previous commitment and score.
    expect(v1v2.preview.expectedPublicSignals[4]).toBe(
      v2v3.preview.expectedPublicSignals[3],
    );
    expect(v1v2.preview.expectedPublicSignals[1]).toBe(
      v2v3.preview.expectedPublicSignals[0],
    );

    expect(v1v2.input.previousPolicyCommitment).toBe(
      v1v2.preview.expectedPublicSignals[3],
    );
    expect(v2v3.input.previousPolicyCommitment).toBe(
      v2v3.preview.expectedPublicSignals[3],
    );
  });
});
