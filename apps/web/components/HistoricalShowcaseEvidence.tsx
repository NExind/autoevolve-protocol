"use client";

interface HistoricalShowcaseEvidenceProps {
  explorerBaseUrl?: string;
  pinataGateway?: string;
}

const HISTORICAL_DATA = {
  runId: "showcase-run-2026-10-30",
  scores: "40 → 70 → 100",
  taskName: "DataDAO Health Research Sharing Policy",
  taskId: "health-research-sharing-v1",
  taskHash:
    "0xee47106d1510135e97c62f99e8ca2e018320588c9da88917a11d55bbeff49890",
  cid: "bafkreieh2vkmptacucurtcu7wrsepinjsmjh4dcbktk6y633ufd25z5ajm",
  snapshotHash:
    "0x8964650c295a1df37ee403ba597e8303c433621aeb959ea41db69d3da517b435",
  registryAddress: "0x24473c0043b13d56874d10de9675728e2014a66c",
  verifierAddress: "0x7c32dcfcaaae6bdcc6f5d2daa61b7e91629aa764",
  adapterAddress: "0xd46ee3e820d12e113af3e6ad7b6867e18d560c37",
  v1v2Tx: "0x50658aff19d309cbc1cab639d1070214f0a66f9b46cef14dcce41f681325884f",
  v2v3Tx: "0xf611bf34e33a4e8b81580a1d4010a0e3343d765aedfb6effee7346b252e8bb5f",
  escrowFundingTx:
    "0xe97cfe3d76aaf64118d8c8e83b79c51086557442a0313442f7b2be7786bfc78c",
  agentWallet: "0xDad3D7fe51f2dBeA9EC02c956304840c5d8A2F46",
};

