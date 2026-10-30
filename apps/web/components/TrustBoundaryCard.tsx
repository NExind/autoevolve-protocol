"use client";

import { useState } from "react";
import { PublicSignalsModal } from "./PublicSignalsModal";

export function TrustBoundaryCard() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <aside
        className="proofBoundary"
        aria-label="Cryptographic trust boundary"
      >
        <div className="boundaryTop">
          <span className="boundaryGlyph">∎</span>
          <span>CRYPTOGRAPHIC TRUST BOUNDARY</span>
        </div>

        <p className="boundaryLead">
          We prove a <strong>deterministic arithmetic score increase</strong>{" "}
          over private policy commitments—<strong>not</strong> hidden LLM
          reasoning, prompt truth, or generalized model intelligence.
        </p>

        <div className="boundarySplitGrid">
          <div className="boundarySplitCol provenCol">
            <span className="splitHeader">✓ WHAT IS PROVEN BY ZK</span>
            <ul>
              <li>
                Strict score monotonicity:{" "}
                <code>nextScore &gt; previousScore</code>
              </li>
              <li>
                Deterministic satisfaction of 10 fixed rubric rules (100 pt
                ceiling)
              </li>
              <li>Poseidon commitment to private policy witness</li>
              <li>
                Immutable binding to run ID, stage, agent, and IPFS CID hash
              </li>
            </ul>
          </div>
          <div className="boundarySplitCol unprovenCol">
            <span className="splitHeader">✕ WHAT IS NOT PROVEN</span>
            <ul>
              <li>Hidden chain-of-thought or LLM prompt reasoning</li>
              <li>Factual truth of unconstrained model generations</li>
              <li>Subjective or generalized agent intelligence</li>
            </ul>
          </div>
        </div>

        <div className="boundaryLine">
          <span>10 deterministic checks</span>
          <span>100 point ceiling</span>
          <span>Output-first 13 public signals</span>
          <button
            type="button"
            className="abiInspectBtn"
            onClick={() => setShowModal(true)}
          >
            Inspect 13-Signal ABI ↗
          </button>
        </div>
      </aside>

      {showModal && <PublicSignalsModal onClose={() => setShowModal(false)} />}
    </>
  );
}
