import { execSync, spawn } from "node:child_process";
import { existsSync, statSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const testDir = resolve(webRoot, "test");
mkdirSync(testDir, { recursive: true });

const desktopScreenshot = resolve(testDir, "desktop-screenshot.png");
const mobileScreenshot = resolve(testDir, "mobile-screenshot.png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const PORT = 3008;
const BASE_URL = `http://localhost:${PORT}`;

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // server not up yet
    }
    await wait(400);
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms at ${url}`);
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(command, args, { stdio: "inherit", shell: true });
    proc.on("close", (code) => {
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(
            `Command ${command} ${args.join(" ")} exited with code ${code}`,
          ),
        );
    });
  });
}

let serverProcess = null;
function cleanup() {
  if (serverProcess) {
    try {
      execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: "ignore" });
    } catch {}
    serverProcess = null;
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});

async function main() {
  console.log("=== AutoEvolve Dashboard Smoke & Browser QA Suite ===");

  // 1. Start Next.js standalone on designated port
  console.log(`Starting Next.js server on port ${PORT}...`);
  serverProcess = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], {
    cwd: webRoot,
    stdio: "pipe",
    shell: true,
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) =>
    process.stderr.write(`[next err] ${d}`),
  );

  try {
    await waitForServer(BASE_URL);
    console.log(`✓ Next.js server is responsive at ${BASE_URL}\n`);

    // --- TEST 1: Homepage HTML smoke test ---
    console.log("TEST 1: Checking homepage HTML output...");
    const homeRes = await fetch(BASE_URL);
    if (!homeRes.ok)
      throw new Error(`Homepage returned HTTP ${homeRes.status}`);
    const homeHtml = await homeRes.text();

    const expectedStrings = [
      "AutoEvolve",
      "SHOWCASE REPLAY",
      "TRUST BOUNDARY",
      "policy-rubric-v1",
      "Base Sepolia",
      "EXECUTION TRACE",
      "CROSS-AGENT COLLECTIVE MEMORY",
    ];
    for (const exp of expectedStrings) {
      if (!homeHtml.includes(exp)) {
        throw new Error(`Homepage HTML missing expected content: "${exp}"`);
      }
    }
    console.log("✓ Homepage renders all expected sections with zero errors.\n");

    // --- TEST 2: Showcase run replay API ---
    console.log("TEST 2: Verifying POST /api/runs (showcase replay)...");
    const showcaseRes = await fetch(`${BASE_URL}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "showcase" }),
    });
    if (!showcaseRes.ok)
      throw new Error(`Showcase run failed: HTTP ${showcaseRes.status}`);
    const showcaseData = await showcaseRes.json();
    if (showcaseData.mode !== "showcase")
      throw new Error("Mode must be showcase");
    if (
      !showcaseData.warning?.includes("deterministic local showcase replay")
    ) {
      throw new Error("Showcase run must include honest disclosure warning");
    }
    const scores = showcaseData.run.versions.map((v) => v.evaluation.score);
    if (JSON.stringify(scores) !== JSON.stringify([40, 70, 100])) {
      throw new Error(
        `Expected scores [40, 70, 100], got ${JSON.stringify(scores)}`,
      );
    }
    console.log(
      `✓ Showcase replay returns score sequence: ${scores.join(" → ")} (honest disclosure confirmed).\n`,
    );

    // --- TEST 3: Live Gemini without key ---
    console.log("TEST 3: Verifying POST /api/runs (live mode without key)...");
    const liveRes = await fetch(`${BASE_URL}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live" }),
    });
    if (liveRes.status !== 503) {
      throw new Error(
        `Expected HTTP 503 for live run without key, got ${liveRes.status}`,
      );
    }
    const liveData = await liveRes.json();
    if (!liveData.error?.includes("GEMINI_API_KEY")) {
      throw new Error("Error must honestly state GEMINI_API_KEY is required");
    }
    console.log(
      `✓ Live Gemini mode correctly returned HTTP 503 with honest error: "${liveData.error}"\n`,
    );

    // --- TEST 4: Prepared attestation state without Pinata ---
    console.log(
      "TEST 4: Verifying POST /api/attest (snapshot preparation without Pinata JWT)...",
    );
    const attestRes = await fetch(`${BASE_URL}/api/attest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ run: showcaseData.run }),
    });
    if (!attestRes.ok)
      throw new Error(`Attest returned HTTP ${attestRes.status}`);
    const attestData = await attestRes.json();
    if (attestData.status !== "prepared") {
      throw new Error(`Expected status 'prepared', got '${attestData.status}'`);
    }
    if (!attestData.snapshotHash || !attestData.snapshotHash.startsWith("0x")) {
      throw new Error("Expected valid 0x canonical snapshotHash");
    }
    if (attestData.cid) {
      throw new Error("No CID should be returned when PINATA_JWT is unset!");
    }
    console.log(
      `✓ Attestation correctly produced 'prepared' state without fabricating CID (hash: ${attestData.snapshotHash.slice(0, 12)}...).\n`,
    );

    // --- TEST 5: Memory Search without registry ---
    console.log(
      "TEST 5: Verifying GET /api/memory/search without configured registry...",
    );
    const dummyTaskHash = "0x" + "ab".repeat(32);
    const memRes = await fetch(
      `${BASE_URL}/api/memory/search?taskHash=${dummyTaskHash}`,
    );
    if (!memRes.ok)
      throw new Error(`Memory search returned HTTP ${memRes.status}`);
    const memData = await memRes.json();
    if (memData.status !== "unconfigured") {
      throw new Error(
        `Expected status 'unconfigured', got '${memData.status}'`,
      );
    }
    console.log(
      `✓ Memory search returned status 'unconfigured' with honest explanation: "${memData.message}"\n`,
    );

    // --- TEST 6: Real Desktop Browser Smoke Test (1440x900) ---
    console.log(
      "TEST 6: Running real desktop browser smoke test (1440x900) via Chrome...",
    );
    if (existsSync(desktopScreenshot)) unlinkSync(desktopScreenshot);
    await runCommand(`"${chromePath}"`, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--screenshot="${desktopScreenshot}"`,
      "--window-size=1440,900",
      BASE_URL,
    ]);
    if (
      !existsSync(desktopScreenshot) ||
      statSync(desktopScreenshot).size < 10000
    ) {
      throw new Error(
        "Desktop screenshot was not generated or file is too small",
      );
    }
    console.log(
      `✓ Real desktop browser render succeeded! Screenshot captured at ${desktopScreenshot} (${statSync(desktopScreenshot).size} bytes).\n`,
    );

    // --- TEST 7: Real Narrow Mobile Browser Smoke Test (375x812) ---
    console.log(
      "TEST 7: Running real narrow mobile browser smoke test (375x812) via Chrome...",
    );
    if (existsSync(mobileScreenshot)) unlinkSync(mobileScreenshot);
    await runCommand(`"${chromePath}"`, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--screenshot="${mobileScreenshot}"`,
      "--window-size=375,812",
      BASE_URL,
    ]);
    if (
      !existsSync(mobileScreenshot) ||
      statSync(mobileScreenshot).size < 10000
    ) {
      throw new Error(
        "Mobile screenshot was not generated or file is too small",
      );
    }
    console.log(
      `✓ Real narrow mobile browser render succeeded! Screenshot captured at ${mobileScreenshot} (${statSync(mobileScreenshot).size} bytes).\n`,
    );

    console.log(
      "=== ALL DASHBOARD SMOKE AND BROWSER QA CHECKS PASSED PERFECTLY ===",
    );
  } finally {
    cleanup();
  }
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((err) => {
    cleanup();
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
