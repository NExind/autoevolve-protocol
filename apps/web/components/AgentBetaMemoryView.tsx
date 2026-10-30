"use client";

import { useEffect, useState } from "react";
import type { AgentRun } from "@autoevolve/core";
import { hashTaskId } from "@autoevolve/chain";

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
}

export function AgentBetaMemoryView({ run }: AgentBetaMemoryViewProps) {
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
  const [activePointer, setActivePointer] = useState<{
    cid: string;
    agent: string;
    score: number;
    version: number;
  } | null>(null);

  // Compute the taskHash from the task id
  const taskHash = hashTaskId(run.task.id);

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
        setActivePointer(data.pointer ?? null);
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
            <p>{registryMessage}</p>
            {activePointer && (
              <div className="pointerDetails">
                <span>
                  CID: <code>{activePointer.cid}</code>
                </span>
                <span>
                  Agent: <code>{activePointer.agent}</code>
                </span>
                <span>Score: {activePointer.score}/100</span>
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
          <span className="memoryProvenanceNote">
            {registryStatus === "verified-memory"
              ? "Retrieved from Base Sepolia registry CID"
              : "Prepared in SnapshotCore; awaiting proof settlement"}
          </span>
        </div>

        <div className="memoryCards">
          {(registryStatus === "verified-memory"
            ? verifiedCards
            : candidateLessons
          )
            .slice(0, 4)
            .map((card, index) => (
              <div className="memoryCard" key={card.id}>
                <span className="memoryIndex">0{index + 1}</span>
                <strong className="cardFailureCode">
                  {card.failureCode.replaceAll("_", " ")}
                </strong>
                <p className="cardStrategy">{card.safePatchStrategy}</p>
                <div className="cardFooter">
                  <span className="cardOrigin">
                    Origin: {card.sourceVersion}
                  </span>
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
