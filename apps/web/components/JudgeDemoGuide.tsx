"use client";

import { useState } from "react";

interface JudgeDemoGuideProps {
  onRunShowcase: () => void;
  onOpenAbi: () => void;
}

interface DemoStep {
  time: string;
  title: string;
  subtitle: string;
  script: string;
  actionLabel?: string;
  action?: () => void;
}

export function JudgeDemoGuide({
  onRunShowcase,
  onOpenAbi,
}: JudgeDemoGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const steps: DemoStep[] = [
    {
      time: "0:00–0:30",
      title: "Problem Statement & Truth Boundary",
      subtitle: "Why we never trust an agent's self-reported score",
      script:
        "Autonomous agents typically grade themselves. AutoEvolve turns self-improvement into cryptographic evidence. We prove deterministic score increases (40 → 70 → 100) under policy-rubric-v1—never subjective model intelligence or hidden thoughts.",
      actionLabel: "View 13-Signal ABI",
      action: onOpenAbi,
    },
    {
      time: "0:30–1:45",
      title: "Agent Alpha Repairs Policy (V1 → V2 → V3)",
      subtitle: "Deterministic evaluation, critiques, and guarded revision",
      script:
        "Run the showcase replay. Select V1 (40/100, 6 failed checks). Select V2 (+30 pts, 70/100) and show field diffs (redacting IDs, region blocks, k-anonymity=5). Select V3 (+30 pts, 100/100) with all 10 controls satisfied.",
      actionLabel: "Run Showcase Replay",
      action: onRunShowcase,
    },
    {
      time: "1:45–3:00",
      title: "Zero-Knowledge Proof Boundary",
      subtitle: "Circom 2 / snarkjs Groth16 over private policy commitments",
      script:
        "Explain the private vs public split: private policy witnesses derive Poseidon commitments and rubric scores in-circuit. The public signal ABI enforces score monotonicity (nextScore > previousScore) without exposing private data.",
      actionLabel: "Inspect Public Signals",
      action: onOpenAbi,
    },
    {
      time: "3:00–4:00",
      title: "Decentralized Memory & Base Sepolia Escrow",
      subtitle: "Sanitized snapshots on IPFS, attested on-chain",
      script:
        "Click 'Prepare Sanitized Memory Snapshot'. Show that private prompts and keys are stripped, leaving only canonical SnapshotCore. Once pinned, a real CID is returned. The Base Sepolia registry verifies proof and awards escrow micro-rewards.",
    },
    {
      time: "4:00–4:40",
      title: "Agent Beta Safe Inheritance",
      subtitle: "Cross-agent learning without prompt injection",
      script:
        "Agent Beta only queries registry pointers and receives schema-validated, allowlisted failure cards with safe patch strategies. Raw model thoughts or unvetted IPFS text are NEVER injected into prompts.",
    },
    {
      time: "4:40–5:00",
      title: "Winning Close & Honesty Boundary",
      subtitle: "Zero fabricated green states",
      script:
        "AutoEvolve proves what is mathematically testable: strict policy improvement under an objective rubric. We never simulate green checkmarks, fake CIDs, or mock transaction hashes.",
    },
  ];

  const currentStep = steps[activeStep];

  return (
    <>
      <button
        type="button"
        className="guideToggleBtn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle 5-minute judge demo guide"
      >
        <span className="guideBolt">⚡</span>
        <span>5-Min Judge Demo Guide</span>
      </button>

      {isOpen && (
        <div
          className="guideOverlay"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="guideDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="guideHeader">
              <div>
                <span className="sectionKicker">
                  HACKATHON PRESENTATION PLAYBOOK
                </span>
                <h3>5-Minute Judge Demo Script</h3>
              </div>
              <button
                type="button"
                className="guideCloseBtn"
                onClick={() => setIsOpen(false)}
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>

            <p className="guideIntro">
              Follow this step-by-step narrative to demonstrate AutoEvolve in
              under 5 minutes. Every claim is backed by <code>EVIDENCE.md</code>
              .
            </p>

            <div className="guideStepNav">
              {steps.map((s, idx) => (
                <button
                  type="button"
                  key={s.time}
                  className={`guideStepTab ${activeStep === idx ? "active" : ""}`}
                  onClick={() => setActiveStep(idx)}
                >
                  <span className="stepTime">{s.time}</span>
                  <span className="stepTitle">{s.title.split("&")[0]}</span>
                </button>
              ))}
            </div>

            <div className="guideStepContent">
              <div className="stepMeta">
                <span className="stepBadge">{currentStep.time}</span>
                <h4>{currentStep.title}</h4>
              </div>
              <p className="stepSubtitle">{currentStep.subtitle}</p>

              <div className="stepScriptBox">
                <span className="scriptLabel">
                  Presenter Script & Walkthrough:
                </span>
                <p className="scriptText">"{currentStep.script}"</p>
              </div>

              {Boolean(currentStep.actionLabel && currentStep.action) && (
                <button
                  type="button"
                  className="button buttonPrimary stepActionBtn"
                  onClick={() => {
                    if (currentStep.action) {
                      currentStep.action();
                    }
                    setIsOpen(false);
                  }}
                >
                  {currentStep.actionLabel}
                </button>
              )}
            </div>

            <div className="guideFooter">
              <button
                type="button"
                className="button buttonSecondary"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
              >
                ← Previous
              </button>
              <span className="stepCounter">
                Step {activeStep + 1} of {steps.length}
              </span>
              <button
                type="button"
                className="button buttonPrimary"
                disabled={activeStep === steps.length - 1}
                onClick={() =>
                  setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))
                }
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
