"use client";

import { useEffect } from "react";

interface PublicSignalsModalProps {
  onClose: () => void;
}

const PUBLIC_SIGNALS = [
  {
    index: 0,
    signal: "previousScore",
    kind: "Circuit Output",
    desc: "Prior policy score (derived in-circuit from private witness)",
  },
  {
    index: 1,
    signal: "nextScore",
    kind: "Circuit Output",
    desc: "Revised policy score (constrained strictly > previousScore)",
  },
  {
    index: 2,
    signal: "binding",
    kind: "Circuit Output",
    desc: "Metadata binding commitment",
  },
  {
    index: 3,
    signal: "previousPolicyCommitment",
    kind: "Public Input",
    desc: "Poseidon hash of normalized predecessor policy",
  },
  {
    index: 4,
    signal: "nextPolicyCommitment",
    kind: "Public Input",
    desc: "Poseidon hash of normalized revised policy",
  },
  {
    index: 5,
    signal: "runIdLow",
    kind: "Public Input",
    desc: "Low 128 bits of bytes32 runId",
  },
  {
    index: 6,
    signal: "runIdHigh",
    kind: "Public Input",
    desc: "High 128 bits of bytes32 runId",
  },
  {
    index: 7,
    signal: "cidHashLow",
    kind: "Public Input",
    desc: "Low 128 bits of keccak256(bytes(ipfsCID))",
  },
  {
    index: 8,
    signal: "cidHashHigh",
    kind: "Public Input",
    desc: "High 128 bits of keccak256(bytes(ipfsCID))",
  },
  {
    index: 9,
    signal: "agent",
    kind: "Public Input",
    desc: "Agent EVM address as uint160",
  },
  {
    index: 10,
    signal: "stage",
    kind: "Public Input",
    desc: "Evolution transition stage (2 for V1→V2, 3 for V2→V3)",
  },
  {
    index: 11,
    signal: "rubricHashLow",
    kind: "Public Input",
    desc: "Low 128 bits of rubric identifier hash",
  },
  {
    index: 12,
    signal: "rubricHashHigh",
    kind: "Public Input",
    desc: "High 128 bits of rubric identifier hash",
  },
];

export function PublicSignalsModal({ onClose }: PublicSignalsModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modalBackdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <p className="sectionKicker">CIRCOM 2 / SNARKJS GROTH16</p>
            <h3>Immutable 13-Signal Public ABI</h3>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="modalNotice">
          <strong>Output-first serialization:</strong> Circom serializes main
          component outputs (indices 0–2) <em>before</em> declared public inputs
          (indices 3–12). The generated Solidity verifier,{" "}
          <code>packages/chain</code> client, and Base Sepolia registry rely on
          this exact 13-element layout.
        </p>

        <div className="signalsTableWrapper">
          <table className="signalsTable">
            <thead>
              <tr>
                <th>#</th>
                <th>Signal Identifier</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {PUBLIC_SIGNALS.map((item) => (
                <tr key={item.index}>
                  <td className="signalIdx">{item.index}</td>
                  <td>
                    <code>{item.signal}</code>
                  </td>
                  <td>
                    <span
                      className={
                        item.kind.includes("Output") ? "tagOutput" : "tagInput"
                      }
                    >
                      {item.kind}
                    </span>
                  </td>
                  <td className="signalDesc">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modalFooter">
          <span>
            Contract binding: <code>AutoEvolveRegistry.sol</code> ↔{" "}
            <code>AutoEvolveImprovement.circom</code>
          </span>
          <button
            type="button"
            className="button buttonSecondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
