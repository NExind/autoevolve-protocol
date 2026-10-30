import { spawnSync } from "node:child_process";

function repositoryArgument() {
  const position = process.argv.indexOf("--repo");
  const repository = position >= 0 ? process.argv[position + 1] : undefined;
  if (!repository || !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error("Usage: pnpm github:bootstrap -- --repo OWNER/REPOSITORY");
  }
  return repository;
}

function command(args, capture = false) {
  const result = spawnSync("gh", args, {
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    if (capture && result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  return capture ? result.stdout : undefined;
}

const repository = repositoryArgument();
const labels = [
  ["agent:core", "1D76DB", "Owns the evaluator and run route"],
  ["agent:zk", "5319E7", "Owns circuits and Solidity"],
  ["agent:memory", "0E8A16", "Owns IPFS, chain SDK, attestation routes"],
  ["agent:dashboard", "FBCA04", "Owns dashboard presentation"],
  ["p0", "B60205", "Hackathon-critical task"],
  ["p1", "FBCA04", "Important after the critical path"],
  ["rfc", "D4C5F9", "Cross-scope interface proposal"],
  ["human-action", "E99695", "Requires a human credential or approval"],
  ["blocked", "000000", "Cannot proceed without a dependency"],
  ["proof", "7057FF", "ZK proof workflow"],
  ["memory", "0E8A16", "Decentralized memory workflow"],
  ["ui", "FBCA04", "Dashboard or demo workflow"],
];

const tasks = [
  {
    id: "CORE-01",
    title: "Harden the truthful live V1-to-V2-to-V3 agent loop",
    labels: ["agent:core", "p0"],
    body: "Own packages/core and the run route. Verify strict staged improvements, honest guardrail events, provider error behavior, and hand off the stable run shape to memory/dashboard.",
  },
  {
    id: "ZK-01",
    title: "Compile and locally verify both Groth16 transitions",
    labels: ["agent:zk", "p0", "proof"],
    body: "On the x86-64 host, compile the circuit and generate real V1-to-V2 and V2-to-V3 proof artifacts bound to one CID/run/agent. Record only public verification evidence.",
  },
  {
    id: "ZK-02",
    title: "Deploy verifier, registry, escrow, and settle proof transitions",
    labels: ["agent:zk", "p0", "proof", "human-action"],
    body: "After ZK-01 and human-provided local credentials, deploy generated verifier, adapter, registry, fund test-ETH escrow, and retain confirmed Base Sepolia receipts.",
  },
  {
    id: "MEM-01",
    title: "Harden decentralized-memory validation and safe retrieval",
    labels: ["agent:memory", "p0", "memory"],
    body: "Own memory/chain packages and attestation/search routes. Fail closed on malformed snapshots, CID mismatch, unsafe fields, or unverified memory.",
  },
  {
    id: "MEM-02",
    title: "Wire real proof and transaction evidence to Agent Beta memory",
    labels: ["agent:memory", "p0", "memory"],
    body: "After ZK-02, expose only observed CID, locally verified proof, and on-chain settlement evidence; keep raw IPFS out of prompts.",
  },
  {
    id: "UI-01",
    title: "Render every evidence state honestly and test the dashboard",
    labels: ["agent:dashboard", "p0", "ui"],
    body: "Own dashboard presentation. Show unconfigured, prepared, pinned, locally verified, and on-chain settled states without fabricated visual evidence.",
  },
  {
    id: "DEMO-01",
    title: "Prepare the resilient five-minute judge demo",
    labels: ["agent:dashboard", "p0", "ui"],
    body: "After integration, add only evidence-backed explorer/CID links, rehearse replay and live paths, and capture the demo sequence.",
  },
  {
    id: "OPS-01",
    title: "Configure repository collaboration and CI",
    labels: ["p1", "human-action"],
    body: "Human-owned: authenticate GitHub, retain branch protections if available, and confirm agents can use issues/PRs. Do not paste secrets in issues.",
  },
];

for (const [name, color, description] of labels) {
  command([
    "label",
    "create",
    name,
    "--color",
    color,
    "--description",
    description,
    "--force",
    "--repo",
    repository,
  ]);
}

for (const task of tasks) {
  const existingJson = command(
    [
      "issue",
      "list",
      "--repo",
      repository,
      "--state",
      "all",
      "--search",
      task.id + " in:title",
      "--json",
      "title",
      "--limit",
      "100",
    ],
    true,
  );
  const existing = JSON.parse(existingJson ?? "[]");
  const alreadyCreated = existing.some((issue) =>
    String(issue.title).includes("[" + task.id + "]"),
  );
  if (alreadyCreated) {
    console.log("Keeping existing issue for " + task.id + ".");
    continue;
  }

  const args = [
    "issue",
    "create",
    "--repo",
    repository,
    "--title",
    "[" + task.id + "] " + task.title,
    "--body",
    [
      "Work-board ID: " + task.id,
      "",
      task.body,
      "",
      "Before editing: read AGENTS.md and coordination/PROTOCOL.md, claim this issue, and keep changes in your ownership boundary.",
      "Completion requires a focused commit/PR, test results, an honest evidence state, and a HANDOFF comment for dependencies.",
    ].join("\n"),
  ];
  for (const label of task.labels) {
    args.push("--label", label);
  }
  command(args);
}

console.log(
  "GitHub labels and autonomous work-board issues are ready. Give each device its matching prompt in prompts/README.md.",
);
