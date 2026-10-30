import { spawnSync } from "node:child_process";

function repositoryArgument() {
  const position = process.argv.indexOf("--repo");
  const repository = position >= 0 ? process.argv[position + 1] : undefined;
  if (!repository || !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error("Usage: pnpm github:bootstrap -- --repo OWNER/REPOSITORY");
  }
  return repository;
}

function run(args) {
  const result = spawnSync("gh", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const repository = repositoryArgument();
const labels = [
  ["agent:core", "1D76DB", "Owns the evaluator and run route"],
  ["agent:zk", "5319E7", "Owns circuits and Solidity"],
  ["agent:memory", "0E8A16", "Owns IPFS, chain SDK, attestation routes"],
  ["agent:dashboard", "FBCA04", "Owns dashboard presentation"],
  ["p0", "B60205", "Hackathon-critical task"],
  ["rfc", "D4C5F9", "Cross-scope interface proposal"],
  ["human-action", "E99695", "Requires a human credential or approval"],
  ["blocked", "000000", "Cannot proceed without a dependency"],
  ["proof", "7057FF", "ZK proof workflow"],
  ["memory", "0E8A16", "Decentralized memory workflow"],
  ["ui", "FBCA04", "Dashboard or demo workflow"],
];

for (const [name, color, description] of labels) {
  run([
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

console.log(
  "GitHub labels are ready. Create work items from coordination/WORK_BOARD.md.",
);
