import {
  requiredAddress,
  requiredPositiveWei,
  deploymentClients,
} from "./deploy-utils.js";

const registry = requiredAddress("REGISTRY_ADDRESS");
const value = requiredPositiveWei("ESCROW_FUND_WEI");
const { publicClient, walletClient } = deploymentClients();

const hash = await walletClient.sendTransaction({
  to: registry,
  value,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status !== "success") {
  throw new Error(`Escrow funding transaction ${hash} failed.`);
}

console.log(
  JSON.stringify(
    {
      network: "base-sepolia",
      registry,
      value: value.toString(),
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    },
    null,
    2,
  ),
);
