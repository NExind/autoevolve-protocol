"use client";

import { useMemo, useState } from "react";
import type {
  AgentRun,
  PolicyChange,
  PolicyVersion,
  RunMode,
} from "@autoevolve/core";

type AttestationState =
  | {
      status: "idle";
    }
  | {
      status: "working";
    }
  | {
      status: "prepared" | "pinned" | "error";
      message: string;
      cid?: string;
      gatewayUrl?: string;
      snapshotHash?: string;
    };

function truncate(value: string, left = 9, right = 7): string {
  if (value.length <= left + right + 3) {
    return value;
  }
  return value.slice(0, left) + "…" + value.slice(-right);
}

function time(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
}

function policyValue(value: boolean | number): string {
  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }
  return value.toLocaleString("en-US");
}

function scoreTone(score: number): string {
  if (score >= 100) {
    return "scorePerfect";
  }
  if (score >= 70) {
    return "scoreStrong";
  }
  return "scoreRisk";
}

function ScoreBadge({ score }: { score: number }) {
  return <span className={"scoreBadge " + scoreTone(score)}>{score}/100</span>;
}

function DiffRows({ changes }: { changes: PolicyChange[] }) {
  if (!changes.length) {
    return (
      <p className="emptyCopy">Baseline policy — no predecessor to compare.</p>
    );
  }
  return (
    <div className="diffRows">
      {changes.map((change) => (
        <div className="diffRow" key={change.field}>
          <div>
            <p className="diffLabel">{change.label}</p>
            <p className="diffKey">{change.field}</p>
          </div>
          <div className="diffValues">
            <span className="beforeValue">{policyValue(change.before)}</span>
            <span className="diffArrow">→</span>
            <span className="afterValue">{policyValue(change.after)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionNode({
  version,
  active,
  onSelect,
}: {
  version: PolicyVersion;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={"versionNode " + (active ? "versionNodeActive" : "")}
      onClick={onSelect}
      type="button"
    >
      <div className="nodeHeading">
        <span className="versionLabel">{version.id}</span>
        <span className="nodeTime">{time(version.createdAt)}</span>
      </div>
      <ScoreBadge score={version.evaluation.score} />
      <div className="scoreTrack" aria-hidden="true">
        <div
          className={"scoreFill " + scoreTone(version.evaluation.score)}
          style={{ width: version.evaluation.score + "%" }}
        />
      </div>
      <p className="nodeSource">{version.source.replace("-", " ")}</p>
    </button>
  );
}

export function AutoEvolveDashboard({ initialRun }: { initialRun: AgentRun }) {
  const [run, setRun] = useState<AgentRun>(initialRun);
  const [selectedId, setSelectedId] = useState<"V1" | "V2" | "V3">("V3");
  const [busy, setBusy] = useState<RunMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attestation, setAttestation] = useState<AttestationState>({
    status: "idle",
  });

  const selected =
    run.versions.find((version) => version.id === selectedId) ??
    run.versions[2];
  const previous = run.versions.find((version) =>
    selected.id === "V1"
      ? false
      : version.id === (selected.id === "V2" ? "V1" : "V2"),
  );
  const selectedCritique = run.critiques.find(
    (critique) =>
      critique.fromVersion === (selected.id === "V3" ? "V2" : selected.id),
  );
  const knownFailures = useMemo(
    () => [
      ...new Set(run.critiques.flatMap((critique) => critique.failureCodes)),
    ],
    [run],
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
        throw new Error(
          data.error ?? "The run did not produce a valid evolution trace.",
        );
      }
      setRun(data.run);
      setSelectedId("V3");
      setNotice(
        data.warning ?? (mode === "live" ? "Live Gemini run completed." : null),
      );
      setAttestation({ status: "idle" });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to run the agent.",
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
        status?: "prepared" | "pinned";
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
        message: data.nextStep ?? data.message ?? "Snapshot prepared.",
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
    run.versions[1].evaluation.score - run.versions[0].evaluation.score;
  const stageThreeDelta =
    run.versions[2].evaluation.score - run.versions[1].evaluation.score;
  const proofStatus =
    attestation.status === "pinned"
      ? "CID pinned · proof pending"
      : attestation.status === "prepared"
        ? "Snapshot prepared locally"
        : "Not attested";
  const attestationResult =
    attestation.status === "prepared" ||
    attestation.status === "pinned" ||
    attestation.status === "error"
      ? attestation
      : null;

  return (
    <main className="shell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <div className="brand">
          <span className="brandMark">AE</span>
          <span>AUTOEVOLVE</span>
          <span className="brandSlash">/</span>
          <span className="brandSub">PROTOCOL</span>
        </div>
        <div className="topbarRight">
          <span className="networkDot" />
          <span className="networkLabel">
            BASE SEPOLIA · READY TO CONFIGURE
          </span>
          <span
            className={"modeChip " + (run.mode === "live" ? "modeLive" : "")}
          >
            {run.mode === "live" ? "LIVE MODEL RUN" : "SHOWCASE REPLAY"}
          </span>
        </div>
      </header>

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
            output—while keeping every meaningful claim inspectable,
            reproducible, and ready for ZK attestation.
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
          {notice ? <p className="notice">{notice}</p> : null}
        </div>

        <aside className="proofBoundary">
          <div className="boundaryTop">
            <span className="boundaryGlyph">∎</span>
            <span>TRUST BOUNDARY</span>
          </div>
          <p>
            We prove a strict score increase under a committed, deterministic
            rubric—not an LLM’s private reasoning or generalized intelligence.
          </p>
          <div className="boundaryLine">
            <span>10 deterministic checks</span>
            <span>100 point ceiling</span>
          </div>
        </aside>
      </section>

      <section className="metricRail" aria-label="Run summary">
        <div className="metric">
          <span>EVOLUTION</span>
          <strong>
            {run.versions[0].evaluation.score} →{" "}
            {run.versions[2].evaluation.score}
          </strong>
          <small>strict score trajectory</small>
        </div>
        <div className="metric">
          <span>V1 → V2</span>
          <strong>+{stageTwoDelta}</strong>
          <small>guarded improvement</small>
        </div>
        <div className="metric">
          <span>V2 → V3</span>
          <strong>+{stageThreeDelta}</strong>
          <small>remaining controls resolved</small>
        </div>
        <div className="metric metricStatus">
          <span>ATTESTATION</span>
          <strong>{proofStatus}</strong>
          <small>honest status, never optimistic</small>
        </div>
      </section>

      <section className="dashboardFrame">
        <div className="dashboardHeader">
          <div>
            <p className="sectionKicker">EXECUTION TRACE</p>
            <h2>{run.task.title}</h2>
          </div>
          <div className="runIdentity">
            <span>RUN ID</span>
            <code>{truncate(run.runId)}</code>
          </div>
        </div>

        <div className="executionTree" aria-label="Agent version evolution">
          {run.versions.map((version, index) => (
            <div className="treeBranch" key={version.id}>
              <VersionNode
                active={selected.id === version.id}
                onSelect={() => setSelectedId(version.id)}
                version={version}
              />
              {index < run.versions.length - 1 ? (
                <div className="treeConnector">
                  <span>CRITIQUE</span>
                  <i />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="workspaceGrid">
          <section className="panel evolutionPanel">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">SEMANTIC DIFF</p>
                <h3>
                  {previous ? previous.id + " → " + selected.id : "V1 baseline"}
                </h3>
              </div>
              <ScoreBadge score={selected.evaluation.score} />
            </div>
            <DiffRows changes={selected.changesFromPrevious} />
            <div className="policyFooter">
              <span>Policy commitment</span>
              <code>
                {selected.displayCommitment ?? "derived at attestation"}
              </code>
            </div>
          </section>

          <aside className="panel ledgerPanel">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">VERIFIABILITY LEDGER</p>
                <h3>Evidence status</h3>
              </div>
              <span
                className={
                  "statusPill " +
                  (attestation.status === "pinned" ? "statusGood" : "")
                }
              >
                {attestation.status === "pinned" ? "CID PINNED" : "PENDING"}
              </span>
            </div>
            <div className="ledgerRows">
              <div className="ledgerRow">
                <span className="ledgerIcon done">✓</span>
                <div>
                  <strong>Deterministic evaluator</strong>
                  <small>Scores derived from ten fixed rubric checks</small>
                </div>
                <span className="ledgerState">READY</span>
              </div>
              <div className="ledgerRow">
                <span className="ledgerIcon done">✓</span>
                <div>
                  <strong>Circom proof circuit</strong>
                  <small>
                    Source binds scores, policy commitments, CID, agent
                  </small>
                </div>
                <span className="ledgerState">SOURCE READY</span>
              </div>
              <div className="ledgerRow">
                <span
                  className={
                    "ledgerIcon " +
                    (attestation.status === "pinned" ? "done" : "")
                  }
                >
                  {attestation.status === "pinned" ? "✓" : "○"}
                </span>
                <div>
                  <strong>IPFS memory snapshot</strong>
                  <small>
                    {attestationResult?.cid
                      ? truncate(attestationResult.cid, 10, 8)
                      : "Sanitized snapshot awaits pinning"}
                  </small>
                </div>
                <span className="ledgerState">
                  {attestation.status === "pinned" ? "PINNED" : "PENDING"}
                </span>
              </div>
              <div className="ledgerRow">
                <span className="ledgerIcon">○</span>
                <div>
                  <strong>Base Sepolia settlement</strong>
                  <small>
                    Generated verifier + registry must confirm proof
                  </small>
                </div>
                <span className="ledgerState">UNSETTLED</span>
              </div>
            </div>
            <button
              className="button buttonLedger"
              disabled={attestation.status === "working"}
              onClick={prepareAttestation}
              type="button"
            >
              {attestation.status === "working"
                ? "Preparing…"
                : "Prepare immutable memory"}
            </button>
            {attestationResult ? (
              <div
                className={
                  "attestationMessage " +
                  (attestationResult.status === "error" ? "messageError" : "")
                }
              >
                <p>{attestationResult.message}</p>
                {attestationResult.gatewayUrl ? (
                  <a
                    href={attestationResult.gatewayUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open CID ↗
                  </a>
                ) : null}
                {attestationResult.snapshotHash ? (
                  <code>
                    {truncate(attestationResult.snapshotHash, 12, 10)}
                  </code>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>

        <div className="lowerGrid">
          <section className="panel critiquePanel">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">INDEPENDENT RUBRIC CRITIQUE</p>
                <h3>
                  {selectedCritique
                    ? "Why this version changed"
                    : "Final state"}
                </h3>
              </div>
              <span className="criticChip">
                {selectedCritique?.author ?? "deterministic evaluator"}
              </span>
            </div>
            <p className="critiqueSummary">
              {selectedCritique?.summary ??
                "V3 clears the fixed safety rubric. The next action is evidence publication, not another uncontrolled model loop."}
            </p>
            <div className="repairTags">
              {(selectedCritique?.failureCodes ?? []).map((code) => (
                <span className="failureTag" key={code}>
                  {code.replaceAll("_", " ")}
                </span>
              ))}
              {!selectedCritique ? (
                <span className="passTag">ALL CHECKS PASS</span>
              ) : null}
            </div>
            <ol className="repairList">
              {(
                selectedCritique?.repairPlan ?? [
                  "Freeze this policy version as the verified improvement candidate.",
                  "Generate proof and settle the CID-bound transition on Base Sepolia.",
                ]
              ).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="panel evaluatorPanel">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">EVALUATOR EVIDENCE</p>
                <h3>{selected.id} rubric results</h3>
              </div>
              <span className="checkCount">
                {
                  selected.evaluation.checks.filter((check) => check.passed)
                    .length
                }
                /10
              </span>
            </div>
            <div className="checks">
              {selected.evaluation.checks.map((check) => (
                <div className="checkRow" key={check.id}>
                  <span className={check.passed ? "checkPass" : "checkFail"}>
                    {check.passed ? "✓" : "×"}
                  </span>
                  <span>{check.label}</span>
                  <span className="checkPoints">+{check.passed ? 10 : 0}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel memoryPanel">
          <div className="memoryIntro">
            <p className="sectionKicker">CROSS-AGENT COLLECTIVE MEMORY</p>
            <h3>Agent Beta inherits verified lessons—not raw prompts.</h3>
            <p>
              The data path is registry → CID → schema validation → allowlisted
              failure card. Until a CID is settled, these remain local
              candidates.
            </p>
          </div>
          <div className="memoryCards">
            {knownFailures.slice(0, 4).map((failureCode, index) => (
              <div className="memoryCard" key={failureCode}>
                <span className="memoryIndex">0{index + 1}</span>
                <strong>{failureCode.replaceAll("_", " ")}</strong>
                <p>
                  Safe patch strategy becomes reusable only after CID-bound
                  proof settlement.
                </p>
              </div>
            ))}
          </div>
          <div className="memoryFlow">
            <span>Agent Alpha</span>
            <i>→</i>
            <span>Sanitized Snapshot</span>
            <i>→</i>
            <span>IPFS CID</span>
            <i>→</i>
            <span>Registry</span>
            <i>→</i>
            <span className="betaToken">Agent Beta</span>
          </div>
        </section>
      </section>

      <footer className="footer">
        <span>AutoEvolve / policy-rubric-v1</span>
        <span>
          Data is synthetic. Secrets and private prompts are excluded from
          public memory.
        </span>
      </footer>
    </main>
  );
}