function truncate(value: string, left = 8, right = 6): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export function HistoricalShowcaseEvidence({
  explorerBaseUrl = "https://sepolia.basescan.org",
  pinataGateway = "gateway.pinata.cloud",
}: HistoricalShowcaseEvidenceProps) {
  const cleanExplorer = explorerBaseUrl.replace(/\/$/, "");
  const cleanGateway = pinataGateway
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const ipfsGatewayUrl = `https://${cleanGateway}/ipfs/${HISTORICAL_DATA.cid}`;
  const registryUrl = `${cleanExplorer}/address/${HISTORICAL_DATA.registryAddress}`;
  const verifierUrl = `${cleanExplorer}/address/${HISTORICAL_DATA.verifierAddress}`;
  const adapterUrl = `${cleanExplorer}/address/${HISTORICAL_DATA.adapterAddress}`;
  const v1v2TxUrl = `${cleanExplorer}/tx/${HISTORICAL_DATA.v1v2Tx}`;
  const v2v3TxUrl = `${cleanExplorer}/tx/${HISTORICAL_DATA.v2v3Tx}`;
  const escrowTxUrl = `${cleanExplorer}/tx/${HISTORICAL_DATA.escrowFundingTx}`;

  return (
    <section
      id="historical-evidence"
      className="panel historicalEvidencePanel"
      aria-label="Historical Attested Showcase Evidence"
    >
      <div className="historicalHeader">
        <div className="historicalTitleGroup">
          <p className="sectionKicker">PROVEN ON-CHAIN & IPFS EVIDENCE</p>
          <h3>Historical Attested Showcase Evidence</h3>
        </div>
        <div className="historicalHeaderBadges">
          <span className="historicalScoreBadge">
            SCORE PATH: <strong>{HISTORICAL_DATA.scores}</strong>
          </span>
          <span className="historicalRunBadge">
            RUN: <code>{truncate(HISTORICAL_DATA.runId, 12, 6)}</code>
          </span>
        </div>
      </div>

      <div className="historicalBoundaryNotice" role="note">
        <span className="noticeIcon" aria-hidden="true">
          ⚖️
        </span>
        <div className="boundaryText">
          <strong>Non-Negotiable Evidence Boundary:</strong>
          <span>
            {" "}
            These public artifacts belong to the historical attested showcase,
            not the current live Gemini run.
          </span>
        </div>
      </div>

      <div className="historicalGrid">
        {/* Artifact 1: IPFS Sanitized Memory */}
        <div className="historicalCard">
          <div className="cardTop">
            <span className="cardTypeBadge ipfsBadge">
              IPFS PINATA SNAPSHOT
            </span>
            <span className="cardStatusLabel">PINNED & VERIFIED</span>
          </div>
          <h4 className="cardTitle">Sanitized Memory Snapshot</h4>
          <p className="cardSummary">
            Canonical <code>SnapshotCore</code> containing 9 allowlisted memory
            cards with zero prompt or secret leakage.
          </p>
          <div className="cardDetails">
            <div className="cardDetailRow">
              <span className="detailKey">IPFS CID:</span>
              <a
                href={ipfsGatewayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title={`Open IPFS CID ${HISTORICAL_DATA.cid} on gateway`}
              >
                <code>{truncate(HISTORICAL_DATA.cid, 12, 8)}</code> ↗
              </a>
            </div>
            <div className="cardDetailRow">
              <span className="detailKey">Payload SHA-256:</span>
              <code title={HISTORICAL_DATA.snapshotHash}>
                {truncate(HISTORICAL_DATA.snapshotHash, 10, 6)}
              </code>
            </div>
          </div>
        </div>

        {/* Artifact 2: Base Sepolia Registry */}
        <div className="historicalCard">
          <div className="cardTop">
            <span className="cardTypeBadge chainBadge">
              BASE SEPOLIA (84532)
            </span>
            <span className="cardStatusLabel">REGISTRY DEPLOYED</span>
          </div>
          <h4 className="cardTitle">AutoEvolveRegistry Contract</h4>
          <p className="cardSummary">
            Stores immutable memory pointers binding task hash to CID keccak256
            hash with versioned scores.
          </p>
          <div className="cardDetails">
            <div className="cardDetailRow">
              <span className="detailKey">Registry Address:</span>
              <a
                href={registryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title={`View registry on BaseScan`}
              >
                <code>{truncate(HISTORICAL_DATA.registryAddress, 8, 6)}</code>{" "}
                ↗
              </a>
            </div>
            <div className="cardDetailRow">
              <span className="detailKey">Settled Pointer:</span>
              <span>v3 · 100/100 · 9 lessons</span>
            </div>
          </div>
        </div>

        {/* Artifact 3: V1 -> V2 Settlement Receipt */}
        <div className="historicalCard">
          <div className="cardTop">
            <span className="cardTypeBadge zkBadge">GROTH16 SETTLEMENT</span>
            <span className="cardStatusLabel">CONFIRMED ON-CHAIN</span>
          </div>
          <h4 className="cardTitle">V1 → V2 Settlement Receipt</h4>
          <p className="cardSummary">
            Verified score leap 40 → 70. EVM precompile pairing check passed.
            Paid 0.0001 ETH bounty.
          </p>
          <div className="cardDetails">
            <div className="cardDetailRow">
              <span className="detailKey">Transaction Hash:</span>
              <a
                href={v1v2TxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title="View V1->V2 settlement receipt on BaseScan"
              >
                <code>{truncate(HISTORICAL_DATA.v1v2Tx, 10, 8)}</code> ↗
              </a>
            </div>
            <div className="cardDetailRow">
              <span className="detailKey">Block & Reward:</span>
              <span>Block 52402461 · +30 pts (0.0001 ETH)</span>
            </div>
          </div>
        </div>

        {/* Artifact 4: V2 -> V3 Settlement Receipt */}
        <div className="historicalCard">
          <div className="cardTop">
            <span className="cardTypeBadge zkBadge">GROTH16 SETTLEMENT</span>
            <span className="cardStatusLabel">CONFIRMED ON-CHAIN</span>
          </div>
          <h4 className="cardTitle">V2 → V3 Settlement Receipt</h4>
          <p className="cardSummary">
            Verified final improvement 70 → 100. All 10 rubric checks satisfied.
            Bound to real CID.
          </p>
          <div className="cardDetails">
            <div className="cardDetailRow">
              <span className="detailKey">Transaction Hash:</span>
              <a
                href={v2v3TxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title="View V2->V3 settlement receipt on BaseScan"
              >
                <code>{truncate(HISTORICAL_DATA.v2v3Tx, 10, 8)}</code> ↗
              </a>
            </div>
            <div className="cardDetailRow">
              <span className="detailKey">Block & Reward:</span>
              <span>Block 52402476 · +30 pts (0.0001 ETH)</span>
            </div>
          </div>
        </div>

        {/* Artifact 5: Groth16 Verifier Contract */}
        <div className="historicalCard">
          <div className="cardTop">
            <span className="cardTypeBadge verifierBadge">SNARK VERIFIER</span>
            <span className="cardStatusLabel">DEPLOYED ON-CHAIN</span>
          </div>
          <h4 className="cardTitle">Generated Groth16 Verifier</h4>
          <p className="cardSummary">
            Compiled from Circom 2 R1CS circuit with 6,448 constraints. Performs
            on-chain bn128 pairing check.
          </p>
          <div className="cardDetails">
            <div className="cardDetailRow">
              <span className="detailKey">Verifier Address:</span>
              <a
                href={verifierUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title="View verifier on BaseScan"
              >
                <code>{truncate(HISTORICAL_DATA.verifierAddress, 8, 6)}</code>{" "}
                ↗
              </a>
            </div>
            <div className="cardDetailRow">
              <span className="detailKey">Adapter Address:</span>
              <a
                href={adapterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title="View adapter on BaseScan"
              >
                <code>{truncate(HISTORICAL_DATA.adapterAddress, 8, 6)}</code> ↗
              </a>
            </div>
          </div>
        </div>

        {/* Artifact 6: Escrow Funding */}
        <div className="historicalCard">
          <div className="cardTop">
            <span className="cardTypeBadge escrowBadge">ESCROW TREASURY</span>
            <span className="cardStatusLabel">FUNDED & ACTIVE</span>
          </div>
          <h4 className="cardTitle">Registry Micro-Reward Escrow</h4>
          <p className="cardSummary">
            Autonomous bounty pool that disburses rewards upon verified score
            monotonicity transitions.
          </p>
          <div className="cardDetails">
            <div className="cardDetailRow">
              <span className="detailKey">Funding Tx:</span>
              <a
                href={escrowTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="detailLink"
                title="View escrow funding receipt on BaseScan"
              >
                <code>{truncate(HISTORICAL_DATA.escrowFundingTx, 10, 8)}</code>{" "}
                ↗
              </a>
            </div>
            <div className="cardDetailRow">
              <span className="detailKey">Agent Recipient:</span>
              <code title={HISTORICAL_DATA.agentWallet}>
                {truncate(HISTORICAL_DATA.agentWallet, 6, 4)}
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
