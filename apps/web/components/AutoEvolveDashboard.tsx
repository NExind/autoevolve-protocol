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
  const [attestation, setAttestation] = useState<AttestationState>({
    status: "idle",
  });

  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;

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

  async function execute(mode: RunMode) {
    setBusy(mode);
    setNotice(null);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await response.json()) as {
        run?: AgentRun;
        error?: string;
        warning?: string;
      };

      if (!response.ok || !data.run) {
        setNoticeTone("error");
        throw new Error(
          data.error ?? "The run did not produce a valid evolution trace.",
        );
      }

      setRun(data.run);
      setSelectedId("V3");
      setNoticeTone(mode === "live" ? "info" : "warn");
      setNotice(
        data.warning ??
          (mode === "live" ? "Live Gemini model run completed." : null),
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
            {run.mode === "live" ? "LIVE MODEL RUN" : "SHOWCASE REPLAY"}
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
              {busy === "live" ? "Running Gemini…" : "Run live Gemini"}
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
        <TrustBoundaryCard />
      </section>

      {/* Metric Rail */}
      <section className="metricRail" aria-label="Run summary metrics">
        <div className="metric">
          <span>SCORE TRAJECTORY</span>
          <strong>
            {run.versions[0]?.evaluation.score ?? 0} →{" "}
            {run.versions[2]?.evaluation.score ?? 0}
          </strong>
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
            <p className="sectionKicker">EXECUTION TRACE</p>
            <h2>{run.task.title}</h2>
          </div>
          <div className="runIdentity">
            <span>RUN ID:</span>
            <code>{truncate(run.runId)}</code>
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
          <SemanticDiffViewer version={selected} previous={previous} />
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

        {/* Cross-Agent Collective Memory & Agent Beta */}
        <AgentBetaMemoryView run={run} />
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
    </main>
  );
}
