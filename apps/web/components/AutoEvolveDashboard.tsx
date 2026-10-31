"use client";

import { useMemo, useState } from "react";
import type { AgentRun, RunMode, VersionId } from "@autoevolve/core";
import { TrustBoundaryCard } from "./TrustBoundaryCard";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { SemanticDiffViewer } from "./SemanticDiffViewer";
import { RubricCritiqueViewer } from "./RubricCritiqueViewer";
import { EvaluatorChecklist } from "./EvaluatorChecklist";
import {
  VerifiabilityLedger,
  type AttestationState,
} from "./VerifiabilityLedger";
import { AgentBetaMemoryView } from "./AgentBetaMemoryView";
import { HistoricalShowcaseEvidence } from "./HistoricalShowcaseEvidence";
import { JudgeDemoGuide } from "./JudgeDemoGuide";
import { PublicSignalsModal } from "./PublicSignalsModal";
import { ProviderBadge, type LLMProvider } from "./ProviderBadge";
import { CustomPromptPanel } from "./CustomPromptPanel";

function truncate(value: string, left = 9, right = 7): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export function AutoEvolveDashboard({ initialRun }: { initialRun: AgentRun }) {
  const [run, setRun] = useState<AgentRun>(initialRun);
  const [selectedId, setSelectedId] = useState<VersionId>("V3");
  const [busy, setBusy] = useState<RunMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"info" | "warn" | "error">(
    "info",
  );
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const [provider, setProvider] = useState<LLMProvider>("showcase");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [executionLatencyMs, setExecutionLatencyMs] = useState<number | null>(
    null,
  );
  const [showAbiModal, setShowAbiModal] = useState(false);
  const [attestation, setAttestation] = useState<AttestationState>({
    status: "idle",
  });

  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const explorerBaseUrl = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL;
  const pinataGateway = process.env.PINATA_GATEWAY;

  const selected =
    run.versions.find((v) => v.id === selectedId) ??
    run.versions[2] ??
    run.versions[0];
  const previous = run.versions.find((v) =>
    selected.id === "V1"
      ? false
      : v.id === (selected.id === "V2" ? "V1" : "V2"),
  );
  const selectedCritique = run.critiques.find(
    (c) => c.fromVersion === (selected.id === "V3" ? "V2" : selected.id),
  );

  const handleScrollToHistorical = () => {
    document
      .getElementById("historical-evidence")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScrollToMemory = () => {
    document
      .getElementById("collective-memory")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  async function execute(mode: RunMode) {
    setBusy(mode);
    setNotice(null);
    const startTime = performance.now();
    try {
      const payload: { mode: RunMode; userPrompt?: string } = { mode };
      if (mode === "live" && customPrompt.trim()) {
        payload.userPrompt = customPrompt.trim();
      }

      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        run?: AgentRun;
        error?: string;
        warning?: string;
        memoryNotice?: string;
        provider?: LLMProvider;
      };

      if (!response.ok || !data.run) {
        setNoticeTone("error");
        throw new Error(
          data.error ?? "The run did not produce a valid evolution trace.",
        );
      }

      setRun(data.run);
      setSelectedId("V3");
      const elapsed = Math.round(performance.now() - startTime);
      setExecutionLatencyMs(elapsed);
      setNoticeTone(mode === "live" ? "info" : "warn");
      setNotice(
        data.warning ??
          (mode === "live"
            ? `Live evolution completed specifically for: "${data.run.task.title}" (${(elapsed / 1000).toFixed(1)}s).`
            : null),
      );
      if (data.memoryNotice) {
        setMemoryNotice(data.memoryNotice);
      } else if (mode === "showcase") {
        setMemoryNotice(null);
      }
      setProvider(
        mode === "showcase" ? "showcase" : (data.provider ?? "gemini"),
      );
      setAttestation({ status: "idle" });
    } catch (error) {
      setNoticeTone("error");
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to execute the agent run.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function prepareAttestation() {
    setAttestation({ status: "working" });
    try {
      const response = await fetch("/api/attest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run }),
      });
      const data = (await response.json()) as {
        status?:
          | "prepared"
          | "pinned"
          | "locally verified"
          | "on-chain settled";
        message?: string;
        cid?: string;
        gatewayUrl?: string;
        snapshotHash?: string;
        nextStep?: string;
        error?: string;
      };

      if (!response.ok || !data.status) {
        throw new Error(data.error ?? "Could not prepare the attestation.");
      }

      setAttestation({
        status: data.status,
        message: data.nextStep ?? data.message ?? "Snapshot prepared locally.",
        cid: data.cid,
        gatewayUrl: data.gatewayUrl,
        snapshotHash: data.snapshotHash,
      });
    } catch (error) {
      setAttestation({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Attestation preparation failed.",
      });
    }
  }

  const stageTwoDelta =
    run.versions[1] && run.versions[0]
      ? run.versions[1].evaluation.score - run.versions[0].evaluation.score
      : 0;
  const stageThreeDelta =
    run.versions[2] && run.versions[1]
      ? run.versions[2].evaluation.score - run.versions[1].evaluation.score
      : 0;

  let overallEvidenceState = "UNCONFIGURED";
  if (attestation.status === "on-chain settled") {
    overallEvidenceState = "ON-CHAIN SETTLED";
  } else if (attestation.status === "locally verified") {
    overallEvidenceState = "LOCALLY VERIFIED";
  } else if (attestation.status === "pinned") {
    overallEvidenceState = "IPFS PINNED";
  } else if (attestation.status === "prepared") {
    overallEvidenceState = "LOCAL PREPARED";
  }

  return (
    <main className="shell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      {/* Top Header & Honest Environment Badges */}
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">AE</span>
          <span>AUTOEVOLVE</span>
          <span className="brandSlash">/</span>
          <span className="brandSub">PROTOCOL</span>
        </div>

        <div className="topbarRight">
          <JudgeDemoGuide
            onRunShowcase={() => execute("showcase")}
            onOpenAbi={() => setShowAbiModal(true)}
            onScrollToHistorical={handleScrollToHistorical}
            onScrollToMemory={handleScrollToMemory}
          />

          <div className="networkBadge">
            <span
              className={`networkDot ${registryAddress ? "dotConfigured" : "dotUnconfigured"}`}
              aria-hidden="true"
            />
            <span className="networkLabel">
              {registryAddress
                ? "BASE SEPOLIA · REGISTRY CONFIGURED"
                : "BASE SEPOLIA (84532) · UNCONFIGURED"}
            </span>
          </div>

          <span
            className={`modeChip ${run.mode === "live" ? "modeLive" : "modeShowcase"}`}
          >
            {run.mode === "live"
              ? "LIVE AGENT BETA RUN (UNSETTLED)"
              : "SHOWCASE REPLAY"}
          </span>
        </div>
      </header>

      {/* Visibly honest notice banner for showcase mode */}
      {run.mode === "showcase" && (
        <div className="replayBanner" role="status">
          <span className="replayBadge">SHOWCASE REPLAY</span>
          <span>
            Deterministic offline replay. Scores (40 → 70 → 100) are computed
            locally by <code>policy-rubric-v1</code>. No live API keys, mock
            proofs, or fake Base Sepolia transactions are claimed.
          </span>
        </div>
      )}

      {/* Visibly honest notice banner for live model mode */}
      {run.mode === "live" && (
        <div className="liveRunBanner" role="status">
          <span className="liveRunBadge">LIVE AGENT BETA RUN</span>
          <span>
            Real Gemini model execution inheriting verified lessons from the
            on-chain CID. <strong>Evidence Boundary:</strong> This live run is
            not separately ZK-proved, pinned, or settled on Base Sepolia.
          </span>
        </div>
      )}

      {/* Visibly display memoryNotice if Agent Beta retrieved on-chain lessons */}
      {memoryNotice && (
        <div className="memoryNoticeBanner" role="status">
          <span className="memoryNoticeBadge">
            ✓ AGENT BETA INHERITED MEMORY EVENT
          </span>
          <span>{memoryNotice}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">
            VERIFIABLE SELF-IMPROVEMENT · DATA DAO MEMORY
          </p>
          <h1>
            Agents that evolve
            <span> with evidence.</span>
          </h1>
          <p className="heroBody">
            A bounded policy agent generates, critiques, and repairs its own
            synthetic health data sharing policy. Monotonic score improvements
            are bound into a Groth16 circuit for Base Sepolia settlement, while
            sanitized lessons are indexed on IPFS for safe cross-agent
            inheritance.
          </p>

          <CustomPromptPanel
            value={customPrompt}
            onChange={setCustomPrompt}
            disabled={busy !== null}
          />

          <div className="heroActions">
            <button
              className="button buttonPrimary"
              disabled={busy !== null}
              onClick={() => execute("showcase")}
              type="button"
            >
              {busy === "showcase" ? "Replaying…" : "Run showcase replay"}
            </button>
            <button
              className="button buttonSecondary"
              disabled={busy !== null}
              onClick={() => execute("live")}
              type="button"
            >
              {busy === "live" ? "Running live model…" : "Run live evolution"}
            </button>
          </div>

          {notice && (
            <div className={`notice notice-${noticeTone}`} role="alert">
              <strong>
                {noticeTone === "error" ? "Execution Error: " : "Notice: "}
              </strong>
              {notice}
            </div>
          )}
        </div>

        {/* Cryptographic Trust Boundary Card */}
        <TrustBoundaryCard onOpenAbi={() => setShowAbiModal(true)} />
      </section>

      {/* Metric Rail */}
      <section className="metricRail" aria-label="Run summary metrics">
        <div className="metric">
          <span>SCORE TRAJECTORY</span>
          <strong>
            {run.versions[0]?.evaluation.score ?? 0} →{" "}
            {run.versions[2]?.evaluation.score ?? 0}
          </strong>
          <div className="scoreTrajectoryTrack" aria-hidden="true">
            <div
              className="scoreTrajectoryBar"
              style={{
                width: `${run.versions[2]?.evaluation.score ?? 0}%`,
              }}
            />
          </div>
          <small>Strictly monotonic improvement</small>
        </div>
        <div className="metric">
          <span>V1 → V2 DELTA</span>
          <strong>+{stageTwoDelta} pts</strong>
          <small>Guarded revision (redact ID, regions, k-anon)</small>
        </div>
        <div className="metric">
          <span>V2 → V3 DELTA</span>
          <strong>+{stageThreeDelta} pts</strong>
          <small>Final remediation (dual approval, rows, retention)</small>
        </div>
        {executionLatencyMs !== null && (
          <div className="metric">
            <span>EXECUTION TIME</span>
            <strong>{(executionLatencyMs / 1000).toFixed(1)}s</strong>
            <small>Live multi-stage loop latency</small>
          </div>
        )}
        <div className="metric metricStatus">
          <span>EVIDENCE LIFECYCLE</span>
          <strong>{overallEvidenceState}</strong>
          <small>Truthful status—never optimistic</small>
        </div>
      </section>

      {/* Main Dashboard Frame */}
      <section className="dashboardFrame">
        <div className="dashboardHeader">
          <div>
            <p className="sectionKicker">
              {run.userPrompt ? "CUSTOM SCENARIO TRACE" : "EXECUTION TRACE"}
            </p>
            <h2>{run.task.title}</h2>
            <p className="taskSummaryLead">{run.task.publicSummary}</p>
            {run.userPrompt && (
              <div className="activePromptChip" title={run.userPrompt}>
                <span className="promptChipKicker">TARGET OBJECTIVE:</span>
                <code className="promptChipText">"{run.userPrompt}"</code>
              </div>
            )}
          </div>
          <div className="runIdentity">
            <span>RUN ID:</span>
            <code>{truncate(run.runId)}</code>
            <ProviderBadge provider={provider} />
          </div>
        </div>

        {/* Interactive Execution Graph & Guardrail Event Stream */}
        <ExecutionTimeline
          run={run}
          selectedId={selectedId}
          onSelectVersion={setSelectedId}
        />

        {/* Workspace: Semantic Diff & Verifiability Ledger */}
        <div className="workspaceGrid">
          <SemanticDiffViewer
            version={selected}
            previous={previous}
            taskTitle={run.task.title}
          />
          <VerifiabilityLedger
            run={run}
            attestation={attestation}
            onPrepareAttestation={prepareAttestation}
            registryAddress={registryAddress}
          />
        </div>

        {/* Lower Grid: Independent Critique & Evaluator Checklist */}
        <div className="lowerGrid">
          <RubricCritiqueViewer
            version={selected}
            critique={selectedCritique}
          />
          <EvaluatorChecklist version={selected} />
        </div>

        {/* Historical Attested Showcase Evidence Panel */}
        <HistoricalShowcaseEvidence
          explorerBaseUrl={explorerBaseUrl}
          pinataGateway={pinataGateway}
        />

        {/* Cross-Agent Collective Memory & Agent Beta */}
        <AgentBetaMemoryView run={run} memoryNotice={memoryNotice} />
      </section>

      {/* Truthful Disclosures Footer */}
      <footer className="footer">
        <div>
          <strong>AutoEvolve Protocol</strong> · Evaluator{" "}
          <code>policy-rubric-v1</code> · Base Sepolia (84532)
        </div>
        <div>
          Data is synthetic. Zero raw prompts, private keys, or LLM reasoning
          are stored or claimed as proven.
        </div>
      </footer>

      {showAbiModal && (
        <PublicSignalsModal onClose={() => setShowAbiModal(false)} />
      )}
    </main>
  );
}
