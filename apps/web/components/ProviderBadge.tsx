"use client";

/**
 * ProviderBadge — shows which LLM provider powered the current run.
 *
 * Receives the provider string returned by /api/runs ("gemini", "featherless",
 * or "showcase"). No inference from run data needed.
 */

export type LLMProvider = "featherless" | "gemini" | "showcase";

interface ProviderBadgeProps {
  provider: LLMProvider;
}

const LABELS: Record<
  LLMProvider,
  { label: string; sublabel: string; cls: string }
> = {
  featherless: {
    label: "Featherless",
    sublabel: "Adversarial LLM Critic",
    cls: "providerBadgeFeatherless",
  },
  gemini: {
    label: "Gemini",
    sublabel: "Deterministic Critic",
    cls: "providerBadgeGemini",
  },
  showcase: {
    label: "Showcase Replay",
    sublabel: "No live model",
    cls: "providerBadgeShowcase",
  },
};

export function ProviderBadge({ provider }: ProviderBadgeProps) {
  const { label, sublabel, cls } = LABELS[provider];

  return (
    <span className={`providerBadge ${cls}`} aria-label={`Provider: ${label}`}>
      <span className="providerBadgeLabel">{label}</span>
      <span className="providerBadgeSub">{sublabel}</span>
    </span>
  );
}
