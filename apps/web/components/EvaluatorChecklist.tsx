"use client";

import type { PolicyVersion } from "@autoevolve/core";

interface EvaluatorChecklistProps {
  version: PolicyVersion;
}

export function EvaluatorChecklist({ version }: EvaluatorChecklistProps) {
  const { checks, score, maxScore, evaluatorVersion } = version.evaluation;
  const passedCount = checks.filter((c) => c.passed).length;

  return (
    <section
      className="panel evaluatorPanel"
      aria-label="Deterministic evaluator checklist"
    >
      <div className="panelHeader">
        <div>
          <p className="sectionKicker">DETERMINISTIC EVALUATION</p>
          <h3>
            {version.id} Rubric Score: {score}/{maxScore}
          </h3>
        </div>
        <div className="evaluatorMeta">
          <span className="rubricVersionTag">{evaluatorVersion}</span>
          <span className="checkCount">
            {passedCount}/{checks.length} checks
          </span>
        </div>
      </div>

      <div className="checks">
        {checks.map((check) => (
          <div
            className={`checkRow ${check.passed ? "checkRowPass" : "checkRowFail"}`}
            key={check.id}
          >
            <span
              className={check.passed ? "checkPass" : "checkFail"}
              aria-hidden="true"
            >
              {check.passed ? "✓" : "×"}
            </span>
            <div className="checkInfo">
              <span className="checkLabel">{check.label}</span>
              {check.detail && <p className="checkDetail">{check.detail}</p>}
              {check.failureCode && !check.passed && (
                <span className="checkFailureCode">
                  Code: {check.failureCode}
                </span>
              )}
            </div>
            <span
              className={`checkPoints ${check.passed ? "ptsEarned" : "ptsZero"}`}
            >
              {check.passed ? "+10" : "0"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
