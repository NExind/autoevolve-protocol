import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "../../../..");
const circuit = resolve(root, "circuits/AutoEvolveImprovement.circom");
const output = resolve(root, "circuits/build");
const nodeModules = resolve(root, "node_modules");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(circuit)) {
  throw new Error("Circuit source not found.");
}

mkdirSync(output, { recursive: true });
console.log("Compiling AutoEvolve Groth16 circuit...");
run("circom", [
  circuit,
  "--r1cs",
  "--wasm",
  "--sym",
  "-l",
  nodeModules,
  "-o",
  output,
]);
console.log(
  "Circuit compilation complete. Next: trusted setup and snarkjs verifier export.",
);
