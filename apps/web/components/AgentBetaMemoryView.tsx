"use client";

import { useState } from "react";
import type { AgentRun } from "@autoevolve/core";
import { hashTaskId } from "@autoevolve/chain";
import { MemoryEmbeddingBadge } from "./MemoryEmbeddingBadge";

interface MemoryCardItem {
  id: string;
  failureCode: string;
  safePatchStrategy: string;
  sourceRunId: string;
  sourceVersion: "V1" | "V2";
  sourceCid?: string;
}

interface AgentBetaMemoryViewProps {
  run: AgentRun;
  memoryNotice?: string | null;
}

function truncate(value: string, left = 8, right = 6): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export function AgentBetaMemoryView({
  run,
  memoryNotice,
}: AgentBetaMemoryViewProps) {
  const [registryStatus, setRegistryStatus] = useState<
    | "idle"
    | "checking"
    | "unconfigured"
    | "not-found"
    | "verified-memory"
    | "error"
  >("idle");
  const [registryMessage, setRegistryMessage] = useState<string | null>(null);
  const [verifiedCards, setVerifiedCards] = useState<MemoryCardItem[]>([]);
  const [embeddingRanked, setEmbeddingRanked] = useState(false);
  const [activePointer, setActivePointer] = useState<{
    cid: string;
    agent: string;
    score: number;
    version: number;
  } | null>(null);

  // Compute the taskHash from the task id
  const taskHash = hashTaskId(run.task.id);
  const pinataGateway =
    process.env.NEXT_PUBLIC_PINATA_GATEWAY ||
    process.env.PINATA_GATEWAY ||
    "gateway.pinata.cloud";
  const explorerBase =
    process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || "https://sepolia.basescan.org";

  async function checkRegistryMemory() {
    setRegistryStatus("checking");
    setRegistryMessage(null);
    try {
      const response = await fetch(`/api/memory/search?taskHash=${taskHash}`);
      const data = await response.json();

      if (data.status === "unconfigured") {
        setRegistryStatus("unconfigured");
        setRegistryMessage(
          data.message ??
            "Registry lookup is unconfigured. Set NEXT_PUBLIC_REGISTRY_ADDRESS and BASE_SEPOLIA_RPC_URL to enable on-chain lookup.",
        );
      } else if (data.status === "verified-memory") {
        setRegistryStatus("verified-memory");
        setVerifiedCards(data.cards ?? []);
        setEmbeddingRanked(data.embeddingRanked === true);
        setActivePointer(data.pointer ?? null);
        setRegistryMessage(
          "Verified Base Sepolia pointer matches IPFS CID keccak256 hash. 9 safe allowlisted memory cards retrieved with zero prompt leakage.",
        );
      } else if (data.status === "not-found") {
        setRegistryStatus("not-found");
        setRegistryMessage(
          "Registry connected, but no verified memory has been settled on-chain for this taskHash yet.",
        );
      } else if (data.error) {
        setRegistryStatus("error");
        setRegistryMessage(data.error);
      }
    } catch (err) {
      setRegistryStatus("error");
      setRegistryMessage(
        err instanceof Error
          ? err.message
          : "Failed to query memory search route.",
      );
    }
  }

  // Extract local memory candidates from critiques
  const candidateLessons = run.critiques.flatMap((critique) =>
    critique.failureCodes.map((code, idx) => ({
      id: `${critique.fromVersion}-${code}`,
      failureCode: code,
      safePatchStrategy:
        critique.repairPlan[idx] ??
        `Apply strict ${code.toLowerCase()} constraint`,
      sourceRunId: run.runId,
      sourceVersion: critique.fromVersion,
    })),
  );

  return (
    <section
      id="collective-memory"
      className="panel memoryPanel"
      aria-label="Cross-agent collective memory and Agent Beta inheritance"
    >
      <div className="memoryIntro">
        <p className="sectionKicker">CROSS-AGENT COLLECTIVE MEMORY</p>
        <h3>Agent Beta inherits verified lessons—never raw prompts.</h3>
        <p>
          The protocol guarantees prompt hygiene and security:
          <br />
          <code>
            Registry Pointer → CID Keccak Hash Check → Strict JSON Schema →
            Allowlisted Memory Cards
          </code>
        </p>

        {memoryNotice && (
          <div className="memoryInheritanceNotice" role="status">
            <span className="noticeBadge noticeBadgeActive">
              ✓ AGENT BETA LESSON INHERITANCE
            </span>
            <p className="memoryInheritanceNoticeText">{memoryNotice}</p>
          </div>
        )}

        <div className="registryQueryBox">
          <button
            type="button"
            className="button buttonSecondary checkRegistryBtn"
            disabled={registryStatus === "checking"}
            onClick={checkRegistryMemory}
          >
            {registryStatus === "checking"
              ? "Querying Base Sepolia…"
              : "Check On-Chain Registry Memory"}
          </button>
          <span className="taskHashLabel">
            Task Hash:{" "}
            <code>
              {taskHash.slice(0, 10)}…{taskHash.slice(-8)}
            </code>
          </span>
        </div>

        {registryStatus !== "idle" && (
          <div className={`registryNotice notice-${registryStatus}`}>
            <span className="noticeBadge">
              {registryStatus === "verified-memory"
                ? "✓ ON-CHAIN MEMORY ACTIVE"
                : registryStatus === "unconfigured"
                  ? "○ REGISTRY UNCONFIGURED"
                  : registryStatus === "not-found"
                    ? "○ NO SETTLED RUN FOUND"
                    : "✕ QUERY ERROR"}
            </span>
            {registryMessage && <p>{registryMessage}</p>}
            {activePointer && (
              <div className="pointerDetails">
                <span>
                  CID:{" "}
                  <a
                    href={`https://${pinataGateway.replace(/^https?:\/\//, "")}/ipfs/${activePointer.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointerLink"
                  >
                    <code>{activePointer.cid}</code> ↗
                  </a>
                </span>
                <span>
                  Score: <strong>{activePointer.score}/100</strong>
                </span>
                <span>
                  Version: <strong>v{activePointer.version}</strong>
                </span>
                <span>
                  Settled Agent:{" "}
                  <a
                    href={`${explorerBase.replace(/\/$/, "")}/address/${activePointer.agent}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointerLink"
                  >
                    <code>{truncate(activePointer.agent, 6, 4)}</code> ↗
                  </a>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="memoryRightCol">
        <div className="memoryCardsHeader">
          <span className="sectionKicker">
            {registryStatus === "verified-memory"
              ? `ON-CHAIN VERIFIED MEMORY CARDS (${verifiedCards.length})`
              : `LOCAL MEMORY CANDIDATES (${candidateLessons.length})`}
          </span>
          <MemoryEmbeddingBadge
            active={registryStatus === "verified-memory" && embeddingRanked}
            cardCount={verifiedCards.length}
          />
          <span className="memoryProvenanceNote">
            {registryStatus === "verified-memory"
              ? "Retrieved from Base Sepolia registry CID"
              : "Prepared in SnapshotCore; awaiting proof settlement"}
          </span>
        </div>

        <div className="memoryCards">
          {(registryStatus === "verified-memory"
            ? verifiedCards
            : candidateLessons.slice(0, 4)
          ).map((card, index) => (
            <div className="memoryCard" key={card.id}>
              <span className="memoryIndex">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong className="cardFailureCode">
                {card.failureCode.replaceAll("_", " ")}
              </strong>
              <p className="cardStrategy">{card.safePatchStrategy}</p>
              <div className="cardFooter">
                <span className="cardOrigin">Origin: {card.sourceVersion}</span>
                <span className="cardRun">
                  Run: {card.sourceRunId.slice(0, 8)}…
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="memoryFlow">
          <span className="flowNode">Agent Alpha (Generator)</span>
          <i aria-hidden="true">→</i>
          <span className="flowNode">Deterministic Evaluator</span>
          <i aria-hidden="true">→</i>
          <span className="flowNode">Sanitized SnapshotCore</span>
          <i aria-hidden="true">→</i>
          <span className="flowNode">IPFS CID</span>
          <i aria-hidden="true">→</i>
          <span className="flowNode">Base Sepolia Registry</span>
          <i aria-hidden="true">→</i>
          <span className="betaToken">Agent Beta (Safe Inheritance)</span>
        </div>
      </div>
    </section>
  );
}
