"use client";

import { useState } from "react";
import type {
  DataPolicy,
  PolicyChange,
  PolicyField,
  PolicyVersion,
  VersionId,
} from "@autoevolve/core";

export type OutputViewMode = "matrix" | "single" | "diff" | "json";

function policyValue(value: boolean | number): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return value.toLocaleString("en-US");
}

const POLICY_FIELD_LABELS: Record<PolicyField, string> = {
  requireConsent: "Explicit Participant Consent",
  redactDirectIdentifiers: "Direct Identifier Redaction",
  researchPurposeOnly: "Strict Research Purpose Gate",
  auditLogging: "Tamper-Evident Audit Logging",
  blockRestrictedRegions: "Restricted Region Blocking",
  requireDualApprovalHighVolume: "Dual Approval for High Volume",
  minKAnonymity: "Minimum k-Anonymity Threshold",
  maxExportRows: "Max Export Rows per Query",
  retentionDays: "Max Data Retention (Days)",
  dailyRequestLimit: "Daily API Request Quota",
};

const POLICY_FIELD_RULES: Record<
  PolicyField,
  {
    target: string;
    isPass: (val: any) => boolean;
  }
> = {
  requireConsent: {
    target: "true",
    isPass: (v) => v === true,
  },
  redactDirectIdentifiers: {
    target: "true",
    isPass: (v) => v === true,
  },
  researchPurposeOnly: {
    target: "true",
    isPass: (v) => v === true,
  },
  auditLogging: {
    target: "true",
    isPass: (v) => v === true,
  },
  blockRestrictedRegions: {
    target: "true",
    isPass: (v) => v === true,
  },
  requireDualApprovalHighVolume: {
    target: "true",
    isPass: (v) => v === true,
  },
  minKAnonymity: {
    target: "≥ 5",
    isPass: (v) => typeof v === "number" && v >= 5,
  },
  maxExportRows: {
    target: "≤ 10,000",
    isPass: (v) => typeof v === "number" && v <= 10_000,
  },
  retentionDays: {
    target: "≤ 30 days",
    isPass: (v) => typeof v === "number" && v <= 30,
  },
  dailyRequestLimit: {
    target: "≤ 100",
    isPass: (v) => typeof v === "number" && v <= 100,
  },
};

interface SemanticDiffViewerProps {
  version?: PolicyVersion;
  previous?: PolicyVersion;
  taskTitle?: string;
  versions?: PolicyVersion[];
  selectedId?: VersionId;
  onSelectVersion?: (id: VersionId) => void;
}

