"use client";

import { useState } from "react";

interface CustomPromptPanelProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PRESETS = [
  {
    id: "genomics",
    icon: "🧬",
    label: "Pediatric Genomics (GDPR)",
    prompt:
      "Cross-border pediatric genomic research under GDPR. Strictest k-anonymity (>=8), zero direct identifiers, and short 14-day retention limit.",
  },
  {
    id: "clinical",
    icon: "🏥",
    label: "Clinical Trial Escrow",
    prompt:
      "Multi-sponsor cancer drug trial. Strict dual approval for bulk exports, research-only consent gate, and audit logging for all external CRO queries.",
  },
  {
    id: "iot",
    icon: "⌚",
    label: "IoT Wearable Telemetry",
    prompt:
      "High-frequency patient heart monitor telemetry stream. Aggressive rate limiting (<=500 req/day), restricted region blocks, and max export caps.",
  },
];

export function CustomPromptPanel({
  value,
  onChange,
  disabled = false,
}: CustomPromptPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const charCount = value.length;
  const isOverLimit = charCount > 500;

  return (
    <div className="customPromptPanel">
      <div className="customPromptHeader">
        <button
          type="button"
          className="customPromptToggle"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          <span className="customPromptToggleIcon">{isOpen ? "▼" : "▶"}</span>
          <span className="sectionKicker">
            STEER GENERATION WITH DOMAIN GUIDANCE
          </span>
          {value.trim() && (
            <span className="activePromptIndicator">Active Guidance Set</span>
          )}
        </button>

        {value.trim() && (
          <button
            type="button"
            className="customPromptClearBtn"
            disabled={disabled}
            onClick={() => onChange("")}
            title="Clear custom guidance"
          >
            ↺ Reset
          </button>
        )}
      </div>

      {isOpen && (
        <div className="customPromptBody">
          <p className="customPromptHelp">
            Provide a custom scenario or security objective. The generator
            adapts its initial policy and revisions while strictly conforming to
            the 10-field arithmetic constraint circuit.
          </p>

          <div className="presetChips" role="group" aria-label="Prompt Presets">
            <span className="presetLabel">Presets:</span>
            {PRESETS.map((preset) => {
              const isSelected = value === preset.prompt;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`presetChip ${isSelected ? "presetChipActive" : ""}`}
                  disabled={disabled}
                  onClick={() => onChange(preset.prompt)}
                >
                  <span aria-hidden="true">{preset.icon}</span> {preset.label}
                </button>
              );
            })}
          </div>

          <div className="textareaWrapper">
            <textarea
              className={`customPromptTextarea ${isOverLimit ? "textareaError" : ""}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. Design a high-security health data sharing policy for rare diseases with strict k-anonymity and dual approvals..."
              rows={3}
              maxLength={500}
              disabled={disabled}
              aria-label="Custom policy domain scenario"
            />
            <div className="textareaFooter">
              <span className="charCount">
                {charCount} / 500 {isOverLimit && "(Exceeded limit)"}
              </span>
              <span className="promptSecurityNote">
                Schema-enforced: only mapped to the 10 DataPolicy controls
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
