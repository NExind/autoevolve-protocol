"use client";

import type { AgentRun } from "@autoevolve/core";

export type AttestationState =
  | { status: "idle" }
  | { status: "working" }
  | {
      status:
        | "prepared"
        | "pinned"
        | "locally verified"
        | "on-chain settled"
        | "error";
      message: string;
      cid?: string;
      gatewayUrl?: string;
      snapshotHash?: string;
      txHash?: string;
    };

interface VerifiabilityLedgerProps {
  run: AgentRun;
  attestation: AttestationState;
  onPrepareAttestation: () => Promise<void>;
  registryAddress?: string;
}

function truncate(value: string, left = 8, right = 6): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export function VerifiabilityLedger({
  run,
  attestation,
  onPrepareAttestation,
  registryAddress,
}: VerifiabilityLedgerProps) {
  const isWorking = attestation.status === "working";
  const isPrepared = attestation.status === "prepared";
  const isPinned = attestation.status === "pinned";
  const isVerified = attestation.status === "locally verified";
  const isSettled = attestation.status === "on-chain settled";
  const isError = attestation.status === "error";

  const cid = (attestation as { cid?: string }).cid;
  const gatewayUrl = (attestation as { gatewayUrl?: string }).gatewayUrl;
  const snapshotHash = (attestation as { snapshotHash?: string }).snapshotHash;
  const txHash = (attestation as { txHash?: string }).txHash;

  // Determine current lifecycle state badge
  let lifecycleTag = "UNCONFIGURED";
  let lifecycleClass = "stateUnconfigured";

  if (isSettled) {
    lifecycleTag = "ON-CHAIN SETTLED";
    lifecycleClass = "stateSettled";
  } else if (isVerified) {
    lifecycleTag = "LOCALLY VERIFIED";
    lifecycleClass = "stateVerified";
  } else if (isPinned) {
    lifecycleTag = "PINNED (IPFS)";
    lifecycleClass = "statePinned";
  } else if (isPrepared) {
    lifecycleTag = "PREPARED (LOCAL)";
    lifecycleClass = "statePrepared";
  }

  return (
    <aside
      className="panel ledgerPanel"
      aria-label="Evidence status and verifiability ledger"
    >
      <div className="panelHeader">
        <div>
          <p className="sectionKicker">EVIDENCE STATUS LEDGER</p>
          <h3>5-Stage Verification Lifecycle</h3>
        </div>
        <span className={`statusPill ${lifecycleClass}`}>{lifecycleTag}</span>
      </div>

      <div className="ledgerRows">
        {/* Stage 1: Deterministic Evaluator */}
        <div className="ledgerRow">
          <span
            className="ledgerIcon done"
            title="Deterministic evaluator passed"
          >
            ✓
          </span>
          <div className="ledgerContent">
            <strong>1. Deterministic Evaluator</strong>
            <small>
              Scores derived from 10 fixed rubric checks (40 → 70 → 100)
            </small>
          </div>
          <span className="ledgerState stateSuccess">READY</span>
        </div>

        {/* Stage 2: Circom Proof Circuit */}
        <div className="ledgerRow">
          <span className="ledgerIcon source" title="Circuit source ready">
            ◒
          </span>
          <div className="ledgerContent">
            <strong>2. Circom Proof Circuit</strong>
            <small>
              <code>AutoEvolveImprovement.circom</code> (13-signal output-first
              ABI)
            </small>
          </div>
          <span className="ledgerState stateInfo">SOURCE READY</span>
        </div>

        {/* Stage 3: Decentralized Memory Snapshot */}
        <div className="ledgerRow">
          <span
            className={`ledgerIcon ${isPinned ? "done" : isPrepared ? "pending" : ""}`}
            title="IPFS Memory Snapshot Status"
          >
            {isPinned ? "✓" : isPrepared ? "◐" : "○"}
          </span>
          <div className="ledgerContent">
            <strong>3. IPFS Sanitized Memory</strong>
            <small>
              {isPinned && cid
                ? `Pinned CID: ${truncate(cid, 9, 7)}`
                : isPrepared
                  ? "Snapshot sanitized locally (awaiting Pinata JWT)"
                  : "Sanitized SnapshotCore awaits preparation"}
            </small>
          </div>
          <span
            className={`ledgerState ${isPinned ? "stateSuccess" : isPrepared ? "statePending" : "stateMuted"}`}
          >
            {isPinned ? "PINNED" : isPrepared ? "PREPARED" : "IDLE"}
          </span>
        </div>

        {/* Stage 4: Groth16 Proof Verification */}
        <div className="ledgerRow">
          <span
            className={`ledgerIcon ${isVerified || isSettled ? "done" : ""}`}
            title="Groth16 Proof Verification Status"
          >
            {isVerified || isSettled ? "✓" : "○"}
          </span>
          <div className="ledgerContent">
            <strong>4. Groth16 Proof Verification</strong>
            <small>
              {isVerified || isSettled
                ? "Both transitions locally verified via snarkjs"
                : "Proof generation requires x86-64 host (pnpm zk:prove)"}
            </small>
          </div>
          <span
            className={`ledgerState ${isVerified || isSettled ? "stateSuccess" : "stateMuted"}`}
          >
            {isVerified || isSettled ? "VERIFIED" : "UNPROVEN"}
          </span>
        </div>

        {/* Stage 5: Base Sepolia Registry Settlement */}
        <div className="ledgerRow">
          <span
            className={`ledgerIcon ${isSettled ? "done" : ""}`}
            title="Base Sepolia On-Chain Settlement Status"
          >
            {isSettled ? "✓" : "○"}
          </span>
          <div className="ledgerContent">
            <strong>5. Base Sepolia Settlement</strong>
            <small>
              {isSettled && txHash
                ? `Confirmed receipt: ${truncate(txHash, 8, 6)}`
                : registryAddress
                  ? `Registry: ${truncate(registryAddress, 6, 4)}`
                  : "Registry address unconfigured (requires deploy:registry)"}
            </small>
          </div>
          <span
            className={`ledgerState ${isSettled ? "stateSuccess" : "stateMuted"}`}
          >
            {isSettled ? "SETTLED" : "UNSETTLED"}
          </span>
        </div>
      </div>

      <div className="ledgerActions">
        <button
          type="button"
          className="button buttonLedger"
          disabled={isWorking}
          onClick={onPrepareAttestation}
        >
          {isWorking
            ? "Preparing sanitized snapshot…"
            : "Prepare Sanitized Memory Snapshot"}
        </button>
      </div>

      {attestation.status !== "idle" && attestation.status !== "working" && (
        <div
          className={`attestationMessage ${isError ? "messageError" : isPinned ? "messagePinned" : "messagePrepared"}`}
        >
          <p className="attestStatusTitle">
            {isPinned
              ? "✓ IPFS Memory Pinned Successfully"
              : isPrepared
                ? "◐ Snapshot Sanitized Locally"
                : isError
                  ? "✕ Attestation Action Notice"
                  : "Evidence Report"}
          </p>
          <p className="attestStatusBody">
            {(attestation as { message?: string }).message}
          </p>

          <div className="attestArtifacts">
            {snapshotHash && (
              <div className="artifactRow">
                <span>Canonical Snapshot Hash:</span>
                <code>{truncate(snapshotHash, 14, 10)}</code>
              </div>
            )}

            {cid && gatewayUrl && (
              <div className="artifactRow">
                <span>Public IPFS Gateway:</span>
                <a href={gatewayUrl} target="_blank" rel="noopener noreferrer">
                  {truncate(cid, 12, 8)} ↗
                </a>
              </div>
            )}

            {txHash && (
              <div className="artifactRow">
                <span>BaseScan Sepolia:</span>
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {truncate(txHash, 10, 8)} ↗
                </a>
              </div>
            )}

            {registryAddress && (
              <div className="artifactRow">
                <span>Registry Contract:</span>
                <a
                  href={`https://sepolia.basescan.org/address/${registryAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {truncate(registryAddress, 8, 6)} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
