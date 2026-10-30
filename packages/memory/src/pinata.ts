import { PinataSDK } from "pinata";
import type { Hex } from "viem";
import type { PinResult, SnapshotCore } from "./types";
import {
  assertCid,
  assertCidMatchesHash,
  parseSnapshotCore,
  verifySnapshotIntegrity,
} from "./validation";

export async function pinSnapshotToPinata(
  snapshot: SnapshotCore,
  config: { jwt: string; gateway?: string },
): Promise<PinResult> {
  if (!config.jwt) {
    throw new Error("PINATA_JWT is required to pin a public snapshot.");
  }
  const validated = await verifySnapshotIntegrity(parseSnapshotCore(snapshot));
  const pinata = new PinataSDK({
    pinataJwt: config.jwt,
    ...(config.gateway ? { pinataGateway: config.gateway } : {}),
  });
  const filename = `autoevolve-${validated.runId}.json`;
  const file = new File([JSON.stringify(validated)], filename, {
    type: "application/json",
  });
  const upload = await pinata.upload.public.file(file);
  const cid = assertCid(upload.cid);
  const gatewayBase = config.gateway
    ? `https://${config.gateway}`
    : "https://gateway.pinata.cloud";
  return { cid, gatewayUrl: `${gatewayBase}/ipfs/${cid}` };
}

export async function fetchPublicSnapshot(
  cid: string,
  gateway = "https://gateway.pinata.cloud",
  expectedCidHash?: Hex,
): Promise<SnapshotCore> {
  const canonicalCid = assertCid(cid);
  if (expectedCidHash) {
    assertCidMatchesHash(canonicalCid, expectedCidHash);
  }
  const response = await fetch(
    `${gateway.replace(/\/$/, "")}/ipfs/${canonicalCid}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`IPFS gateway responded ${response.status}.`);
  }
  return verifySnapshotIntegrity(parseSnapshotCore(await response.json()));
}
