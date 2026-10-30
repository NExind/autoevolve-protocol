import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const sourceDirectory = resolve(packageDirectory, "contracts");
const artifactDirectory = resolve(packageDirectory, "artifacts");

function posixPath(value) {
  return value.split(sep).join("/");
}

function walkSolidityFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return walkSolidityFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".sol") ? [entryPath] : [];
  });
}

if (!existsSync(sourceDirectory)) {
  throw new Error("Contract source directory was not found.");
}

const sources = Object.fromEntries(
  walkSolidityFiles(sourceDirectory).map((filePath) => [
    posixPath(relative(sourceDirectory, filePath)),
    { content: readFileSync(filePath, "utf8") },
  ]),
);

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    // The registry validates a deliberately rich 13-signal context. viaIR
    // avoids a compiler stack-depth limit without changing Solidity semantics.
    viaIR: true,
    // Ganache's portable test VM does not yet execute all of solc 0.8.28's
    // newest default opcodes. Paris bytecode is valid on Base Sepolia and
    // keeps the local integration test reproducible across CI hosts.
    evmVersion: "paris",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
      },
    },
  },
};

function findImport(importPath) {
  const requestedPath = resolve(sourceDirectory, importPath);
  if (existsSync(requestedPath)) {
    return { contents: readFileSync(requestedPath, "utf8") };
  }

  return { error: `Unable to resolve Solidity import: ${importPath}` };
}

const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImport }),
);

for (const diagnostic of output.errors ?? []) {
  const message = diagnostic.formattedMessage?.trim() ?? diagnostic.message;
  if (diagnostic.severity === "error") {
    console.error(message);
  } else {
    console.warn(message);
  }
}

if (
  (output.errors ?? []).some((diagnostic) => diagnostic.severity === "error")
) {
  process.exitCode = 1;
} else {
  rmSync(artifactDirectory, { recursive: true, force: true });
  mkdirSync(artifactDirectory, { recursive: true });

  const manifest = [];
  for (const [sourceName, contracts] of Object.entries(
    output.contracts ?? {},
  )) {
    for (const [contractName, contract] of Object.entries(contracts)) {
      const destinationDirectory = resolve(artifactDirectory, sourceName);
      mkdirSync(destinationDirectory, { recursive: true });

      const artifact = {
        contractName,
        sourceName,
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      };
      const artifactPath = resolve(
        destinationDirectory,
        `${contractName}.json`,
      );
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
      manifest.push({
        contractName,
        sourceName,
        artifact: posixPath(relative(packageDirectory, artifactPath)),
      });
    }
  }

  writeFileSync(
    resolve(artifactDirectory, "manifest.json"),
    `${JSON.stringify({ compiler: solc.version(), contracts: manifest }, null, 2)}\n`,
  );
  console.log(
    `Compiled ${manifest.length} Solidity artifacts with solc ${solc.version()}.`,
  );
}
