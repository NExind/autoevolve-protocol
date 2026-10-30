import {
  deployArtifact,
  loadArtifact,
  requiredAddress,
  requiredPositiveWei,
} from "./deploy-utils.js";

const generatedVerifier = requiredAddress("GENERATED_VERIFIER_ADDRESS");
const rewardWei = requiredPositiveWei("REGISTRY_REWARD_WEI", 100000000000000n);

const adapterArtifact = await loadArtifact(
  "Groth16VerifierAdapter.sol",
  "Groth16VerifierAdapter",
);
const adapter = await deployArtifact(adapterArtifact, [generatedVerifier]);

const registryArtifact = await loadArtifact(
  "AutoEvolveRegistry.sol",
  "AutoEvolveRegistry",
);
const registry = await deployArtifact(registryArtifact, [
  adapter.contractAddress,
  rewardWei,
]);

console.log(
  JSON.stringify(
    {
      network: "base-sepolia",
      generatedVerifier,
      adapter,
      registry,
      rewardWei: rewardWei.toString(),
    },
    null,
    2,
  ),
);
