import { deployArtifact, loadArtifact } from "./deploy-utils.js";

const sourceName =
  process.env.GENERATED_VERIFIER_SOURCE ??
  "generated/GeneratedGroth16Verifier.sol";
const contractName =
  process.env.GENERATED_VERIFIER_CONTRACT_NAME ?? "Groth16Verifier";

const artifact = await loadArtifact(sourceName, contractName);
const deployment = await deployArtifact(artifact);

console.log(
  JSON.stringify(
    {
      network: "base-sepolia",
      sourceName,
      contractName,
      ...deployment,
    },
    null,
    2,
  ),
);
