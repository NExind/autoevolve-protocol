import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { groth16 } from "snarkjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "../../../..");

function parseArguments(values) {
  const result = {};
  const argumentsWithoutSeparator =
    values[0] === "--" ? values.slice(1) : values;
  for (let index = 0; index < argumentsWithoutSeparator.length; index += 1) {
    const flag = argumentsWithoutSeparator[index];
    if (!flag.startsWith("--")) {
      throw new Error("Expected a --name value argument.");
    }
    const key = flag.slice(2);
    const value = argumentsWithoutSeparator[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --" + key + ".");
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function required(options, name) {
  const value = options[name];
  if (!value) {
    throw new Error("Missing required --" + name + " argument.");
  }
  return value;
}

function absolute(value) {
  return resolve(process.cwd(), value);
}

function asDecimal(value, name) {
  if (!/^[0-9]+$/.test(String(value))) {
    throw new Error(name + " must be a non-negative decimal string.");
  }
  return String(value);
}

function toSettlementProof(proof) {
  if (
    !Array.isArray(proof.pi_a) ||
    !Array.isArray(proof.pi_b) ||
    !Array.isArray(proof.pi_c)
  ) {
    throw new Error("snarkjs emitted an unexpected Groth16 proof shape.");
  }
  return {
    a: [
      asDecimal(proof.pi_a[0], "proof.pi_a[0]"),
      asDecimal(proof.pi_a[1], "proof.pi_a[1]"),
    ],
    b: [
      [
        asDecimal(proof.pi_b[0][1], "proof.pi_b[0][1]"),
        asDecimal(proof.pi_b[0][0], "proof.pi_b[0][0]"),
      ],
      [
        asDecimal(proof.pi_b[1][1], "proof.pi_b[1][1]"),
        asDecimal(proof.pi_b[1][0], "proof.pi_b[1][0]"),
      ],
    ],
    c: [
      asDecimal(proof.pi_c[0], "proof.pi_c[0]"),
      asDecimal(proof.pi_c[1], "proof.pi_c[1]"),
    ],
  };
}

async function proveTransition({
  inputPath,
  wasmPath,
  zkeyPath,
  verificationKeyPath,
  outputDirectory,
}) {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const verificationKey = JSON.parse(
    await readFile(verificationKeyPath, "utf8"),
  );
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
  );

  if (!Array.isArray(publicSignals) || publicSignals.length !== 13) {
    throw new Error(
      "Expected exactly 13 public signals from AutoEvolveImprovement.",
    );
  }
  const normalizedPublicSignals = publicSignals.map((value, index) =>
    asDecimal(value, "publicSignals[" + index + "]"),
  );
  if (
    BigInt(normalizedPublicSignals[1]) <= BigInt(normalizedPublicSignals[0])
  ) {
    throw new Error("Proof output does not show strict score improvement.");
  }

  const verified = await groth16.verify(
    verificationKey,
    normalizedPublicSignals,
    proof,
  );
  if (!verified) {
    throw new Error(
      "Local Groth16 verification failed. No settlement payload was written.",
    );
  }

  const settlement = {
    schemaVersion: "autoevolve-settlement/v1",
    locallyVerified: true,
    verifiedAt: new Date().toISOString(),
    publicSignalOrder: "outputs-first-v1",
    proof: toSettlementProof(proof),
    publicSignals: normalizedPublicSignals,
  };

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outputDirectory, "proof.json"),
      JSON.stringify(proof, null, 2) + "\n",
      "utf8",
    ),
    writeFile(
      resolve(outputDirectory, "public.json"),
      JSON.stringify(normalizedPublicSignals, null, 2) + "\n",
      "utf8",
    ),
    writeFile(
      resolve(outputDirectory, "settlement.json"),
      JSON.stringify(settlement, null, 2) + "\n",
      "utf8",
    ),
  ]);

  const result = {
    locallyVerified: true,
    outputDirectory,
    publicSignals: normalizedPublicSignals,
    settlementArtifact: resolve(outputDirectory, "settlement.json"),
  };
  return result;
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  const wasmPath = resolve(
    root,
    "circuits/build/AutoEvolveImprovement_js/AutoEvolveImprovement.wasm",
  );
  const zkeyPath = resolve(
    root,
    "circuits/build/AutoEvolveImprovement_final.zkey",
  );
  const verificationKeyPath = resolve(
    root,
    "circuits/build/verification_key.json",
  );

  const v1v2 = await proveTransition({
    inputPath: resolve(root, "circuits/build/v1-v2-input.json"),
    wasmPath,
    zkeyPath,
    verificationKeyPath,
    outputDirectory: resolve(root, "circuits/proofs/v1-v2"),
  });
  console.log(JSON.stringify({ transition: "v1-v2", ...v1v2 }, null, 2));

  const v2v3 = await proveTransition({
    inputPath: resolve(root, "circuits/build/v2-v3-input.json"),
    wasmPath,
    zkeyPath,
    verificationKeyPath,
    outputDirectory: resolve(root, "circuits/proofs/v2-v3"),
  });
  console.log(JSON.stringify({ transition: "v2-v3", ...v2v3 }, null, 2));

  process.exit(0);
}

const options = parseArguments(rawArgs);
const inputPath = absolute(required(options, "input"));
const wasmPath = absolute(
  options.wasm ??
    resolve(
      root,
      "circuits/build/AutoEvolveImprovement_js/AutoEvolveImprovement.wasm",
    ),
);
const zkeyPath = absolute(required(options, "zkey"));
const verificationKeyPath = absolute(required(options, "verification-key"));
const outputDirectory = absolute(
  options.out ??
    resolve(root, "circuits/proofs/" + (options.label ?? "local-proof")),
);

const result = await proveTransition({
  inputPath,
  wasmPath,
  zkeyPath,
  verificationKeyPath,
  outputDirectory,
});

console.log(JSON.stringify(result, null, 2));
process.exit(0);
