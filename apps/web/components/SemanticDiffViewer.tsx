"use client";

import { useState } from "react";
import type {
  DataPolicy,
  PolicyChange,
  PolicyField,
  PolicyVersion,
} from "@autoevolve/core";

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

interface SemanticDiffViewerProps {
  version: PolicyVersion;
  previous?: PolicyVersion;
}

export function SemanticDiffViewer({
  version,
  previous,
}: SemanticDiffViewerProps) {
  const [showAllFields, setShowAllFields] = useState(false);
  const changes = version.changesFromPrevious;

  return (
    <section
      className="panel evolutionPanel"
      aria-label="Semantic diff and policy inspector"
    >
      <div className="panelHeader">
        <div>
          <p className="sectionKicker">SEMANTIC POLICY DIFF</p>
          <h3>
            {previous ? `${previous.id} → ${version.id}` : "V1 Baseline Policy"}
          </h3>
        </div>
        <button
          type="button"
          className="fieldToggleBtn"
          onClick={() => setShowAllFields(!showAllFields)}
        >
          {showAllFields ? "Show Changes Only" : "Inspect All 10 Fields"}
        </button>
      </div>

      {!showAllFields ? (
        changes.length > 0 ? (
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
              <strong>V1 Baseline:</strong> Generated candidate with 6
              unfulfilled controls. Select V2 or V3 to inspect field-level diffs
              and score leaps.
            </p>
          </div>
        )
      ) : (
        <div className="policyInspectorTable">
          <table className="policyTable">
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Type</th>
                <th>Current Value ({version.id})</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(POLICY_FIELD_LABELS) as PolicyField[]).map(
                (field) => {
                  const val = version.policy[field];
                  const changed = changes.some((c) => c.field === field);

                  return (
                    <tr key={field} className={changed ? "rowChanged" : ""}>
                      <td>
                        <strong>{POLICY_FIELD_LABELS[field]}</strong>
                        <br />
                        <code>{field}</code>
                      </td>
                      <td>
                        <span className="typeBadge">{typeof val}</span>
                      </td>
                      <td>
                        <span
                          className={`policyValBadge ${typeof val === "boolean" ? (val ? "valTrue" : "valFalse") : "valNum"}`}
                        >
                          {policyValue(val)}
                        </span>
                        {changed && <span className="changedTag">UPDATED</span>}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="policyFooter">
        <div>
          <span>Policy Poseidon Commitment: </span>
          <code>
            {version.displayCommitment ?? "derived in circuit witness"}
          </code>
        </div>
        <span className="versionSourceTag">Source: {version.source}</span>
      </div>
    </section>
  );
}
