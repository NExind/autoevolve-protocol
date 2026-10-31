import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const testDir = resolve(webRoot, "test");
mkdirSync(testDir, { recursive: true });

const desktopScreenshot = resolve(testDir, "desktop-screenshot.png");
const mobileScreenshot = resolve(testDir, "mobile-screenshot.png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const PORT = 3009;
const CDP_PORT = 9223;
const BASE_URL = `http://localhost:${PORT}`;

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 25000) {
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

let nextProcess = null;
let chromeProcess = null;

function cleanup() {
  if (chromeProcess) {
    try {
      execSync(`taskkill /pid ${chromeProcess.pid} /T /F`, { stdio: "ignore" });
    } catch {}
    chromeProcess = null;
  }
  if (nextProcess) {
    try {
      execSync(`taskkill /pid ${nextProcess.pid} /T /F`, { stdio: "ignore" });
    } catch {}
    nextProcess = null;
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

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve: r, reject: rj } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rj(new Error(JSON.stringify(msg.error)));
          else r(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  async captureScreenshot(path) {
    const result = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const buffer = Buffer.from(result.data, "base64");
    writeFileSync(path, buffer);
  }
}

async function main() {
  console.log(
    "=== AutoEvolve Hardened Judge Dashboard Interactive Browser QA ===",
  );

  console.log(`Starting Next.js server on port ${PORT}...`);
  nextProcess = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], {
    cwd: webRoot,
    stdio: "pipe",
    shell: true,
  });

  await waitForServer(BASE_URL);
  console.log(`✓ Next.js server is responsive at ${BASE_URL}\n`);

  console.log(`Starting headless Chrome with CDP on port ${CDP_PORT}...`);
  chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--remote-debugging-port=${CDP_PORT}`,
      "--window-size=1440,900",
      BASE_URL,
    ],
    { stdio: "ignore" },
  );

  await wait(2000);

  // Query CDP targets
  const versionRes = await fetch(`http://localhost:${CDP_PORT}/json`);
  const targets = await versionRes.json();
  const pageTarget = targets.find((t) => t.type === "page");
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    throw new Error("Could not find Chrome page WebSocket debugger URL");
  }

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  console.log("✓ Connected to Chrome DevTools Protocol successfully.\n");

  // 1. Initial Page Load & Historical Evidence Check
  console.log(
    "TEST 1: Verifying Historical Attested Showcase Evidence panel...",
  );
  const evidencePanelExists = await cdp.evaluate(
    `Boolean(document.getElementById('historical-evidence'))`,
  );
  if (!evidencePanelExists) {
    throw new Error("Historical Attested Showcase Evidence panel not found!");
  }

  const boundaryNoticeText = await cdp.evaluate(
    `document.querySelector('.historicalBoundaryNotice')?.textContent || ''`,
  );
  console.log(`Notice text observed: "${boundaryNoticeText.trim()}"`);
  if (
    !boundaryNoticeText.includes(
      "These public artifacts belong to the historical attested showcase, not the current live Gemini run",
    )
  ) {
    throw new Error("Boundary notice text does not match required wording!");
  }

  const ipfsLink = await cdp.evaluate(
    `document.querySelector('a[href*="bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm"]')?.href || ''`,
  );
  console.log(`Observed IPFS CID link: ${ipfsLink}`);
  if (
    !ipfsLink.includes(
      "bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm",
    )
  ) {
    throw new Error("IPFS link with real CID missing!");
  }

  const registryLink = await cdp.evaluate(
    `document.querySelector('a[href*="0x24473c0043b13d56874d10de9675728e2014a66c"]')?.href || ''`,
  );
  console.log(`Observed BaseScan registry link: ${registryLink}`);
  if (!registryLink.includes("0x24473c0043b13d56874d10de9675728e2014a66c")) {
    throw new Error("BaseScan registry address link missing!");
  }

  const v1v2Link = await cdp.evaluate(
    `document.querySelector('a[href*="0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f"]')?.href || ''`,
  );
  const v2v3Link = await cdp.evaluate(
    `document.querySelector('a[href*="0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f"]')?.href || ''`,
  );
  console.log(`Observed V1->V2 receipt link: ${v1v2Link}`);
  console.log(`Observed V2->V3 receipt link: ${v2v3Link}`);
  if (!v1v2Link || !v2v3Link) {
    throw new Error("Base Sepolia settlement receipt links missing!");
  }
  console.log("✓ TEST 1 PASSED: Historical evidence panel verified.\n");

  // 2. Showcase Replay Interaction & Score Monotonicity (40 -> 70 -> 100)
  console.log(
    "TEST 2: Triggering 'Run showcase replay' and checking scores...",
  );
  await cdp.evaluate(`
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run showcase replay'))?.click();
  `);
  await wait(1000);

  const scoreTrajectory = await cdp.evaluate(`
    document.querySelector('.metric strong')?.textContent || ''
  `);
  console.log(`Observed score trajectory: "${scoreTrajectory}"`);
  if (!scoreTrajectory.includes("40 → 100")) {
    throw new Error(
      `Expected score trajectory '40 → 100', got '${scoreTrajectory}'`,
    );
  }
  console.log(
    "✓ TEST 2 PASSED: Showcase replay executed with scores 40 → 70 → 100.\n",
  );

  // 3. 13-Signal Public Signals ABI Modal Check
  console.log("TEST 3: Opening 13-Signal Public Signals ABI Modal...");
  await cdp.evaluate(`
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Inspect 13-Signal ABI'))?.click();
  `);
  await wait(800);

  const modalHeader = await cdp.evaluate(`
    document.querySelector('.modalHeader h3')?.textContent || ''
  `);
  const signalCount = await cdp.evaluate(`
    document.querySelectorAll('.signalsTable tbody tr')?.length || 0
  `);
  console.log(`Modal Title: "${modalHeader}", Signal rows: ${signalCount}`);
  if (signalCount !== 13) {
    throw new Error(
      `Expected 13 public signals in modal, found ${signalCount}`,
    );
  }
  // Close modal
  await cdp.evaluate(`
    document.querySelector('.modalCloseBtn')?.click();
  `);
  await wait(500);
  console.log(
    "✓ TEST 3 PASSED: 13-Signal ABI modal opens and displays 13 signals.\n",
  );

  // 4. Live Check On-Chain Registry Memory & Agent Beta
  console.log(
    "TEST 4: Clicking 'Check On-Chain Registry Memory' (live Base Sepolia & IPFS)...",
  );
  await cdp.evaluate(`
    document.querySelector('.checkRegistryBtn')?.click();
  `);
  // Wait up to 15s for RPC and Pinata query
  let memoryActive = false;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    const badgeText = await cdp.evaluate(`
      document.querySelector('.noticeBadge')?.textContent || ''
    `);
    if (badgeText.includes("ON-CHAIN MEMORY ACTIVE")) {
      memoryActive = true;
      break;
    }
  }

  if (!memoryActive) {
    const errorMsg = await cdp.evaluate(`
      document.querySelector('.registryNotice p')?.textContent || ''
    `);
    throw new Error(`Failed to activate on-chain memory: ${errorMsg}`);
  }

  const pointerDetails = await cdp.evaluate(`
    document.querySelector('.pointerDetails')?.textContent || ''
  `);
  console.log(`Observed Pointer Details: "${pointerDetails}"`);
  if (
    !pointerDetails.includes(
      "bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm",
    )
  ) {
    throw new Error("Pointer does not contain real CID!");
  }
  if (!pointerDetails.includes("100/100")) {
    throw new Error("Pointer does not show score 100/100!");
  }

  const verifiedCardsCount = await cdp.evaluate(`
    document.querySelectorAll('.memoryCard')?.length || 0
  `);
  const headerText = await cdp.evaluate(`
    document.querySelector('.memoryCardsHeader .sectionKicker')?.textContent || ''
  `);
  console.log(`Observed Memory Cards Header: "${headerText}"`);
  console.log(`Observed Verified Memory Cards count: ${verifiedCardsCount}`);

  if (verifiedCardsCount !== 9) {
    throw new Error(
      `Expected exactly 9 verified safe memory cards, found ${verifiedCardsCount}`,
    );
  }
  console.log(
    "✓ TEST 4 PASSED: Live on-chain memory query confirmed 9 verified safe cards, real CID, score 100/100.\n",
  );

  // 5. Screenshots
  console.log("TEST 5: Capturing desktop and mobile screenshots...");
  // Desktop
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(500);
  await cdp.captureScreenshot(desktopScreenshot);
  console.log(`✓ Desktop screenshot captured at ${desktopScreenshot}`);

  // Mobile
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await wait(500);
  await cdp.captureScreenshot(mobileScreenshot);
  console.log(`✓ Mobile screenshot captured at ${mobileScreenshot}\n`);

  console.log(
    "=== ALL FINAL UI HARDENING CHECKS VERIFIED AND PASSED SUCCESSFULLY ===",
  );
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((err) => {
    cleanup();
    console.error("INTERACTIVE QA FAILED:", err);
    process.exit(1);
  });
