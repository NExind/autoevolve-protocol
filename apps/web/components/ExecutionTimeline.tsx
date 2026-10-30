"use client";

import { useState } from "react";
import type {
  AgentEvent,
  AgentRun,
  PolicyVersion,
  VersionId,
} from "@autoevolve/core";

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

function scoreTone(score: number): string {
  if (score >= 100) return "scorePerfect";
  if (score >= 70) return "scoreStrong";
  return "scoreRisk";
}

interface ExecutionTimelineProps {
  run: AgentRun;
  selectedId: VersionId;
  onSelectVersion: (id: VersionId) => void;
}

export function ExecutionTimeline({
  run,
  selectedId,
  onSelectVersion,
}: ExecutionTimelineProps) {
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [eventFilter, setEventFilter] = useState<"all" | VersionId>("all");

  const stageTwoDelta =
    run.versions[1] && run.versions[0]
      ? run.versions[1].evaluation.score - run.versions[0].evaluation.score
      : 0;
  const stageThreeDelta =
    run.versions[2] && run.versions[1]
      ? run.versions[2].evaluation.score - run.versions[1].evaluation.score
      : 0;

  const filteredEvents = run.events.filter((ev) =>
    eventFilter === "all" ? true : ev.version === eventFilter,
  );

  return (
    <div className="executionTimelineSection">
      <div className="timelineToolbar">
        <span className="sectionKicker">POLICY EVOLUTION GRAPH</span>
        <button
          type="button"
          className="eventDrawerBtn"
          onClick={() => setShowEventDrawer(!showEventDrawer)}
          aria-expanded={showEventDrawer}
        >
          {showEventDrawer
            ? "Hide Guardrail Events ▲"
            : `View Guardrail & Agent Events (${run.events.length}) ▼`}
        </button>
      </div>

      <div className="executionTree" aria-label="Agent version evolution tree">
        {run.versions.map((version, index) => {
          const isActive = selectedId === version.id;
          const score = version.evaluation.score;
          const tone = scoreTone(score);

          return (
            <div className="treeBranch" key={version.id}>
              <button
                type="button"
                className={`versionNode ${isActive ? "versionNodeActive" : ""}`}
                onClick={() => onSelectVersion(version.id)}
                aria-pressed={isActive}
              >
                <div className="nodeHeading">
                  <span className="versionLabel">{version.id}</span>
                  <span className="nodeTime">{time(version.createdAt)}</span>
                </div>

                <div className="scoreRow">
                  <span className={`scoreBadge ${tone}`}>{score}/100</span>
                  <span className="failedChecksCount">
                    {version.evaluation.failureCodes.length > 0
                      ? `${version.evaluation.failureCodes.length} checks failed`
                      : "0 failures (clean)"}
                  </span>
                </div>

                <div className="scoreTrack" aria-hidden="true">
                  <div
                    className={`scoreFill ${tone}`}
                    style={{ width: `${Math.max(5, score)}%` }}
                  />
                </div>

                <div className="nodeMeta">
                  <span className="nodeSource">
                    {version.source.replaceAll("-", " ")}
                  </span>
                  {version.displayCommitment ? (
                    <code className="nodeCommitment">
                      {version.displayCommitment}
                    </code>
                  ) : null}
                </div>
              </button>

              {index === 0 && (
                <div
                  className="treeConnector"
                  title="Stage 2: Critique & Guarded Revision"
                >
                  <span className="connectorStage">STAGE 2</span>
                  <span className="connectorDelta">+{stageTwoDelta} pts</span>
                  <i />
                </div>
              )}

              {index === 1 && (
                <div
                  className="treeConnector"
                  title="Stage 3: Critique & Final Remediation"
                >
                  <span className="connectorStage">STAGE 3</span>
                  <span className="connectorDelta">+{stageThreeDelta} pts</span>
                  <i />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showEventDrawer && (
        <div className="eventsPanel">
          <div className="eventsHeader">
            <span className="eventsTitle">
              Guarded Execution & Monotonicity Event Log
            </span>
            <div className="eventsFilters">
              <button
                type="button"
                className={`filterChip ${eventFilter === "all" ? "active" : ""}`}
                onClick={() => setEventFilter("all")}
              >
                All ({run.events.length})
              </button>
              <button
                type="button"
                className={`filterChip ${eventFilter === "V1" ? "active" : ""}`}
                onClick={() => setEventFilter("V1")}
              >
                V1
              </button>
              <button
                type="button"
                className={`filterChip ${eventFilter === "V2" ? "active" : ""}`}
                onClick={() => setEventFilter("V2")}
              >
                V2
              </button>
              <button
                type="button"
                className={`filterChip ${eventFilter === "V3" ? "active" : ""}`}
                onClick={() => setEventFilter("V3")}
              >
                V3
              </button>
            </div>
          </div>

          <div className="eventsList">
            {filteredEvents.map((event, idx) => (
              <div className="eventItem" key={`${event.at}-${idx}`}>
                <span className="eventTime">{time(event.at)}</span>
                <span className={`eventStage stage-${event.stage}`}>
                  {event.stage.toUpperCase()}
                </span>
                <span className="eventVersion">{event.version}</span>
                <span className="eventMessage">{event.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
