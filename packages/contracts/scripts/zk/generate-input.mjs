import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildPoseidon } from "circomlibjs";
import { keccak256, stringToHex } from "viem";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "../../../..");
const scalarField =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const mask128 = (1n << 128n) - 1n;

const policyFields = [
  "RequireConsent",
  "RedactDirectIdentifiers",
  "ResearchPurposeOnly",
  "AuditLogging",
  "BlockRestrictedRegions",
  "RequireDualApprovalHighVolume",
  "MinKAnonymity",
  "MaxExportRows",
  "RetentionDays",
  "DailyRequestLimit",
];

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

function limbs(hash) {
  const value = BigInt(hash);
  return { low: value & mask128, high: value >> 128n };
}

function hashTextOrBytes32(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
    ? value.toLowerCase()
    : keccak256(stringToHex(value));
}

function policyValues(input, prefix) {
  return policyFields.map((suffix) => {
    const value = input[prefix + suffix];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        "Fixture field " + prefix + suffix + " must be a non-negative integer.",
      );
    }
    return BigInt(value);
  });
}

function score(values) {
  const checks = [
    values[0] === 1n,
    values[1] === 1n,
    values[2] === 1n,
    values[3] === 1n,
    values[4] === 1n,
    values[5] === 1n,
    values[6] >= 5n,
    values[7] <= 10000n,
    values[8] <= 30n,
    values[9] <= 100n,
  ];
  return checks.filter(Boolean).length * 10;
}

function decimalInput(fixture, prefix) {
  return Object.fromEntries(
    policyFields.map((suffix) => [
      prefix.toLowerCase() + suffix,
      String(fixture[prefix + suffix]),
    ]),
  );
}

async function computeInput(
  fixtureName,
  runIdText,
  cid,
  agentText,
  stage,
  rubricText,
) {
  if (!/^[a-z0-9-]+$/i.test(fixtureName)) {
    throw new Error("--fixture must be a safe fixture name such as v1-v2.");
  }
  if (stage !== 2n && stage !== 3n) {
    throw new Error("--stage must be 2 or 3.");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(agentText)) {
    throw new Error("--agent must be a 20-byte 0x EVM address.");
  }
  if (cid.length > 128) {
    throw new Error("--cid must be 128 characters or fewer.");
  }

  const fixturePath = resolve(
    root,
    "circuits",
    "fixtures",
    fixtureName + ".json",
  );
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const poseidon = await buildPoseidon();
  const field = poseidon.F;
  const hash = (values) => BigInt(field.toString(poseidon(values)));
  const policyCommitment = (values) =>
    hash([hash(values.slice(0, 5)), hash(values.slice(5, 10))]);

  const previous = policyValues(fixture, "previous");
  const next = policyValues(fixture, "next");
  const previousScore = score(previous);
  const nextScore = score(next);
  if (nextScore <= previousScore) {
    throw new Error("Fixture does not satisfy strict evaluator improvement.");
  }

  const runId = hashTextOrBytes32(runIdText);
  const cidHash = keccak256(stringToHex(cid));
  const rubricHash = hashTextOrBytes32(rubricText ?? "policy-rubric-v1");
  const agent = BigInt(agentText);
  const runLimbs = limbs(runId);
  const cidLimbs = limbs(cidHash);
  const rubricLimbs = limbs(rubricHash);
  const previousPolicyCommitment = policyCommitment(previous);
  const nextPolicyCommitment = policyCommitment(next);
  const metadata = hash([
    runLimbs.low,
    runLimbs.high,
    cidLimbs.low,
    cidLimbs.high,
    agent,
    stage,
    rubricLimbs.low,
    rubricLimbs.high,
  ]);
  const binding = hash([
    previousPolicyCommitment,
    nextPolicyCommitment,
    metadata,
  ]);

  for (const [name, value] of Object.entries({
    previousPolicyCommitment,
    nextPolicyCommitment,
    binding,
  })) {
    if (value >= scalarField) {
      throw new Error(name + " does not fit the BN254 scalar field.");
    }
  }

  const input = {
    ...decimalInput(fixture, "previous"),
    ...decimalInput(fixture, "next"),
    previousPolicyCommitment: previousPolicyCommitment.toString(),
    nextPolicyCommitment: nextPolicyCommitment.toString(),
    runIdLow: runLimbs.low.toString(),
    runIdHigh: runLimbs.high.toString(),
    cidHashLow: cidLimbs.low.toString(),
    cidHashHigh: cidLimbs.high.toString(),
    agent: agent.toString(),
    stage: stage.toString(),
    rubricHashLow: rubricLimbs.low.toString(),
    rubricHashHigh: rubricLimbs.high.toString(),
  };

  const expectedPublicSignals = [
    String(previousScore),
    String(nextScore),
    binding.toString(),
    previousPolicyCommitment.toString(),
    nextPolicyCommitment.toString(),
    runLimbs.low.toString(),
    runLimbs.high.toString(),
    cidLimbs.low.toString(),
    cidLimbs.high.toString(),
    agent.toString(),
    stage.toString(),
    rubricLimbs.low.toString(),
    rubricLimbs.high.toString(),
  ];

  const preview = {
    fixture: fixtureName,
    previousScore,
    nextScore,
    expectedPublicSignals,
    note: "The input contains private policy witness values. Do not commit it or paste it into a public issue.",
  };

  return { input, preview };
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  const buildDir = resolve(root, "circuits", "build");
  await mkdir(buildDir, { recursive: true });
  const defaultRunId =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const defaultCid = "bafybeigdyrztshowcasecidplaceholder";
  const defaultAgent = "0x0000000000000000000000000000000000000001";
  const defaultRubric = "policy-rubric-v1";

  const v1v2 = await computeInput(
    "v1-v2",
    defaultRunId,
    defaultCid,
    defaultAgent,
    2n,
    defaultRubric,
  );
  await writeFile(
    resolve(buildDir, "v1-v2-input.json"),
    JSON.stringify(v1v2.input, null, 2) + "\n",
    "utf8",
  );

  const v2v3 = await computeInput(
    "v2-v3",
    defaultRunId,
    defaultCid,
    defaultAgent,
    3n,
    defaultRubric,
  );
  await writeFile(
    resolve(buildDir, "v2-v3-input.json"),
    JSON.stringify(v2v3.input, null, 2) + "\n",
    "utf8",
  );

  console.log(
    "Generated circuits/build/v1-v2-input.json and circuits/build/v2-v3-input.json",
  );
  process.exit(0);
}

const options = parseArguments(rawArgs);
const fixtureName = options.fixture ?? "v1-v2";
const runIdText = required(options, "run-id");
const cid = required(options, "cid");
const agentText = required(options, "agent");
const stage = BigInt(required(options, "stage"));

const { input, preview } = await computeInput(
  fixtureName,
  runIdText,
  cid,
  agentText,
  stage,
  options.rubric,
);

process.stderr.write(JSON.stringify(preview, null, 2) + "\n");
process.stdout.write(JSON.stringify(input, null, 2) + "\n");
