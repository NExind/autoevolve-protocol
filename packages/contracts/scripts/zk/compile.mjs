import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "../../../..");
const circuit = resolve(root, "circuits/AutoEvolveImprovement.circom");
const output = resolve(root, "circuits/build");

const includeDirs = [
  resolve(root, "packages/contracts/node_modules"),
  resolve(root, "node_modules"),
].filter(existsSync);

function run(command, args) {
  let result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error && process.platform === "win32") {
    result = spawnSync(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(circuit)) {
  throw new Error("Circuit source not found.");
}

mkdirSync(output, { recursive: true });
console.log("Compiling AutoEvolve Groth16 circuit...");
const libraryArgs = includeDirs.flatMap((dir) => [
  "-l",
  relative(root, dir).replaceAll("\\", "/"),
]);
run("circom", [
  relative(root, circuit).replaceAll("\\", "/"),
  "--r1cs",
  "--wasm",
  "--sym",
  ...libraryArgs,
  "-o",
  relative(root, output).replaceAll("\\", "/"),
]);
console.log(
  "Circuit compilation complete. Next: trusted setup and snarkjs verifier export.",
);
