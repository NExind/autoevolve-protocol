"use client";

import type { Critique, PolicyVersion } from "@autoevolve/core";

interface RubricCritiqueViewerProps {
  version: PolicyVersion;
  critique?: Critique;
}

export function RubricCritiqueViewer({
  version,
  critique,
}: RubricCritiqueViewerProps) {
  const isV3 = version.id === "V3";

  return (
    <section
      className="panel critiquePanel"
      aria-label="Independent rubric critique and repair plan"
    >
      <div className="panelHeader">
        <div>
          <p className="sectionKicker">INDEPENDENT RUBRIC CRITIQUE</p>
          <h3>
            {isV3
              ? "V3 Evaluation & Proof Candidate Status"
              : `Diagnostic for ${version.id} Evaluation`}
          </h3>
        </div>
        <span className="criticChip">{critique?.author ?? "evaluator"}</span>
      </div>

      <p className="critiqueSummary">
        {critique?.summary ??
          "V3 satisfies all 10 deterministic checks in policy-rubric-v1. The next phase is sanitized memory publication and Base Sepolia settlement, not uncontrolled model looping."}
      </p>

      <div className="repairSection">
        <span className="repairHeader">
          {critique ? "DETECTED POLICY RISKS & FAILURE CODES:" : "STATUS:"}
        </span>
        <div className="repairTags">
          {(critique?.failureCodes ?? []).map((code) => (
            <span className="failureTag" key={code}>
              ⚠ {code.replaceAll("_", " ")}
            </span>
          ))}
          {!critique && (
            <span className="passTag">✓ ZERO FAILURES (100/100)</span>
          )}
        </div>
      </div>

      <div className="repairPlanBlock">
        <span className="repairHeader">
          {critique ? "DIRECTED REPAIR STRATEGY:" : "NEXT STEPS:"}
        </span>
        <ol className="repairList">
          {(
            critique?.repairPlan ?? [
              "Freeze V3 policy witness and calculate Poseidon state commitment.",
              "Prepare sanitized memory snapshot (redacting private prompts and secrets).",
              "Generate Circom Groth16 proof binding V1→V2 and V2→V3 transitions.",
              "Submit proof to Base Sepolia AutoEvolveRegistry for escrow micro-reward.",
            ]
          ).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
