import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const mailbox = resolve(root, "coordination", "mail");

function readArguments(values) {
  const result = {};
  const argumentsWithoutSeparator =
    values[0] === "--" ? values.slice(1) : values;
  for (let index = 0; index < argumentsWithoutSeparator.length; index += 1) {
    const value = argumentsWithoutSeparator[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = argumentsWithoutSeparator[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}.`);
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function required(input, key) {
  const value = input[key];
  if (!value) {
    throw new Error(`Missing required --${key} argument.`);
  }
  return value;
}

function identifier(value, label) {
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/i.test(value)) {
    throw new Error(`${label} must use only letters, digits, and hyphens.`);
  }
  return value;
}

function noSecrets(value) {
  const secretPattern =
    /(private[_ -]?key|api[_ -]?key|authorization:|bearer\s+[a-z0-9_-]{16,}|0x[a-f0-9]{64})/i;
  if (secretPattern.test(value)) {
    throw new Error(
      "Mailbox messages must not contain secrets or private keys.",
    );
  }
  return value;
}

function slug(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "message"
  );
}

const input = readArguments(process.argv.slice(2));
const from = identifier(required(input, "from"), "from");
const to = identifier(required(input, "to"), "to");
const kind = required(input, "kind").toLowerCase();
const subject = noSecrets(required(input, "subject")).slice(0, 140);
const body = noSecrets(required(input, "body")).slice(0, 4_000);
const task = input.task ? noSecrets(input.task).slice(0, 48) : "unassigned";

if (!["question", "handoff", "blocker", "rfc", "status"].includes(kind)) {
  throw new Error("kind must be question, handoff, blocker, rfc, or status.");
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `${timestamp}-${from}-to-${to}-${slug(subject)}.md`;
const contents = [
  "# Agent mailbox message",
  "",
  `- From: ${from}`,
  `- To: ${to}`,
  `- Kind: ${kind}`,
  `- Task: ${task}`,
  `- UTC: ${new Date().toISOString()}`,
  "",
  "## Subject",
  "",
  subject,
  "",
  "## Message",
  "",
  body,
  "",
].join("\n");

await mkdir(mailbox, { recursive: true });
const destination = resolve(mailbox, filename);
await writeFile(destination, contents, { encoding: "utf8", flag: "wx" });
console.log(`Created coordination/mail/${filename}`);
console.log(
  "Commit this append-only message on your branch and mirror it to GitHub when available.",
);