export function SemanticDiffViewer({
  version,
  previous,
  taskTitle,
  versions = [],
  selectedId,
  onSelectVersion,
}: SemanticDiffViewerProps) {
  const [viewMode, setViewMode] = useState<OutputViewMode>("matrix");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [jsonVersionTab, setJsonVersionTab] = useState<VersionId | "all">(
    "all",
  );

  const v1 = versions.find((v) => v.id === "V1");
  const v2 = versions.find((v) => v.id === "V2");
  const v3 = versions.find((v) => v.id === "V3");

  const activeVersion = version ??
    versions.find((v) => v.id === selectedId) ??
    v3 ??
    v1 ?? {
      id: "V1" as VersionId,
      source: "fixture" as const,
      policy: {
        requireConsent: false,
        redactDirectIdentifiers: false,
        researchPurposeOnly: false,
        auditLogging: false,
        blockRestrictedRegions: false,
        requireDualApprovalHighVolume: false,
        minKAnonymity: 0,
        maxExportRows: 50000,
        retentionDays: 365,
        dailyRequestLimit: 5000,
      },
      evaluation: {
        evaluatorVersion: "policy-rubric-v1" as const,
        score: 0,
        maxScore: 100,
        checks: [],
        failureCodes: [],
        safePatchStrategies: [],
      },
      changesFromPrevious: [],
      createdAt: new Date().toISOString(),
    };

  const activePrevious =
    previous ??
    (activeVersion.id === "V1"
      ? undefined
      : activeVersion.id === "V2"
        ? v1
        : v2);

  const changes = activeVersion.changesFromPrevious;

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const allManifestsJson = JSON.stringify(
    {
      targetScenario:
        taskTitle ?? "Synthetic Health Data Sharing Policy Evolution",
      versions: (versions.length > 0 ? versions : [activeVersion]).map((v) => ({
        version: v.id,
        score: `${v.evaluation.score}/100`,
        source: v.source,
        policy: v.policy,
        changesCount: v.changesFromPrevious.length,
      })),
    },
    null,
    2,
  );

  const activeJsonText =
    jsonVersionTab === "all"
      ? allManifestsJson
      : JSON.stringify(
          (versions.find((v) => v.id === jsonVersionTab) ?? activeVersion)
            .policy,
          null,
          2,
        );

  return (
    <section
      className="panel evolutionPanel"
      aria-label="Semantic diff and multi-version output inspector"
    >
      {/* Header with Title and Mode Switcher */}
      <div className="panelHeader">
        <div>
          <p className="sectionKicker">
            GENERATED OUTPUT INSPECTOR
            {taskTitle ? ` • ${taskTitle.toUpperCase()}` : ""}
          </p>
          <h3>
            {viewMode === "matrix" && "3-Version Comparison Matrix"}
            {viewMode === "single" &&
              `${activeVersion.id} Generated Policy Output`}
            {viewMode === "diff" &&
              (activePrevious
                ? `${activePrevious.id} → ${activeVersion.id} Semantic Diff`
                : "V1 Baseline Policy")}
            {viewMode === "json" &&
              `Raw Generated JSON Manifest (${jsonVersionTab.toUpperCase()})`}
          </h3>
        </div>

        {/* View Mode Switcher */}
        <div
          className="viewModeSwitcher"
          role="tablist"
          aria-label="Output View Modes"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "matrix"}
            className={`viewModeBtn ${viewMode === "matrix" ? "viewModeActive" : ""}`}
            onClick={() => setViewMode("matrix")}
            title="Side-by-side comparison of all 3 versions"
          >
            📊 3-Version Matrix
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "single"}
            className={`viewModeBtn ${viewMode === "single" ? "viewModeActive" : ""}`}
            onClick={() => setViewMode("single")}
            title="Inspect full output of active version"
          >
            🔍 Single Output
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "diff"}
            className={`viewModeBtn ${viewMode === "diff" ? "viewModeActive" : ""}`}
            onClick={() => setViewMode("diff")}
            title="Inspect field-level diffs from previous revision"
          >
            ⚡ Changes Diff
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "json"}
            className={`viewModeBtn ${viewMode === "json" ? "viewModeActive" : ""}`}
            onClick={() => setViewMode("json")}
            title="Inspect raw machine-readable JSON"
          >
            📄 Raw JSON
          </button>
        </div>
      </div>

      {/* Sub-toolbar with Version Quick Selector and Copy Action */}
      <div className="outputSubToolbar">
        <div className="versionPillsGroup">
          <span className="pillsLabel">TARGET VERSION:</span>
          {(versions.length > 0 ? versions : [activeVersion]).map((v) => {
            const isSelected = activeVersion.id === v.id;
            return (
              <button
                type="button"
                key={v.id}
                className={`versionPillBtn ${isSelected ? "versionPillActive" : ""}`}
                onClick={() => {
                  onSelectVersion?.(v.id);
                  if (jsonVersionTab !== "all") {
                    setJsonVersionTab(v.id);
                  }
                }}
              >
                <span className="pillId">{v.id}</span>
                <span className="pillScore">{v.evaluation.score} pts</span>
              </button>
            );
          })}
        </div>

        <div className="toolbarActions">
          {viewMode === "json" ? (
            <div className="jsonTabGroup">
              <button
                type="button"
                className={`jsonSubTab ${jsonVersionTab === "all" ? "active" : ""}`}
                onClick={() => setJsonVersionTab("all")}
              >
                All V1–V3
              </button>
              {(["V1", "V2", "V3"] as VersionId[]).map((vid) => (
                <button
                  type="button"
                  key={vid}
                  className={`jsonSubTab ${jsonVersionTab === vid ? "active" : ""}`}
                  onClick={() => setJsonVersionTab(vid)}
                >
                  {vid}
                </button>
              ))}
              <button
                type="button"
                className="fieldToggleBtn copyPolicyBtn"
                onClick={() => copyToClipboard(activeJsonText, "json-view")}
                title="Copy displayed JSON to clipboard"
              >
                {copiedKey === "json-view" ? "✓ Copied JSON" : "📋 Copy JSON"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="fieldToggleBtn copyPolicyBtn"
              onClick={() =>
                copyToClipboard(
                  JSON.stringify(activeVersion.policy, null, 2),
                  "active-policy",
                )
              }
              title={`Copy ${activeVersion.id} DataPolicy JSON to clipboard`}
            >
              {copiedKey === "active-policy"
                ? `✓ Copied ${activeVersion.id} JSON`
                : `📋 Copy ${activeVersion.id} JSON`}
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: 3-Version Side-by-Side Matrix */}
      {viewMode === "matrix" && (
        <div className="matrixTableContainer">
          <table
            className="matrixTable"
            aria-label="3-Version Policy Evolution Matrix"
          >
            <thead>
              <tr>
                <th className="matrixHeaderControl">
                  Security & Governance Control
                </th>
                <th
                  className={`matrixHeaderCol ${activeVersion.id === "V1" ? "colActive" : ""}`}
                  onClick={() => onSelectVersion?.("V1")}
                >
                  <div className="colHeaderBox">
                    <span className="colVersionTag">V1 DRAFT</span>
                    <span className="colScoreBadge scoreRisk">
                      {v1?.evaluation.score ?? 0}/100
                    </span>
                  </div>
                </th>
                <th
                  className={`matrixHeaderCol ${activeVersion.id === "V2" ? "colActive" : ""}`}
                  onClick={() => onSelectVersion?.("V2")}
                >
                  <div className="colHeaderBox">
                    <span className="colVersionTag">V2 REVISION</span>
                    <span className="colScoreBadge scoreStrong">
                      {v2?.evaluation.score ?? 0}/100
                    </span>
                  </div>
                </th>
                <th
                  className={`matrixHeaderCol ${activeVersion.id === "V3" ? "colActive" : ""}`}
                  onClick={() => onSelectVersion?.("V3")}
                >
                  <div className="colHeaderBox">
                    <span className="colVersionTag">V3 PRODUCTION</span>
                    <span className="colScoreBadge scorePerfect">
                      {v3?.evaluation.score ?? 0}/100
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(POLICY_FIELD_LABELS) as PolicyField[]).map(
                (field) => {
                  const label = POLICY_FIELD_LABELS[field];
                  const rule = POLICY_FIELD_RULES[field];
                  const val1 = v1?.policy[field];
                  const val2 = v2?.policy[field];
                  const val3 = v3?.policy[field];

                  const pass1 = val1 !== undefined ? rule.isPass(val1) : false;
                  const pass2 = val2 !== undefined ? rule.isPass(val2) : false;
                  const pass3 = val3 !== undefined ? rule.isPass(val3) : false;

                  return (
                    <tr key={field} className="matrixRow">
                      <td className="matrixControlCell">
                        <strong>{label}</strong>
                        <span className="matrixRuleTarget">
                          Target: {rule.target}
                        </span>
                        <code className="matrixKey">{field}</code>
                      </td>
                      <td
                        className={`matrixDataCell ${pass1 ? "cellPass" : "cellFail"}`}
                      >
                        <span className="matrixIcon">{pass1 ? "✓" : "✕"}</span>
                        <span className="matrixValue">
                          {val1 !== undefined ? policyValue(val1) : "—"}
                        </span>
                      </td>
                      <td
                        className={`matrixDataCell ${pass2 ? "cellPass" : "cellFail"}`}
                      >
                        <span className="matrixIcon">{pass2 ? "✓" : "✕"}</span>
                        <span className="matrixValue">
                          {val2 !== undefined ? policyValue(val2) : "—"}
                        </span>
                      </td>
                      <td
                        className={`matrixDataCell ${pass3 ? "cellPass" : "cellFail"}`}
                      >
                        <span className="matrixIcon">{pass3 ? "✓" : "✕"}</span>
                        <span className="matrixValue">
                          {val3 !== undefined ? policyValue(val3) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
          <p className="matrixHelpNote">
            Click any column header to select that version across the dashboard.
            Notice the strictly monotonic transition from V1 (unfulfilled risks)
            to V3 (100% compliant).
          </p>
        </div>
      )}

      {/* VIEW 2: Single Version Deep Dive */}
      {viewMode === "single" && (
        <div className="singleOutputContainer">
          <div className="singleVersionSummaryBanner">
            <div className="summaryBannerLeft">
              <span className="versionBannerBadge">{activeVersion.id}</span>
              <div>
                <h4>
                  {activeVersion.id === "V1" && "Initial Draft Policy"}
                  {activeVersion.id === "V2" && "Guarded Revision Policy"}
                  {activeVersion.id === "V3" &&
                    "Production-Ready Verified Policy"}
                </h4>
                <p className="summaryBannerMeta">
                  Source: <code>{activeVersion.source}</code> · Timestamp:{" "}
                  {new Date(activeVersion.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="summaryBannerScore">
              <span className="scoreLabel">RUBRIC SCORE</span>
              <span className="scoreNumber">
                {activeVersion.evaluation.score}/100
              </span>
            </div>
          </div>

          <div className="singleFieldsGrid">
            {(Object.keys(POLICY_FIELD_LABELS) as PolicyField[]).map(
              (field) => {
                const label = POLICY_FIELD_LABELS[field];
                const rule = POLICY_FIELD_RULES[field];
                const val = activeVersion.policy[field];
                const isPass = rule.isPass(val);

                return (
                  <div
                    key={field}
                    className={`singleFieldCard ${isPass ? "fieldCardPass" : "fieldCardFail"}`}
                  >
                    <div className="fieldCardHeader">
                      <span className="fieldCardTitle">{label}</span>
                      <span
                        className={`fieldStatusBadge ${isPass ? "badgePass" : "badgeFail"}`}
                      >
                        {isPass ? "✓ COMPLIANT" : "✕ VIOLATION"}
                      </span>
                    </div>
                    <div className="fieldCardBody">
                      <code className="fieldCardValue">{policyValue(val)}</code>
                      <span className="fieldCardTarget">
                        Requirement: {rule.target}
                      </span>
                    </div>
                    <code className="fieldCardKey">{field}</code>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: Changes Diff (Before/After) */}
      {viewMode === "diff" && (
        <>
          {changes.length > 0 ? (
            <div className="diffRows">
              {changes.map((change) => (
                <div className="diffRow" key={change.field}>
                  <div className="diffMeta">
                    <p className="diffLabel">{change.label}</p>
                    <code className="diffKey">{change.field}</code>
                  </div>
                  <div className="diffValues">
                    <span className="beforeValue">
                      {policyValue(change.before)}
                    </span>
                    <span className="diffArrow">→</span>
                    <span className="afterValue">
                      {policyValue(change.after)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyDiffNotice">
              <p className="emptyCopy">
                <strong>V1 Baseline:</strong> Generated candidate with
                unfulfilled controls. Select V2 or V3 to inspect field-level
                diffs and score leaps, or toggle to the{" "}
                <strong>3-Version Matrix</strong> view above.
              </p>
            </div>
          )}
        </>
      )}

      {/* VIEW 4: Raw JSON Code Box */}
      {viewMode === "json" && (
        <div className="rawJsonViewerContainer">
          <div className="jsonViewerHeader">
            <span className="jsonHeaderLabel">
              {jsonVersionTab === "all"
                ? "Full Multi-Stage Evolution JSON Payload"
                : `${jsonVersionTab} DataPolicy JSON Object`}
            </span>
            <span className="jsonBytesCount">
              {activeJsonText.length} bytes
            </span>
          </div>
          <pre className="jsonCodeBlock">
            <code>{activeJsonText}</code>
          </pre>
        </div>
      )}

      {/* Footer with Poseidon commitment and source */}
      <div className="policyFooter">
        <div>
          <span>Policy Poseidon Commitment: </span>
          <code>
            {activeVersion.displayCommitment ?? "derived in circuit witness"}
          </code>
        </div>
        <span className="versionSourceTag">
          Active: {activeVersion.id} ({activeVersion.source})
        </span>
      </div>
    </section>
  );
}
